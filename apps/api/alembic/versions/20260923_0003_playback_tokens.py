"""add signed playback token records

Revision ID: 20260923_0003
Revises: 20260921_0002
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260923_0003"
down_revision: str | None = "20260921_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "playback_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["viewing_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_playback_tokens_session_id", "playback_tokens", ["session_id"])
    op.create_index("ix_playback_tokens_token_hash", "playback_tokens", ["token_hash"])
    op.create_index("ix_playback_tokens_expires_at", "playback_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_playback_tokens_expires_at", table_name="playback_tokens")
    op.drop_index("ix_playback_tokens_token_hash", table_name="playback_tokens")
    op.drop_index("ix_playback_tokens_session_id", table_name="playback_tokens")
    op.drop_table("playback_tokens")
