"""Create the initial Steply schema.

Revision ID: 202605210001
Revises:
Create Date: 2026-05-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202605210001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("experience_points", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("level", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("lives", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("pet_type", sa.String(length=24), nullable=True),
        sa.Column("pet_name", sa.String(length=80), nullable=True),
        sa.Column("pet_state", sa.String(length=24), server_default=sa.text("'neutral'"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "experience_points >= 0",
            name="ck_users_experience_points_non_negative",
        ),
        sa.CheckConstraint("level >= 1", name="ck_users_level_positive"),
        sa.CheckConstraint("lives >= 0", name="ck_users_lives_non_negative"),
        sa.CheckConstraint(
            "pet_type IS NULL OR pet_type IN ('dog', 'cat', 'parrot', 'hamster')",
            name="ck_users_pet_type",
        ),
        sa.CheckConstraint(
            "pet_state IN ('happy', 'neutral', 'sad')",
            name="ck_users_pet_state",
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "habits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("frequency_type", sa.String(length=32), server_default=sa.text("'daily'"), nullable=False),
        sa.Column("target_per_week", sa.Integer(), server_default=sa.text("7"), nullable=False),
        sa.Column("difficulty", sa.String(length=32), server_default=sa.text("'medium'"), nullable=False),
        sa.Column("preferred_time", sa.Time(), nullable=True),
        sa.Column("recovery_minutes", sa.Integer(), server_default=sa.text("5"), nullable=False),
        sa.Column("recovery_task", sa.Text(), nullable=True),
        sa.Column("schedule_days", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "frequency_type IN ('daily', 'weekly', 'custom')",
            name="ck_habits_frequency_type",
        ),
        sa.CheckConstraint("target_per_week BETWEEN 1 AND 7", name="ck_habits_target_per_week"),
        sa.CheckConstraint("difficulty IN ('easy', 'medium', 'hard')", name="ck_habits_difficulty"),
        sa.CheckConstraint("recovery_minutes BETWEEN 1 AND 120", name="ck_habits_recovery_minutes"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_habits_user_id", "habits", ["user_id"], unique=False)
    op.create_index(
        "ix_habits_user_active_created",
        "habits",
        ["user_id", "is_active", "created_at"],
        unique=False,
    )

    op.create_table(
        "habit_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("habit_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("completion_value", sa.Float(), nullable=True),
        sa.Column("xp_awarded", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("meta", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('completed', 'missed', 'recovery_completed')",
            name="ck_habit_entries_status",
        ),
        sa.CheckConstraint("xp_awarded >= 0", name="ck_habit_entries_xp_awarded_non_negative"),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("habit_id", "entry_date", name="uq_habit_entry_date"),
    )
    op.create_index("ix_habit_entries_entry_date", "habit_entries", ["entry_date"], unique=False)
    op.create_index("ix_habit_entries_habit_id", "habit_entries", ["habit_id"], unique=False)
    op.create_index("ix_habit_entries_user_id", "habit_entries", ["user_id"], unique=False)
    op.create_index(
        "ix_habit_entries_user_date",
        "habit_entries",
        ["user_id", "entry_date"],
        unique=False,
    )

    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("habit_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("predicted_for", sa.Date(), nullable=False),
        sa.Column("completion_probability", sa.Float(), nullable=False),
        sa.Column("miss_risk", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=24), nullable=False),
        sa.Column("features", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "completion_probability BETWEEN 0 AND 1",
            name="ck_predictions_completion_probability",
        ),
        sa.CheckConstraint("miss_risk BETWEEN 0 AND 1", name="ck_predictions_miss_risk"),
        sa.CheckConstraint("risk_level IN ('low', 'medium', 'high')", name="ck_predictions_risk_level"),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "habit_id",
            "user_id",
            "predicted_for",
            name="uq_predictions_habit_user_date",
        ),
    )
    op.create_index("ix_predictions_habit_id", "predictions", ["habit_id"], unique=False)
    op.create_index("ix_predictions_predicted_for", "predictions", ["predicted_for"], unique=False)
    op.create_index("ix_predictions_user_id", "predictions", ["user_id"], unique=False)

    op.create_table(
        "recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("habit_id", sa.Integer(), nullable=True),
        sa.Column("prediction_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(length=48), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(length=24), server_default=sa.text("'normal'"), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'normal', 'high')",
            name="ck_recommendations_priority",
        ),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["prediction_id"], ["predictions.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_recommendations_habit_id", "recommendations", ["habit_id"], unique=False)
    op.create_index(
        "ix_recommendations_prediction_id",
        "recommendations",
        ["prediction_id"],
        unique=False,
    )
    op.create_index("ix_recommendations_user_id", "recommendations", ["user_id"], unique=False)
    op.create_index(
        "ix_recommendations_user_read_created",
        "recommendations",
        ["user_id", "is_read", "created_at"],
        unique=False,
    )

    op.create_table(
        "user_gamification_profiles",
        sa.Column("user_id", sa.Integer(), primary_key=True),
        sa.Column("total_xp", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("level", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("current_streak", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("longest_streak", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_active_date", sa.Date(), nullable=True),
        sa.Column("streak_status", sa.String(length=24), server_default=sa.text("'empty'"), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("total_xp >= 0", name="ck_user_gamification_profiles_total_xp"),
        sa.CheckConstraint("level >= 1", name="ck_user_gamification_profiles_level"),
        sa.CheckConstraint(
            "current_streak >= 0",
            name="ck_user_gamification_profiles_current_streak",
        ),
        sa.CheckConstraint(
            "longest_streak >= 0",
            name="ck_user_gamification_profiles_longest_streak",
        ),
        sa.CheckConstraint(
            "streak_status IN ('empty', 'active', 'at_risk', 'restored')",
            name="ck_user_gamification_profiles_streak_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "achievements",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metric", sa.String(length=80), nullable=False),
        sa.Column("target", sa.Integer(), nullable=False),
        sa.Column("reward_xp", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("icon", sa.String(length=12), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("target >= 1", name="ck_achievements_target"),
        sa.CheckConstraint("reward_xp >= 0", name="ck_achievements_reward_xp"),
        sa.CheckConstraint("sort_order >= 0", name="ck_achievements_sort_order"),
    )

    op.create_table(
        "quests",
        sa.Column("id", sa.String(length=80), primary_key=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("tone", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metric", sa.String(length=80), nullable=False),
        sa.Column("target", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("target_metric", sa.String(length=80), nullable=True),
        sa.Column("reward_xp", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("cta_label", sa.String(length=80), nullable=False),
        sa.Column("cta_section", sa.String(length=40), nullable=False),
        sa.Column("next_step", sa.Text(), nullable=False),
        sa.Column("active_when", sa.String(length=80), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("type IN ('onboarding', 'daily', 'weekly')", name="ck_quests_type"),
        sa.CheckConstraint("target >= 1", name="ck_quests_target"),
        sa.CheckConstraint("reward_xp >= 0", name="ck_quests_reward_xp"),
        sa.CheckConstraint("sort_order >= 0", name="ck_quests_sort_order"),
    )

    op.create_table(
        "reward_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("event_key", sa.String(length=180), nullable=False),
        sa.Column("xp_amount", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=60), nullable=True),
        sa.Column("source_id", sa.String(length=80), nullable=True),
        sa.Column("meta", sa.JSON(), server_default=sa.text("'{}'::json"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("xp_amount >= 0", name="ck_reward_events_xp_amount"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "event_key", name="uq_reward_event_user_key"),
    )
    op.create_index("ix_reward_events_event_type", "reward_events", ["event_type"], unique=False)
    op.create_index("ix_reward_events_user_id", "reward_events", ["user_id"], unique=False)
    op.create_index(
        "ix_reward_events_user_type_created",
        "reward_events",
        ["user_id", "event_type", "created_at"],
        unique=False,
    )

    op.create_table(
        "user_achievements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("achievement_id", sa.String(length=80), nullable=False),
        sa.Column("progress", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("target", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(), nullable=True),
        sa.Column("reward_event_id", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("progress >= 0", name="ck_user_achievements_progress"),
        sa.CheckConstraint("target >= 1", name="ck_user_achievements_target"),
        sa.ForeignKeyConstraint(["achievement_id"], ["achievements.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reward_event_id"], ["reward_events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )
    op.create_index(
        "ix_user_achievements_achievement_id",
        "user_achievements",
        ["achievement_id"],
        unique=False,
    )
    op.create_index(
        "ix_user_achievements_reward_event_id",
        "user_achievements",
        ["reward_event_id"],
        unique=False,
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"], unique=False)

    op.create_table(
        "user_quest_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("quest_id", sa.String(length=80), nullable=False),
        sa.Column("period_key", sa.String(length=32), nullable=False),
        sa.Column("progress", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("target", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("status", sa.String(length=24), server_default=sa.text("'active'"), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("reward_event_id", sa.Integer(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("progress >= 0", name="ck_user_quest_progress_progress"),
        sa.CheckConstraint("target >= 1", name="ck_user_quest_progress_target"),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'empty')",
            name="ck_user_quest_progress_status",
        ),
        sa.ForeignKeyConstraint(["quest_id"], ["quests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reward_event_id"], ["reward_events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "quest_id", "period_key", name="uq_user_quest_period"),
    )
    op.create_index("ix_user_quest_progress_period_key", "user_quest_progress", ["period_key"], unique=False)
    op.create_index("ix_user_quest_progress_quest_id", "user_quest_progress", ["quest_id"], unique=False)
    op.create_index(
        "ix_user_quest_progress_reward_event_id",
        "user_quest_progress",
        ["reward_event_id"],
        unique=False,
    )
    op.create_index("ix_user_quest_progress_user_id", "user_quest_progress", ["user_id"], unique=False)

    op.create_table(
        "xp_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("habit_id", sa.Integer(), nullable=False),
        sa.Column("completion_id", sa.Integer(), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("xp_amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("xp_amount >= 0", name="ck_xp_history_xp_amount"),
        sa.CheckConstraint(
            "reason IN ('completed_on_time', 'recovery_completed')",
            name="ck_xp_history_reason",
        ),
        sa.ForeignKeyConstraint(["completion_id"], ["habit_entries.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "habit_id", "entry_date", name="uq_xp_history_habit_day"),
    )
    op.create_index("ix_xp_history_completion_id", "xp_history", ["completion_id"], unique=False)
    op.create_index("ix_xp_history_entry_date", "xp_history", ["entry_date"], unique=False)
    op.create_index("ix_xp_history_habit_id", "xp_history", ["habit_id"], unique=False)
    op.create_index("ix_xp_history_user_id", "xp_history", ["user_id"], unique=False)
    op.create_index(
        "ix_xp_history_user_created",
        "xp_history",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_xp_history_user_created", table_name="xp_history")
    op.drop_index("ix_xp_history_user_id", table_name="xp_history")
    op.drop_index("ix_xp_history_habit_id", table_name="xp_history")
    op.drop_index("ix_xp_history_entry_date", table_name="xp_history")
    op.drop_index("ix_xp_history_completion_id", table_name="xp_history")
    op.drop_table("xp_history")

    op.drop_index("ix_user_quest_progress_user_id", table_name="user_quest_progress")
    op.drop_index("ix_user_quest_progress_reward_event_id", table_name="user_quest_progress")
    op.drop_index("ix_user_quest_progress_quest_id", table_name="user_quest_progress")
    op.drop_index("ix_user_quest_progress_period_key", table_name="user_quest_progress")
    op.drop_table("user_quest_progress")

    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_index("ix_user_achievements_reward_event_id", table_name="user_achievements")
    op.drop_index("ix_user_achievements_achievement_id", table_name="user_achievements")
    op.drop_table("user_achievements")

    op.drop_index("ix_reward_events_user_type_created", table_name="reward_events")
    op.drop_index("ix_reward_events_user_id", table_name="reward_events")
    op.drop_index("ix_reward_events_event_type", table_name="reward_events")
    op.drop_table("reward_events")
    op.drop_table("quests")
    op.drop_table("achievements")
    op.drop_table("user_gamification_profiles")

    op.drop_index("ix_recommendations_user_read_created", table_name="recommendations")
    op.drop_index("ix_recommendations_user_id", table_name="recommendations")
    op.drop_index("ix_recommendations_prediction_id", table_name="recommendations")
    op.drop_index("ix_recommendations_habit_id", table_name="recommendations")
    op.drop_table("recommendations")

    op.drop_index("ix_predictions_user_id", table_name="predictions")
    op.drop_index("ix_predictions_predicted_for", table_name="predictions")
    op.drop_index("ix_predictions_habit_id", table_name="predictions")
    op.drop_table("predictions")

    op.drop_index("ix_habit_entries_user_date", table_name="habit_entries")
    op.drop_index("ix_habit_entries_user_id", table_name="habit_entries")
    op.drop_index("ix_habit_entries_habit_id", table_name="habit_entries")
    op.drop_index("ix_habit_entries_entry_date", table_name="habit_entries")
    op.drop_table("habit_entries")

    op.drop_index("ix_habits_user_active_created", table_name="habits")
    op.drop_index("ix_habits_user_id", table_name="habits")
    op.drop_table("habits")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
