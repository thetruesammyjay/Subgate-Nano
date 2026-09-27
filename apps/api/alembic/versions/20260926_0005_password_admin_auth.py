"""add creator credentials and admin authentication

Revision ID: 20260926_0005
Revises: 20260926_0004
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0005"
down_revision: str | None = "20260926_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("creators", "wallet_address", existing_type=sa.String(length=42), nullable=True)
    op.add_column("creators", sa.Column("email", sa.String(length=320), nullable=True))
    op.add_column("creators", sa.Column("username", sa.String(length=40), nullable=True))
    op.add_column("creators", sa.Column("password_hash", sa.String(length=512), nullable=True))
    op.add_column("creators", sa.Column("social_links", sa.JSON(), nullable=True))
    op.create_index("ix_creators_email", "creators", ["email"], unique=True)
    op.create_index("ix_creators_username", "creators", ["username"], unique=True)

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("username", sa.String(length=40), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"])
    op.create_index("ix_admin_users_username", "admin_users", ["username"])
    op.create_index("ix_admin_users_is_active", "admin_users", ["is_active"])

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("admin_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_admin_sessions_admin_id", "admin_sessions", ["admin_id"])
    op.create_index("ix_admin_sessions_token_hash", "admin_sessions", ["token_hash"])
    op.create_index("ix_admin_sessions_expires_at", "admin_sessions", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_sessions_expires_at", table_name="admin_sessions")
    op.drop_index("ix_admin_sessions_token_hash", table_name="admin_sessions")
    op.drop_index("ix_admin_sessions_admin_id", table_name="admin_sessions")
    op.drop_table("admin_sessions")
    op.drop_index("ix_admin_users_is_active", table_name="admin_users")
    op.drop_index("ix_admin_users_username", table_name="admin_users")
    op.drop_index("ix_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")
    op.drop_index("ix_creators_username", table_name="creators")
    op.drop_index("ix_creators_email", table_name="creators")
    op.drop_column("creators", "social_links")
    op.drop_column("creators", "password_hash")
    op.drop_column("creators", "username")
    op.drop_column("creators", "email")
    op.alter_column("creators", "wallet_address", existing_type=sa.String(length=42), nullable=False)
