"""add creator review state and admin audit events

Revision ID: 20260926_0006
Revises: 20260926_0005
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0006"
down_revision: str | None = "20260926_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "creators",
        sa.Column("approval_status", sa.String(length=24), server_default="pending", nullable=False),
    )
    # Preserve access for creator accounts that existed before review was added.
    op.execute("UPDATE creators SET approval_status = 'approved'")

    op.create_table(
        "admin_audit_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_admin_id", sa.Uuid(), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_admin_id"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_audit_events_actor_admin_id", "admin_audit_events", ["actor_admin_id"])
    op.create_index("ix_admin_audit_events_event_type", "admin_audit_events", ["event_type"])
    op.create_index("ix_admin_audit_events_entity_type", "admin_audit_events", ["entity_type"])
    op.create_index("ix_admin_audit_events_entity_id", "admin_audit_events", ["entity_id"])
    op.create_index("ix_admin_audit_events_created_at", "admin_audit_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_audit_events_created_at", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_entity_id", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_entity_type", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_event_type", table_name="admin_audit_events")
    op.drop_index("ix_admin_audit_events_actor_admin_id", table_name="admin_audit_events")
    op.drop_table("admin_audit_events")
    op.drop_column("creators", "approval_status")
