from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.gamification_rules import (
    ACHIEVEMENT_DEFINITIONS,
    COMPLETION_STATUSES,
    QUEST_DEFINITIONS,
    XP_REWARDS,
    calculatePetState,
    getRecoveryTask,
    getXPForCompletion,
    get_level_state,
    shouldActivateRecoveryMode,
)
from app.models import (
    Achievement,
    Habit,
    HabitEntry,
    Quest,
    Recommendation,
    RewardEvent,
    User,
    UserAchievement,
    UserGamificationProfile,
    UserQuestProgress,
    XPHistory,
)
from app.services.habit_schedule import is_habit_available_at, is_habit_scheduled_on


def seed_gamification_definitions(db: Session) -> None:
    for item in ACHIEVEMENT_DEFINITIONS:
        achievement = db.get(Achievement, item["id"])
        if achievement is None:
            achievement = Achievement(id=item["id"])
            db.add(achievement)
        for field, value in item.items():
            setattr(achievement, field, value)
        achievement.is_active = True

    for item in QUEST_DEFINITIONS:
        quest = db.get(Quest, item["id"])
        if quest is None:
            quest = Quest(id=item["id"])
            db.add(quest)
        for field, value in item.items():
            setattr(quest, field, value)
        quest.target_metric = item.get("target_metric")
        quest.active_when = item.get("active_when")
        quest.is_active = True

    db.commit()


def get_or_create_profile(db: Session, user: User) -> UserGamificationProfile:
    profile = db.get(UserGamificationProfile, user.id)
    if profile is None:
        profile = UserGamificationProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    existing_events = db.scalar(
        select(func.count(RewardEvent.id)).where(RewardEvent.user_id == user.id)
    )
    if not existing_events and user.experience_points > 0:
        db.add(
            RewardEvent(
                user_id=user.id,
                event_type="legacy_xp_import",
                event_key="legacy_xp_import",
                xp_amount=user.experience_points,
                description="Перенос ранее начисленного опыта",
                source_type="user",
                source_id=str(user.id),
                meta={"source": "legacy_user_fields"},
            )
        )
        db.flush()

    return profile


def award_xp_once(
    db: Session,
    user: User,
    *,
    event_type: str,
    event_key: str,
    xp_amount: int,
    description: str,
    source_type: Optional[str] = None,
    source_id: Optional[str] = None,
    meta: Optional[dict[str, Any]] = None,
) -> Optional[RewardEvent]:
    existing = db.scalar(
        select(RewardEvent).where(
            RewardEvent.user_id == user.id,
            RewardEvent.event_key == event_key,
        )
    )
    if existing is not None:
        return None

    event = RewardEvent(
        user_id=user.id,
        event_type=event_type,
        event_key=event_key,
        xp_amount=xp_amount,
        description=description,
        source_type=source_type,
        source_id=source_id,
        meta=meta or {},
    )
    db.add(event)
    db.flush()
    return event


def _has_configured_pet(user: User) -> bool:
    return bool(user.pet_type and user.pet_name)


def sync_habit_entry_reward(db: Session, user: User, habit: Habit, entry: HabitEntry) -> None:
    existing_history = db.scalar(
        select(XPHistory).where(
            XPHistory.user_id == user.id,
            XPHistory.habit_id == habit.id,
            XPHistory.entry_date == entry.entry_date,
        )
    )
    event_key = f"habit_xp:{habit.id}:{entry.entry_date.isoformat()}"

    if not _has_configured_pet(user):
        if existing_history is not None:
            db.delete(existing_history)
            existing_event = db.scalar(
                select(RewardEvent).where(
                    RewardEvent.user_id == user.id,
                    RewardEvent.event_key == event_key,
                )
            )
            if existing_event is not None:
                db.delete(existing_event)
        entry.xp_awarded = 0
        refresh_user_gamification(db, user)
        return

    xp_amount = getXPForCompletion(entry.status, habit.difficulty)

    if xp_amount <= 0:
        if existing_history is not None:
            db.delete(existing_history)
            existing_event = db.scalar(
                select(RewardEvent).where(
                    RewardEvent.user_id == user.id,
                    RewardEvent.event_key == event_key,
                )
            )
            if existing_event is not None:
                db.delete(existing_event)
        entry.xp_awarded = 0
        refresh_user_gamification(db, user)
        return

    reason = "recovery_completed" if entry.status == "recovery_completed" else "completed_on_time"
    description = (
        str(XP_REWARDS["habit_recovery_completed"]["description"])
        if reason == "recovery_completed"
        else str(XP_REWARDS["habit_completed"]["description"])
    )
    if existing_history is not None:
        existing_history.completion_id = entry.id
        existing_history.xp_amount = xp_amount
        existing_history.reason = reason
        entry.xp_awarded = xp_amount
        _sync_habit_reward_event(
            db,
            user,
            habit,
            entry,
            event_key=event_key,
            reason=reason,
            description=description,
            xp_amount=xp_amount,
        )
        if entry.status == "recovery_completed":
            _set_recovery_metadata(entry, habit)
        refresh_user_gamification(db, user)
        return

    history = XPHistory(
        user_id=user.id,
        habit_id=habit.id,
        completion_id=entry.id,
        entry_date=entry.entry_date,
        xp_amount=xp_amount,
        reason=reason,
    )
    db.add(history)
    entry.xp_awarded = xp_amount
    if entry.status == "recovery_completed":
        _set_recovery_metadata(entry, habit)
    _sync_habit_reward_event(
        db,
        user,
        habit,
        entry,
        event_key=event_key,
        reason=reason,
        description=description,
        xp_amount=xp_amount,
    )

    refresh_user_gamification(db, user)


