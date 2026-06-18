"""Remove unused user lives field.

Revision ID: 202606140001
Revises: 202606020001
Create Date: 2026-06-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202606140001"
down_revision: Union[str, Sequence[str], None] = "202606020001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    constraints = {constraint["name"] for constraint in inspector.get_check_constraints("users")}

    if "ck_users_lives_non_negative" in constraints:
        op.drop_constraint("ck_users_lives_non_negative", "users", type_="check")
    if "lives" in columns:
        op.drop_column("users", "lives")


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    constraints = {constraint["name"] for constraint in inspector.get_check_constraints("users")}

    if "lives" in columns:
        return

    op.add_column(
        "users",
        sa.Column("lives", sa.Integer(), server_default=sa.text("5"), nullable=False),
    )
    if "ck_users_lives_non_negative" not in constraints:
        op.create_check_constraint("ck_users_lives_non_negative", "users", "lives >= 0")
