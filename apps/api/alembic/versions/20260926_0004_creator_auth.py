"""add creator wallet authentication

Revision ID: 20260926_0004
Revises: 20260923_0003
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0004"
down_revision: str | None = "20260923_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "creator_auth_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wallet_address", sa.String(length=42), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_creator_auth_challenges_wallet_address", "creator_auth_challenges", ["wallet_address"])
    op.create_index("ix_creator_auth_challenges_expires_at", "creator_auth_challenges", ["expires_at"])

    op.create_table(
        "creator_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("creator_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_creator_sessions_creator_id", "creator_sessions", ["creator_id"])
    op.create_index("ix_creator_sessions_token_hash", "creator_sessions", ["token_hash"])
    op.create_index("ix_creator_sessions_expires_at", "creator_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_creator_sessions_expires_at", table_name="creator_sessions")
    op.drop_index("ix_creator_sessions_token_hash", table_name="creator_sessions")
    op.drop_index("ix_creator_sessions_creator_id", table_name="creator_sessions")
    op.drop_table("creator_sessions")
    op.drop_index("ix_creator_auth_challenges_expires_at", table_name="creator_auth_challenges")
    op.drop_index("ix_creator_auth_challenges_wallet_address", table_name="creator_auth_challenges")
    op.drop_table("creator_auth_challenges")