def _set_recovery_metadata(entry: HabitEntry, habit: Habit) -> None:
    entry.meta = {
        **(entry.meta or {}),
        "recovery_task": getRecoveryTask(habit),
        "support_message": "Минимальная версия выполнена. Регулярность сохранена.",
    }


def _sync_habit_reward_event(
    db: Session,
    user: User,
    habit: Habit,
    entry: HabitEntry,
    *,
    event_key: str,
    reason: str,
    description: str,
    xp_amount: int,
) -> None:
    meta = {
        "habit_id": habit.id,
        "habit_title": habit.title,
        "entry_date": entry.entry_date.isoformat(),
        "status": entry.status,
        "reason": reason,
    }
    event = db.scalar(
        select(RewardEvent).where(
            RewardEvent.user_id == user.id,
            RewardEvent.event_key == event_key,
        )
    )
    if event is None:
        award_xp_once(
            db,
            user,
            event_type=reason,
            event_key=event_key,
            xp_amount=xp_amount,
            description=description,
            source_type="habit_entry",
            source_id=str(entry.id),
            meta=meta,
        )
        return

    event.event_type = reason
    event.xp_amount = xp_amount
    event.description = description
    event.source_id = str(entry.id)
    event.meta = meta


def record_recommendation_read(db: Session, user: User, recommendation: Recommendation) -> None:
    rule = XP_REWARDS["recommendation_read"]
    award_xp_once(
        db,
        user,
        event_type="recommendation_read",
        event_key=f"recommendation_read:{recommendation.id}",
        xp_amount=int(rule["xp"]),
        description=str(rule["description"]),
        source_type="recommendation",
        source_id=str(recommendation.id),
        meta={"recommendation_type": recommendation.type},
    )
    refresh_user_gamification(db, user)


def refresh_user_gamification(
    db: Session,
    user: User,
    *,
    award_milestones: bool = True,
) -> dict[str, Any]:
    profile = get_or_create_profile(db, user)
    metrics = collect_gamification_metrics(db, user)
    can_award_milestones = award_milestones and _has_configured_pet(user)
    user.pet_state = calculatePetState(
        {
            "completed_last_7_days": metrics["completed_last_7_days"],
            "missed_last_7_days": metrics["missed_last_7_days"],
        }
    )
    profile.current_streak = int(metrics["current_streak"])
    profile.longest_streak = int(metrics["longest_streak"])
    profile.last_active_date = metrics["last_active_date"]
    profile.streak_status = str(metrics["streak_status"])

    sync_achievements(db, user, metrics, award_rewards=can_award_milestones)
    sync_quests(db, user, metrics, award_rewards=can_award_milestones)
    sync_profile_xp(db, user, profile)
    db.flush()
    return build_gamification_summary(db, user, profile, metrics)


