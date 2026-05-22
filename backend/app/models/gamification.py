from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class UserGamificationProfile(Base):
    __tablename__ = "user_gamification_profiles"
    __table_args__ = (
        CheckConstraint("total_xp >= 0", name="ck_user_gamification_profiles_total_xp"),
        CheckConstraint("level >= 1", name="ck_user_gamification_profiles_level"),
        CheckConstraint("current_streak >= 0", name="ck_user_gamification_profiles_current_streak"),
        CheckConstraint("longest_streak >= 0", name="ck_user_gamification_profiles_longest_streak"),
        CheckConstraint(
            "streak_status IN ('empty', 'active', 'at_risk', 'restored')",
            name="ck_user_gamification_profiles_streak_status",
        ),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    )
    total_xp: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    level: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)
    current_streak: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    longest_streak: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    last_active_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    streak_status: Mapped[str] = mapped_column(
        String(24),
        default="empty",
        server_default=text("'empty'"),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="gamification_profile")


class Achievement(Base):
    __tablename__ = "achievements"
    __table_args__ = (
        CheckConstraint("target >= 1", name="ck_achievements_target"),
        CheckConstraint("reward_xp >= 0", name="ck_achievements_reward_xp"),
        CheckConstraint("sort_order >= 0", name="ck_achievements_sort_order"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(String(80), nullable=False)
    target: Mapped[int] = mapped_column(Integer, nullable=False)
    reward_xp: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    icon: Mapped[str] = mapped_column(String(12), nullable=False)
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user_progress = relationship("UserAchievement", back_populates="achievement")


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
        CheckConstraint("progress >= 0", name="ck_user_achievements_progress"),
        CheckConstraint("target >= 1", name="ck_user_achievements_target"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    achievement_id: Mapped[str] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    target: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)
    unlocked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reward_event_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("reward_events.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="achievements")
    achievement = relationship("Achievement", back_populates="user_progress")
    reward_event = relationship("RewardEvent", foreign_keys=[reward_event_id])


class Quest(Base):
    __tablename__ = "quests"
    __table_args__ = (
        CheckConstraint("type IN ('onboarding', 'daily', 'weekly')", name="ck_quests_type"),
        CheckConstraint("target >= 1", name="ck_quests_target"),
        CheckConstraint("reward_xp >= 0", name="ck_quests_reward_xp"),
        CheckConstraint("sort_order >= 0", name="ck_quests_sort_order"),
    )

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    tone: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    metric: Mapped[str] = mapped_column(String(80), nullable=False)
    target: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)
    target_metric: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    reward_xp: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    cta_label: Mapped[str] = mapped_column(String(80), nullable=False)
    cta_section: Mapped[str] = mapped_column(String(40), nullable=False)
    next_step: Mapped[str] = mapped_column(Text, nullable=False)
    active_when: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    sort_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user_progress = relationship("UserQuestProgress", back_populates="quest")


class UserQuestProgress(Base):
    __tablename__ = "user_quest_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "quest_id", "period_key", name="uq_user_quest_period"),
        CheckConstraint("progress >= 0", name="ck_user_quest_progress_progress"),
        CheckConstraint("target >= 1", name="ck_user_quest_progress_target"),
        CheckConstraint(
            "status IN ('active', 'completed', 'empty')",
            name="ck_user_quest_progress_status",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    quest_id: Mapped[str] = mapped_column(
        ForeignKey("quests.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    period_key: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    progress: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default=text("0"),
        nullable=False,
    )
    target: Mapped[int] = mapped_column(Integer, default=1, server_default=text("1"), nullable=False)
    status: Mapped[str] = mapped_column(
        String(24),
        default="active",
        server_default=text("'active'"),
        nullable=False,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reward_event_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("reward_events.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="quest_progress")
    quest = relationship("Quest", back_populates="user_progress")
    reward_event = relationship("RewardEvent", foreign_keys=[reward_event_id])


class RewardEvent(Base):
    __tablename__ = "reward_events"
    __table_args__ = (
        UniqueConstraint("user_id", "event_key", name="uq_reward_event_user_key"),
        CheckConstraint("xp_amount >= 0", name="ck_reward_events_xp_amount"),
        Index("ix_reward_events_user_type_created", "user_id", "event_type", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    event_key: Mapped[str] = mapped_column(String(180), nullable=False)
    xp_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        server_default=text("'{}'::json"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="reward_events")


class XPHistory(Base):
    __tablename__ = "xp_history"
    __table_args__ = (
        UniqueConstraint("user_id", "habit_id", "entry_date", name="uq_xp_history_habit_day"),
        CheckConstraint("xp_amount >= 0", name="ck_xp_history_xp_amount"),
        CheckConstraint(
            "reason IN ('completed_on_time', 'recovery_completed')",
            name="ck_xp_history_reason",
        ),
        Index("ix_xp_history_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    completion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("habit_entries.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    xp_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    user = relationship("User", back_populates="xp_history")
    habit = relationship("Habit", back_populates="xp_history")
    completion = relationship("HabitEntry", back_populates="xp_history")
