"""Make timestamp columns timezone-aware.

Revision ID: 202606020001
Revises: 202605270001
Create Date: 2026-06-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606020001"
down_revision: Union[str, Sequence[str], None] = "202605270001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TIMESTAMP_COLUMNS: tuple[tuple[str, str, bool], ...] = (
    ("users", "created_at", False),
    ("habits", "created_at", False),
    ("habit_entries", "created_at", False),
    ("predictions", "created_at", False),
    ("recommendations", "created_at", False),
    ("user_gamification_profiles", "updated_at", False),
    ("achievements", "created_at", False),
    ("goals", "created_at", False),
    ("reward_events", "created_at", False),
    ("xp_history", "created_at", False),
    ("user_achievements", "unlocked_at", True),
    ("user_achievements", "updated_at", False),
    ("user_goal_progress", "completed_at", True),
    ("user_goal_progress", "updated_at", False),
)


def upgrade() -> None:
    for table_name, column_name, nullable in TIMESTAMP_COLUMNS:
        op.alter_column(
            table_name,
            column_name,
            existing_type=sa.DateTime(),
            type_=sa.DateTime(timezone=True),
            existing_nullable=nullable,
            postgresql_using=f"{column_name} AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    for table_name, column_name, nullable in TIMESTAMP_COLUMNS:
        op.alter_column(
            table_name,
            column_name,
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(),
            existing_nullable=nullable,
            postgresql_using=f"{column_name} AT TIME ZONE 'UTC'",
        )