def collect_gamification_metrics(
    db: Session,
    user: User,
    today: Optional[date] = None,
    now: Optional[datetime] = None,
) -> dict[str, Any]:
    now = now or datetime.now()
    today = today or now.date()
    schedule_now = now if now.date() == today else datetime.combine(today, time.min)
    week_start = today - timedelta(days=today.weekday())
    recent_start = today - timedelta(days=6)
    habits = list(db.scalars(select(Habit).where(Habit.user_id == user.id)))
    active_habits = [habit for habit in habits if habit.is_active]
    entries = list(
        db.scalars(
            select(HabitEntry)
            .where(HabitEntry.user_id == user.id)
            .order_by(HabitEntry.entry_date, HabitEntry.id)
        )
    )
    completed_entries = [entry for entry in entries if entry.status in COMPLETION_STATUSES]
    missed_entries = [entry for entry in entries if entry.status == "missed"]
    active_days = {entry.entry_date for entry in completed_entries}
    completed_today_ids = {
        entry.habit_id for entry in completed_entries if entry.entry_date == today
    }
    scheduled_today_ids = {
        habit.id
        for habit in active_habits
        if is_habit_available_at(habit, schedule_now)
        or (habit.id in completed_today_ids and is_habit_scheduled_on(habit, today))
    }
    current_streak, longest_streak, streak_status = calculate_streak_state(
        active_days,
        today=today,
        scheduled_today=len(scheduled_today_ids),
    )
    recommendations_read_current_week = int(
        db.scalar(
            select(func.count(RewardEvent.id)).where(
                RewardEvent.user_id == user.id,
                RewardEvent.event_type == "recommendation_read",
                RewardEvent.created_at >= datetime.combine(week_start, time.min),
            )
        )
        or 0
    )
    recommendations_read_count = int(
        db.scalar(
            select(func.count(Recommendation.id)).where(
                Recommendation.user_id == user.id,
                Recommendation.is_read.is_(True),
            )
        )
        or 0
    )
    missed_last_7_days = sum(1 for entry in missed_entries if entry.entry_date >= recent_start)
    entries_last_7_days = [entry for entry in entries if entry.entry_date >= recent_start]
    completed_last_7_days = sum(1 for entry in completed_entries if entry.entry_date >= recent_start)
    completed_current_week = sum(
        1 for entry in completed_entries if week_start <= entry.entry_date <= today
    )
    recovery_mode = missed_last_7_days >= 3 or any(
        shouldActivateRecoveryMode(
            {
                "completion_rate_last_7": _habit_completion_rate_last_7(entries, habit.id, today),
                "total_last_7_days": _habit_entry_count_last_7(entries, habit.id, today),
                "consecutive_missed": _habit_consecutive_missed(entries, habit.id),
            },
            0,
        )
        for habit in active_habits
    )

    seen_miss = False
    recovered_after_miss = 0
    for entry in entries:
        if entry.status == "missed":
            seen_miss = True
        elif entry.status in COMPLETION_STATUSES and seen_miss:
            recovered_after_miss = 1
            break

    return {
        "total_habits": len(habits),
        "active_habits": len(active_habits),
        "completed_count": len(completed_entries),
        "missed_count": len(missed_entries),
        "completed_today": len(completed_today_ids),
        "scheduled_today": len(scheduled_today_ids),
        "completed_scheduled_today": len(completed_today_ids & scheduled_today_ids),
        "completed_last_7_days": completed_last_7_days,
        "missed_last_7_days": missed_last_7_days,
        "total_last_7_days": len(entries_last_7_days),
        "completed_current_week": completed_current_week,
        "recommendations_read_count": recommendations_read_count,
        "recommendations_read_current_week": recommendations_read_current_week,
        "route_completion_days": int(
            bool(scheduled_today_ids) and scheduled_today_ids.issubset(completed_today_ids)
        ),
        "current_streak": current_streak,
        "longest_streak": longest_streak,
        "last_active_date": max(active_days) if active_days else None,
        "streak_status": streak_status,
        "recovered_after_miss": recovered_after_miss,
        "recovery_mode": recovery_mode,
    }


def _habit_entries(entries: list[HabitEntry], habit_id: int) -> list[HabitEntry]:
    return [entry for entry in entries if entry.habit_id == habit_id]


def _habit_entry_count_last_7(entries: list[HabitEntry], habit_id: int, today: date) -> int:
    recent_start = today - timedelta(days=6)
    return sum(
        1
        for entry in entries
        if entry.habit_id == habit_id and entry.entry_date >= recent_start
    )


