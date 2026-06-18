# Структура базы данных Steply

## Общее

- Используется PostgreSQL 16 (`postgres:16-alpine`) из `docker-compose.yml`.
- Backend работает с БД через SQLAlchemy 2.0 ORM.
- Подключение настраивается в `backend/app/db/session.py` через `DATABASE_URL` или переменные `POSTGRES_*`.
- Схема описана ORM-моделями в `backend/app/models/`.
- Схема создается миграциями Alembic. Initial revision: `202605210001` в `backend/alembic/versions/`.
- Timestamp-поля хранятся как timezone-aware UTC (`timestamp with time zone`).
- При `AUTO_INIT_DB=true` backend на старте выполняет `alembic upgrade head` через `init_db()` и затем idempotent seed справочников `achievements`/`goals`.
- Для legacy dev-баз, созданных до Alembic, `init_db()` распознает полный старый набор таблиц без `alembic_version`, добавляет только известные legacy-колонки, применяет безопасное переименование gamification-целей и затем фиксирует актуальную Alembic-ревизию. Неполная старая схема останавливает startup вместо молчаливого создания смеси таблиц.
- Сессии БД выдаются dependency `get_db()`; текущий пользователь загружается в `backend/app/api/deps.py`.

## Таблицы и модели

| Таблица / модель | Назначение | Ключевые поля | Связи |
|---|---|---|---|
| `users` / `User` | Аккаунт пользователя, базовый XP/уровень и выбранный питомец. | `id`, `email`, `full_name`, `hashed_password`, `experience_points`, `level`, `pet_type`, `pet_name`, `pet_state`, `created_at` | 1:N к `habits`, `habit_entries`, `predictions`, `recommendations`, `reward_events`, `xp_history`; 1:1 к `user_gamification_profiles`; 1:N к `user_achievements`, `user_goal_progress`. |
| `habits` / `Habit` | Описание привычки и расписания. | `id`, `user_id`, `title`, `description`, `frequency_type`, `target_per_week`, `difficulty`, `preferred_time`, `recovery_minutes`, `recovery_task`, `schedule_days`, `is_active`, `created_at` | N:1 к `users`; 1:N к `habit_entries`, `predictions`, `recommendations`, `xp_history`. |
| `habit_entries` / `HabitEntry` | Фактические отметки выполнения/пропуска. В UI это HabitCompletion. | `id`, `habit_id`, `user_id`, `entry_date`, `status`, `note`, `completion_value`, `xp_awarded`, `meta`, `created_at`; unique `habit_id + entry_date` | N:1 к `habits` и `users`; 1:N к `xp_history` через `completion_id`. |
| `predictions` / `Prediction` | Снимок предиктивного расчета риска пропуска для привычки и даты. | `id`, `habit_id`, `user_id`, `predicted_for`, `completion_probability`, `miss_risk`, `risk_level`, `features`, `created_at` | N:1 к `habits` и `users`; 1:N к `recommendations`. |
| `recommendations` / `Recommendation` | Персональные советы на основе риска, истории или общего состояния. | `id`, `user_id`, `habit_id`, `prediction_id`, `type`, `title`, `message`, `priority`, `is_read`, `created_at` | N:1 к `users`; optional N:1 к `habits` и `predictions`. |
| `user_gamification_profiles` / `UserGamificationProfile` | Агрегированное состояние геймификации пользователя. | `user_id`, `total_xp`, `level`, `current_streak`, `longest_streak`, `last_active_date`, `streak_status`, `updated_at` | 1:1 к `users` по `user_id`. |
| `achievements` / `Achievement` | Справочник достижений. | `id`, `category`, `title`, `description`, `metric`, `target`, `reward_xp`, `icon`, `sort_order`, `is_active`, `created_at` | 1:N к `user_achievements`. |
| `user_achievements` / `UserAchievement` | Прогресс пользователя по достижениям. | `id`, `user_id`, `achievement_id`, `progress`, `target`, `unlocked_at`, `reward_event_id`, `updated_at`; unique `user_id + achievement_id` | N:1 к `users`, `achievements`; optional N:1 к `reward_events`. |
| `goals` / `Goal` | Справочник целей. | `id`, `type`, `tone`, `title`, `description`, `metric`, `target`, `target_metric`, `reward_xp`, `cta_label`, `cta_section`, `next_step`, `active_when`, `sort_order`, `is_active`, `created_at` | 1:N к `user_goal_progress`. |
| `user_goal_progress` / `UserGoalProgress` | Прогресс пользователя по целям за период. | `id`, `user_id`, `goal_id`, `period_key`, `progress`, `target`, `status`, `completed_at`, `reward_event_id`, `updated_at`; unique `user_id + goal_id + period_key` | N:1 к `users`, `goals`; optional N:1 к `reward_events`. |
| `reward_events` / `RewardEvent` | Журнал начислений XP и игровых событий. | `id`, `user_id`, `event_type`, `event_key`, `xp_amount`, `description`, `source_type`, `source_id`, `meta`, `created_at`; unique `user_id + event_key` | N:1 к `users`; referenced by achievements/goals progress. |
| `xp_history` / `XPHistory` | История XP за выполнение привычек. | `id`, `user_id`, `habit_id`, `completion_id`, `entry_date`, `xp_amount`, `reason`, `created_at`; unique `user_id + habit_id + entry_date` | N:1 к `users`, `habits`; optional N:1 к `habit_entries`. |

