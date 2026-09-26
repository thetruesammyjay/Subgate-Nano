"""create streaming core tables

Revision ID: 20260921_0001
Revises:
Create Date: 2026-09-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "creators",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wallet_address", sa.String(length=42), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("wallet_address"),
    )
    op.create_index("ix_creators_wallet_address", "creators", ["wallet_address"])
    op.create_table(
        "streams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("creator_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("stream_type", sa.String(length=16), nullable=False),
        sa.Column("pricing_model", sa.String(length=24), nullable=False),
        sa.Column("price_atomic", sa.Integer(), nullable=True),
        sa.Column("rate_atomic_per_minute", sa.Integer(), nullable=True),
        sa.Column("free_preview_seconds", sa.Integer(), nullable=False),
        sa.Column("playback_url", sa.String(length=2048), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["creator_id"], ["creators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_streams_creator_id", "streams", ["creator_id"])
    op.create_index("ix_streams_is_published", "streams", ["is_published"])
    op.create_index("ix_streams_slug", "streams", ["slug"])
    op.create_table(
        "viewing_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("stream_id", sa.Uuid(), nullable=False),
        sa.Column("viewer_wallet", sa.String(length=42), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("max_spend_atomic", sa.Integer(), nullable=True),
        sa.Column("consumed_seconds", sa.Integer(), nullable=False),
        sa.Column("accrued_atomic", sa.Integer(), nullable=False),
        sa.Column("settled_atomic", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["stream_id"], ["streams.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_viewing_sessions_stream_id", "viewing_sessions", ["stream_id"])
    op.create_index("ix_viewing_sessions_viewer_wallet", "viewing_sessions", ["viewer_wallet"])
    op.create_index("ix_viewing_sessions_status", "viewing_sessions", ["status"])
    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("amount_atomic", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("transaction_reference", sa.String(length=255), nullable=False),
        sa.Column("settled_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["viewing_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", name="payments_session_id_key"),
        sa.UniqueConstraint("transaction_reference"),
    )
    op.create_index("ix_payments_session_id", "payments", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_session_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_viewing_sessions_status", table_name="viewing_sessions")
    op.drop_index("ix_viewing_sessions_viewer_wallet", table_name="viewing_sessions")
    op.drop_index("ix_viewing_sessions_stream_id", table_name="viewing_sessions")
    op.drop_table("viewing_sessions")
    op.drop_index("ix_streams_slug", table_name="streams")
    op.drop_index("ix_streams_is_published", table_name="streams")
    op.drop_index("ix_streams_creator_id", table_name="streams")
    op.drop_table("streams")
    op.drop_index("ix_creators_wallet_address", table_name="creators")
    op.drop_table("creators")