def _habit_completion_rate_last_7(entries: list[HabitEntry], habit_id: int, today: date) -> float:
    recent_start = today - timedelta(days=6)
    recent_entries = [
        entry
        for entry in entries
        if entry.habit_id == habit_id and entry.entry_date >= recent_start
    ]
    if not recent_entries:
        return 0.0
    completed = sum(1 for entry in recent_entries if entry.status in COMPLETION_STATUSES)
    return completed / len(recent_entries)


def _habit_consecutive_missed(entries: list[HabitEntry], habit_id: int) -> int:
    missed = 0
    for entry in reversed(sorted(_habit_entries(entries, habit_id), key=lambda item: item.entry_date)):
        if entry.status == "missed":
            missed += 1
            continue
        if entry.status in COMPLETION_STATUSES:
            break
    return missed


def calculate_streak_state(
    active_days: set[date],
    *,
    today: date,
    scheduled_today: int,
) -> tuple[int, int, str]:
    if not active_days:
        return 0, 0, "empty"

    sorted_days = sorted(active_days)
    longest = 1
    running = 1
    for index in range(1, len(sorted_days)):
        if sorted_days[index] == sorted_days[index - 1] + timedelta(days=1):
            running += 1
        else:
            running = 1
        longest = max(longest, running)

    yesterday = today - timedelta(days=1)
    anchor = today if today in active_days else yesterday if yesterday in active_days else None
    current = 0
    if anchor is not None:
        cursor = anchor
        while cursor in active_days:
            current += 1
            cursor -= timedelta(days=1)

    if today in active_days:
        had_older_activity = any(day < yesterday for day in active_days)
        status = "restored" if yesterday not in active_days and had_older_activity else "active"
    elif current > 0 and scheduled_today > 0:
        status = "at_risk"
    elif current > 0:
        status = "active"
    else:
        status = "at_risk" if scheduled_today > 0 else "empty"

    return current, longest, status


def sync_achievements(
    db: Session,
    user: User,
    metrics: dict[str, Any],
    *,
    award_rewards: bool = True,
) -> None:
    achievements = list(
        db.scalars(
            select(Achievement)
            .where(Achievement.is_active.is_(True))
            .order_by(Achievement.sort_order)
        )
    )
    now = datetime.utcnow()
    for achievement in achievements:
        progress = min(int(metrics.get(achievement.metric, 0) or 0), achievement.target)
        user_achievement = db.scalar(
            select(UserAchievement).where(
                UserAchievement.user_id == user.id,
                UserAchievement.achievement_id == achievement.id,
            )
        )
        if user_achievement is None:
            user_achievement = UserAchievement(
                user_id=user.id,
                achievement_id=achievement.id,
                target=achievement.target,
            )
            db.add(user_achievement)

        user_achievement.target = achievement.target
        user_achievement.progress = max(user_achievement.progress or 0, progress)
        if user_achievement.unlocked_at is None and progress >= achievement.target:
            reward = (
                award_xp_once(
                    db,
                    user,
                    event_type="achievement_unlocked",
                    event_key=f"achievement:{achievement.id}",
                    xp_amount=achievement.reward_xp,
                    description=f"Достижение: {achievement.title}",
                    source_type="achievement",
                    source_id=achievement.id,
                    meta={"category": achievement.category},
                )
                if award_rewards
                else None
            )
            user_achievement.unlocked_at = now
            if reward is not None:
                user_achievement.reward_event_id = reward.id


def sync_quests(
    db: Session,
    user: User,
    metrics: dict[str, Any],
    *,
    award_rewards: bool = True,
) -> None:
    quests = list(
        db.scalars(
            select(Quest)
            .where(Quest.is_active.is_(True))
            .order_by(Quest.sort_order)
        )
    )
    now = datetime.utcnow()
    today = date.today()
    for quest in quests:
        if quest.active_when == "recovery_mode" and not metrics["recovery_mode"]:
            continue

        period_key = get_quest_period_key(quest.type, today)
        target = int(metrics.get(quest.target_metric, quest.target) or quest.target)
        target = max(target, quest.target)
        progress = min(int(metrics.get(quest.metric, 0) or 0), target)
        is_empty = quest.id == "daily_route" and int(metrics["scheduled_today"]) == 0

        quest_progress = db.scalar(
            select(UserQuestProgress).where(
                UserQuestProgress.user_id == user.id,
                UserQuestProgress.quest_id == quest.id,
                UserQuestProgress.period_key == period_key,
            )
        )
        if quest_progress is None:
            quest_progress = UserQuestProgress(
                user_id=user.id,
                quest_id=quest.id,
                period_key=period_key,
                target=target,
            )
            db.add(quest_progress)

        quest_progress.target = target
        quest_progress.progress = max(quest_progress.progress or 0, progress)
        if (
            not is_empty
            and quest_progress.status != "completed"
            and progress >= target
        ):
            reward = (
                award_xp_once(
                    db,
                    user,
                    event_type="quest_completed",
                    event_key=f"quest:{quest.id}:{period_key}",
                    xp_amount=quest.reward_xp,
                    description=f"Задание: {quest.title}",
                    source_type="quest",
                    source_id=quest.id,
                    meta={"period_key": period_key, "type": quest.type},
                )
                if award_rewards
                else None
            )
            quest_progress.status = "completed"
            quest_progress.completed_at = now
            if reward is not None:
                quest_progress.reward_event_id = reward.id
        elif quest_progress.status != "completed":
            quest_progress.status = "empty" if is_empty else "active"