## Ограничения и индексы

- Primary key уже индексируется PostgreSQL, поэтому отдельные `ix_*_id` для PK в новой схеме не создаются.
- `users.email` уникален и индексирован.
- Upsert отметки привычки защищен unique constraint `uq_habit_entry_date` по `habit_id + entry_date`.
- Upsert прогноза защищен unique constraint `uq_predictions_habit_user_date` по `habit_id + user_id + predicted_for`.
- Справочники прогресса защищены `uq_user_achievement`, `uq_user_goal_period`; idempotent игровые события защищены `uq_reward_event_user_key`.
- Для основных enum-like полей заданы check constraints: тип/сложность привычки, entry status, prediction risk, recommendation priority, pet type/state, streak/goal status, non-negative XP и счетчики.
- Индексы покрывают наиболее частые фильтры API: foreign keys, даты entries/predictions/XP history, unread recommendations per user, habit list per user и reward events per user/type/time.

## Каскады

- Дочерние данные пользователя удаляются на уровне БД через `ON DELETE CASCADE`.
- `Habit` каскадно удаляет entries, predictions, recommendations и `xp_history`.
- Optional ссылки `recommendations.prediction_id`, `xp_history.completion_id` и reward-event ссылки прогресса очищаются через `ON DELETE SET NULL`, когда источник удаляется.
- `reward_events` используют generic source fields, а не FK на каждую доменную сущность. Route удаления привычки явно удаляет completion-XP events вида `habit_xp:<habit_id>:<date>` перед пересчетом профиля.

## Основные связи

- `User -> Habit -> HabitEntry`: пользователь создает привычки, а отметки выполнения/пропуска сохраняются в `habit_entries`.
- `HabitEntry -> XPHistory/RewardEvent -> UserGamificationProfile`: `xp_history` хранит habit-XP audit, а общий XP/level пересчитывается из idempotent `reward_events`, чтобы учитывать также достижения, цели и прочитанные советы.
- `User -> pet fields`: питомец хранится прямо в `users` (`pet_type`, `pet_name`, `pet_state`), а прогресс питомца вычисляется из XP/level.
- `Habit -> Prediction -> Recommendation`: риск считается по истории привычки, сохраняется в `predictions`, затем на его основе создаются или обновляются рекомендации.
- `Achievement/Goal -> UserAchievement/UserGoalProgress -> RewardEvent`: справочники достижений и целей заполняются сервисом геймификации, пользовательский прогресс и награды хранятся отдельно.

## Где выполняются запросы к БД

- `backend/app/api/routes/auth.py`: регистрация, логин, создание пользователя, профиль геймификации при регистрации.
- `backend/app/api/routes/habits.py`: CRUD привычек, отметки выполнения, список entries.
- `backend/app/api/routes/analytics.py`: получение summary, статистики привычки и прогноза риска.
- `backend/app/api/routes/recommendations.py`: список, генерация и отметка рекомендации прочитанной.
- `backend/app/api/routes/gamification.py`: summary геймификации, обновление питомца, достижения, цели, история XP.
- `backend/app/services/analytics.py`: выборки привычек и entries для статистики.
- `backend/app/services/predictive.py`: расчет и upsert `predictions`.
- `backend/app/services/recommendations.py`: генерация/upsert `recommendations`.
- `backend/app/services/gamification.py`: сидинг справочников, расчет метрик, XP, reward events, achievements, goals и профиля.
- `backend/app/main.py`: health-check выполняет `SELECT 1`.
