"""Restrict habit frequency values.

Revision ID: 202606180001
Revises: 202606140001
Create Date: 2026-06-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606180001"
down_revision: Union[str, Sequence[str], None] = "202606140001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    constraints = {constraint["name"] for constraint in inspector.get_check_constraints("habits")}

    if "ck_habits_frequency_type" in constraints:
        op.drop_constraint("ck_habits_frequency_type", "habits", type_="check")
    op.execute("UPDATE habits SET frequency_type = 'custom' WHERE frequency_type = 'weekly'")
    op.create_check_constraint(
        "ck_habits_frequency_type",
        "habits",
        "frequency_type IN ('daily', 'custom')",
    )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    constraints = {constraint["name"] for constraint in inspector.get_check_constraints("habits")}

    if "ck_habits_frequency_type" in constraints:
        op.drop_constraint("ck_habits_frequency_type", "habits", type_="check")
    op.create_check_constraint(
        "ck_habits_frequency_type",
        "habits",
        "frequency_type IN ('daily', 'weekly', 'custom')",
    )