def sync_profile_xp(db: Session, user: User, profile: UserGamificationProfile) -> None:
    total_xp = int(
        db.scalar(
            select(func.coalesce(func.sum(RewardEvent.xp_amount), 0)).where(
                RewardEvent.user_id == user.id
            )
        )
        or 0
    )
    total_xp = max(total_xp, 0)
    level_state = get_level_state(total_xp)
    profile.total_xp = total_xp
    profile.level = int(level_state["level"])
    user.experience_points = total_xp
    user.level = int(level_state["level"])


def get_quest_period_key(quest_type: str, today: date) -> str:
    if quest_type == "onboarding":
        return "onboarding"
    if quest_type == "weekly":
        iso_year, iso_week, _ = today.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    return today.isoformat()


def build_gamification_summary(
    db: Session,
    user: User,
    profile: UserGamificationProfile,
    metrics: dict[str, Any],
) -> dict[str, Any]:
    level_state = get_level_state(profile.total_xp)
    achievements = build_achievement_items(db, user)
    quests = build_quest_items(db, user, metrics)
    recent_events = list(
        db.scalars(
            select(RewardEvent)
            .where(RewardEvent.user_id == user.id)
            .order_by(RewardEvent.created_at.desc(), RewardEvent.id.desc())
            .limit(8)
        )
    )
    return {
        "profile": {
            **level_state,
            "current_streak": profile.current_streak,
            "longest_streak": profile.longest_streak,
            "last_active_date": profile.last_active_date,
            "streak_status": profile.streak_status,
        },
        "pet": build_pet_read(user, profile),
        "streak": build_streak_read(profile, metrics),
        "achievements": achievements,
        "quests": quests,
        "recent_events": [reward_event_to_dict(event) for event in recent_events],
        "next_best_action": choose_next_best_action(quests, profile.streak_status),
    }


def build_pet_read(user: User, profile: UserGamificationProfile) -> dict[str, Any]:
    level_state = get_level_state(profile.total_xp)
    return {
        "pet_type": user.pet_type,
        "pet_name": user.pet_name,
        "pet_state": user.pet_state,
        "level": profile.level,
        "xp": profile.total_xp,
        "progress_percent": level_state["progress_percent"],
        "next_level": level_state["next_level"],
        "next_level_xp": level_state["next_level_xp"],
        "xp_to_next_level": level_state["xp_to_next_level"],
        "is_configured": bool(user.pet_type and user.pet_name),
    }


def build_achievement_items(db: Session, user: User) -> list[dict[str, Any]]:
    rows = db.execute(
        select(Achievement, UserAchievement)
        .join(
            UserAchievement,
            (UserAchievement.achievement_id == Achievement.id)
            & (UserAchievement.user_id == user.id),
            isouter=True,
        )
        .where(Achievement.is_active.is_(True))
        .order_by(Achievement.sort_order)
    ).all()
    items: list[dict[str, Any]] = []
    for achievement, progress in rows:
        current = progress.progress if progress else 0
        unlocked_at = progress.unlocked_at if progress else None
        items.append(
            {
                "id": achievement.id,
                "title": achievement.title,
                "description": achievement.description,
                "category": achievement.category,
                "icon": achievement.icon,
                "progress": min(current, achievement.target),
                "target": achievement.target,
                "reward_xp": achievement.reward_xp,
                "unlocked": unlocked_at is not None,
                "unlocked_at": unlocked_at,
            }
        )
    return items


