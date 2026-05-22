# Gamification System

## Product Fit

Steply is a habit formation product with predictive risk analysis. The valuable user action is not a click, but a real habit step: creating a realistic habit, marking completion, reviewing recommendations, and returning after a miss.

The system therefore rewards:

- real habit completion;
- regular active days;
- finishing useful onboarding steps;
- reading recommendations that close the analytics feedback loop;
- recovery after missed days.

It intentionally avoids gambling mechanics, random rewards, paid boosters, loot boxes, aggressive loss states, and punitive streak copy.

## Core Loop

1. User creates or completes a habit action.
2. Backend records an idempotent reward event when the action is eligible.
3. User immediately sees XP feedback in the toast and updated progress blocks.
4. Achievements and quests update from the same backend state.
5. The dashboard shows the next best action.
6. User returns to continue the route or restore it softly after a gap.

Main UI surfaces:

- Dashboard hero: level, streak, daily progress, quests, next best action.
- Habit cards: action feedback after completion/miss.
- Achievements page: full achievement collection, quests, level progress.
- Profile page: personal progress, recovery state, achievements.
- Header/sidebar: compact level and streak status.

## XP Rules

Rules live in `backend/app/core/gamification_rules.py`.

Action rewards:

- `habit_completed`: +5 XP easy, +10 XP medium, +15 XP hard, one net reward per habit entry.
- `habit_recovery_completed`: half of difficulty XP with a 5 XP minimum.
- `recommendation_read`: +5 XP once per recommendation.

Achievement and quest rewards are separate milestone rewards. XP is not stored as a mutable frontend value. It is recalculated from `reward_events`, which makes repeated requests safe.

Anti-abuse:

- Habit entries are unique per habit/date.
- Reward events use `user_id + event_key` uniqueness.
- Habit entry XP is synced to the current entry status, so repeated completion requests do not stack XP.
- Achievements and quests can be completed once per user or period.

## Levels

Levels use progressive thresholds:

- Level 1: 0 XP, `Питомец привыкает`
- Level 2: 100 XP, `Питомец оживился`
- Level 3: 250 XP, `Питомец держит темп`
- Level 4: 500 XP, `Питомец увереннее`
- Level 5: 1000 XP, `Питомец в отличной форме`

Early levels arrive quickly to prove the system is alive. Later levels require more sustained behavior. The frontend receives current level, total XP, XP to next level, next threshold, and progress percent from `/api/gamification/summary`.

## Streaks

An active day is a day with at least one completed habit entry.

States:

- `empty`: no completed habit entries yet.
- `active`: the user completed a habit today, or the streak is preserved because there is no scheduled pressure today.
- `at_risk`: there is an active streak from yesterday and at least one habit is scheduled today, but no completion today yet.
- `restored`: user completed a habit today after a gap.

The streak is user-level, not per-habit. It is designed to support return behavior without punishing imperfect days.

## Achievements

Definitions are seeded into the `achievements` table from `ACHIEVEMENT_DEFINITIONS`.

Current achievements:

- `first_habit`: create the first habit.
- `first_completion`: complete the first habit step.
- `route_day`: complete all habits scheduled for a day.
- `streak_3`: reach 3 active days.
- `streak_7`: reach 7 active days.
- `twenty_completions`: accumulate 20 completions.
- `recommendation_cycle`: read a recommendation.
- `recovery_step`: complete a habit after a previous miss.

Achievements have locked/unlocked states and store user progress in `user_achievements`.

## Quests

Definitions are seeded into the `quests` table from `QUEST_DEFINITIONS`.

Onboarding quests:

- create first habit;
- complete first step;
- read first recommendation.

Daily quests:

- complete one step today;
- complete the route scheduled for today.

Weekly quests:

- complete five steps this week;
- read one recommendation this week;
- recovery week, shown only in recovery mode.

Quest progress is stored in `user_quest_progress` by period:

- onboarding: `onboarding`
- daily: ISO date, for example `2026-05-20`
- weekly: ISO week, for example `2026-W21`

## Rewards

Rewards are visual and progress-based:

- XP toast after meaningful actions;
- level progress;
- unlocked achievement cards;
- completed quest states;
- recent reward events in the gamification summary;
- next best action card.

There are no paid, random, or gambling rewards.

## Backend Models

New models are in `backend/app/models/gamification.py`:

- `UserGamificationProfile`
- `Achievement`
- `UserAchievement`
- `Quest`
- `UserQuestProgress`
- `RewardEvent`

Existing `User.experience_points` and `User.level` remain for compatibility, but are synced from reward events.

The schema is managed by Alembic. With `AUTO_INIT_DB=true`, `init_db()` upgrades to the current revision on startup and seeds rule definitions idempotently.

## API

New endpoints:

- `GET /api/gamification/summary`
- `GET /api/gamification/achievements`
- `GET /api/gamification/quests`
- `GET /api/gamification/events`

Action-triggered updates happen inside existing endpoints:

- `POST /api/habits` syncs onboarding progress.
- `POST /api/habits/{habit_id}/entries` syncs completion XP, streaks, quests, achievements.
- `PATCH /api/recommendations/{recommendation_id}/read` rewards recommendation review.

## Frontend Integration

New frontend API:

- `frontend/src/services/gamificationApi.ts`

Main components:

- `GamificationSummary`
- `LevelProgress`
- `XPProgressBar`
- `StreakWidget`
- `AchievementBadge`
- `AchievementGrid`
- `QuestCard`
- `DailyQuests`
- `WeeklyQuests`
- `RewardToast`
- `ProgressEmptyState`
- `NextBestActionCard`

The old local/mock achievement and quest calculation was removed. Frontend now displays server state.

## Adding A New Achievement

1. Add an item to `ACHIEVEMENT_DEFINITIONS`.
2. Use an existing metric from `collect_gamification_metrics()` or add a new metric there.
3. Restart backend so `init_db()` seeds the definition.
4. Add any needed UI category styling if the category is new.

## Adding A New Quest

1. Add an item to `QUEST_DEFINITIONS`.
2. Choose `type`: `onboarding`, `daily`, or `weekly`.
3. Choose `metric`, `target`, `reward_xp`, `cta_section`, and `next_step`.
4. Add `active_when` only if the quest should be conditional.
5. Restart backend so the definition is seeded.

## Later Improvements

- Add read timestamps to recommendations for richer weekly insight quests.
- Add admin tooling to edit quest/achievement definitions without deployment.
- Add notification scheduling for at-risk streaks without pressure language.
- Add backend tests around reward idempotency and streak edge cases.
