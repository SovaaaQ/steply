"""Normalize legacy gamification goal names.

Revision ID: 202605270001
Revises: 202605210001
Create Date: 2026-05-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202605270001"
down_revision: Union[str, Sequence[str], None] = "202605210001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "quests" in tables and "goals" not in tables:
        op.rename_table("quests", "goals")
        tables.remove("quests")
        tables.add("goals")

    if "user_quest_progress" in tables and "user_goal_progress" not in tables:
        op.rename_table("user_quest_progress", "user_goal_progress")
        tables.remove("user_quest_progress")
        tables.add("user_goal_progress")

    if "user_goal_progress" in tables:
        _rename_column_if_exists("user_goal_progress", "quest_id", "goal_id")

    _rename_constraints(
        {
            "goals": {
                "ck_quests_type": "ck_goals_type",
                "ck_quests_target": "ck_goals_target",
                "ck_quests_reward_xp": "ck_goals_reward_xp",
                "ck_quests_sort_order": "ck_goals_sort_order",
            },
            "user_goal_progress": {
                "uq_user_quest_period": "uq_user_goal_period",
                "ck_user_quest_progress_progress": "ck_user_goal_progress_progress",
                "ck_user_quest_progress_target": "ck_user_goal_progress_target",
                "ck_user_quest_progress_status": "ck_user_goal_progress_status",
            },
        }
    )
    _rename_indexes(
        {
            "ix_user_quest_progress_period_key": "ix_user_goal_progress_period_key",
            "ix_user_quest_progress_quest_id": "ix_user_goal_progress_goal_id",
            "ix_user_quest_progress_reward_event_id": "ix_user_goal_progress_reward_event_id",
            "ix_user_quest_progress_user_id": "ix_user_goal_progress_user_id",
        }
    )
    _sync_reward_event_goal_names()


def downgrade() -> None:
    # The previous revision now represents the normalized goals schema for fresh databases.
    # Downgrading should keep that normalized shape instead of restoring legacy names.
    return


def _rename_column_if_exists(table_name: str, old_name: str, new_name: str) -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns(table_name)}
    if old_name in columns and new_name not in columns:
        op.alter_column(
            table_name,
            old_name,
            new_column_name=new_name,
            existing_type=sa.String(length=80),
            existing_nullable=False,
        )


def _rename_constraints(table_to_names: dict[str, dict[str, str]]) -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for table_name, names in table_to_names.items():
        for old_name, new_name in names.items():
            if _constraint_exists(old_name) and not _constraint_exists(new_name):
                op.execute(
                    sa.text(
                        f'ALTER TABLE "{table_name}" '
                        f'RENAME CONSTRAINT "{old_name}" TO "{new_name}"'
                    )
                )


def _rename_indexes(names: dict[str, str]) -> None:
    if op.get_bind().dialect.name != "postgresql":
        return

    for old_name, new_name in names.items():
        if _index_exists(old_name) and not _index_exists(new_name):
            op.execute(sa.text(f'ALTER INDEX "{old_name}" RENAME TO "{new_name}"'))


def _constraint_exists(name: str) -> bool:
    return bool(
        op.get_bind().execute(
            sa.text("SELECT 1 FROM pg_constraint WHERE conname = :name"),
            {"name": name},
        ).first()
    )


def _index_exists(name: str) -> bool:
    return bool(
        op.get_bind().execute(
            sa.text("SELECT 1 FROM pg_class WHERE relkind = 'i' AND relname = :name"),
            {"name": name},
        ).first()
    )


def _sync_reward_event_goal_names() -> None:
    if not _table_exists("reward_events"):
        return

    op.execute(
        sa.text(
            """
            UPDATE reward_events
            SET event_type = 'goal_completed'
            WHERE event_type = 'quest_completed'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE reward_events
            SET event_key = replace(event_key, 'quest:', 'goal:')
            WHERE event_key LIKE 'quest:%'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE reward_events
            SET source_type = 'goal'
            WHERE source_type = 'quest'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE reward_events
            SET description = replace(description, 'Задание:', 'Цель:')
            WHERE description LIKE 'Задание:%'
            """
        )
    )


def _table_exists(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()
