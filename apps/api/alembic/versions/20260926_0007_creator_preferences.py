"""add creator dashboard preferences

Revision ID: 20260926_0007
Revises: 20260926_0006
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0007"
down_revision: str | None = "20260926_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("creators", sa.Column("preferences", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("creators", "preferences")