def build_quest_items(db: Session, user: User, metrics: dict[str, Any]) -> list[dict[str, Any]]:
    today = date.today()
    quests = list(
        db.scalars(
            select(Quest)
            .where(Quest.is_active.is_(True))
            .order_by(Quest.sort_order)
        )
    )
    items: list[dict[str, Any]] = []
    for quest in quests:
        if quest.active_when == "recovery_mode" and not metrics["recovery_mode"]:
            continue

        period_key = get_quest_period_key(quest.type, today)
        target = int(metrics.get(quest.target_metric, quest.target) or quest.target)
        target = max(target, quest.target)
        fallback_progress = min(int(metrics.get(quest.metric, 0) or 0), target)
        progress = db.scalar(
            select(UserQuestProgress).where(
                UserQuestProgress.user_id == user.id,
                UserQuestProgress.quest_id == quest.id,
                UserQuestProgress.period_key == period_key,
            )
        )
        current = max(progress.progress, fallback_progress) if progress else fallback_progress
        status = progress.status if progress else "active"
        is_empty = quest.id == "daily_route" and int(metrics["scheduled_today"]) == 0
        if is_empty:
            status = "empty"
        items.append(
            {
                "id": quest.id,
                "type": quest.type,
                "tone": quest.tone,
                "title": quest.title,
                "description": quest.description,
                "progress": min(current, target),
                "target": target,
                "reward_xp": quest.reward_xp,
                "status": status,
                "period_key": period_key,
                "cta_label": quest.cta_label,
                "cta_section": quest.cta_section,
                "next_step": quest.next_step,
                "completed_at": progress.completed_at if progress else None,
                "empty": is_empty,
            }
        )
    return items


def build_streak_read(
    profile: UserGamificationProfile,
    metrics: dict[str, Any],
) -> dict[str, Any]:
    labels = {
        "empty": "Серия еще не началась",
        "active": "Серия активна",
        "at_risk": "Серия под риском",
        "restored": "Серия восстановлена",
    }
    next_steps = {
        "empty": "Создайте привычку и закройте первый короткий шаг.",
        "active": "Поддержите темп одним реальным действием сегодня или завтра.",
        "at_risk": "Выберите минимальную версию привычки, чтобы вернуться без давления.",
        "restored": "Закрепите восстановление небольшим повторением в ближайший день.",
    }
    return {
        "current": profile.current_streak,
        "best": profile.longest_streak,
        "status": profile.streak_status,
        "label": labels.get(profile.streak_status, labels["empty"]),
        "next_step": next_steps.get(profile.streak_status, next_steps["empty"]),
        "is_at_risk": profile.streak_status == "at_risk",
        "last_active_date": profile.last_active_date,
        "completed_today": metrics["completed_scheduled_today"],
        "scheduled_today": metrics["scheduled_today"],
    }


def choose_next_best_action(quests: list[dict[str, Any]], streak_status: str) -> dict[str, Any]:
    onboarding = next(
        (
            quest
            for quest in quests
            if quest["type"] == "onboarding" and quest["status"] != "completed"
        ),
        None,
    )
    if onboarding:
        return {
            "title": onboarding["title"],
            "description": onboarding["next_step"],
            "cta_label": onboarding["cta_label"],
            "cta_section": onboarding["cta_section"],
        }

    if streak_status == "at_risk":
        return {
            "title": "Вернуть серию мягко",
            "description": "Закройте один минимальный шаг, а не компенсируйте пропущенный объем.",
            "cta_label": "Открыть день",
            "cta_section": "dashboard",
        }

    active_quest = next(
        (
            quest
            for quest in quests
            if quest["status"] not in {"completed", "empty"} and quest["type"] in {"daily", "weekly"}
        ),
        None,
    )
    if active_quest:
        return {
            "title": active_quest["title"],
            "description": active_quest["next_step"],
            "cta_label": active_quest["cta_label"],
            "cta_section": active_quest["cta_section"],
        }

    return {
        "title": "Маршрут держится",
        "description": "Следующий полезный шаг появится после обновления привычек или нового дня.",
        "cta_label": "Открыть привычки",
        "cta_section": "habits",
    }


def reward_event_to_dict(event: RewardEvent) -> dict[str, Any]:
    return {
        "id": event.id,
        "event_type": event.event_type,
        "xp_amount": event.xp_amount,
        "description": event.description,
        "source_type": event.source_type,
        "source_id": event.source_id,
        "created_at": event.created_at,
        "meta": event.meta,
    }
