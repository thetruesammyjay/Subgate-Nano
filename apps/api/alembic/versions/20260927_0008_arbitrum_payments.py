"""persist Arbitrum stream registrations and settlement references

Revision ID: 20260927_0008
Revises: 20260926_0007
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260927_0008"
down_revision: str | None = "20260926_0007"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("streams", sa.Column("chain_id", sa.Integer(), nullable=True))
    op.add_column("streams", sa.Column("chain_stream_id", sa.String(length=66), nullable=True))
    op.add_column("streams", sa.Column("registry_tx_hash", sa.String(length=66), nullable=True))
    op.create_unique_constraint("uq_streams_chain_stream_id", "streams", ["chain_stream_id"])
    op.create_unique_constraint("uq_streams_registry_tx_hash", "streams", ["registry_tx_hash"])

    op.add_column("payments", sa.Column("chain_id", sa.Integer(), nullable=True))
    op.add_column("payments", sa.Column("receipt_tx_hash", sa.String(length=66), nullable=True))
    op.create_unique_constraint("uq_payments_receipt_tx_hash", "payments", ["receipt_tx_hash"])


def downgrade() -> None:
    op.drop_constraint("uq_payments_receipt_tx_hash", "payments", type_="unique")
    op.drop_column("payments", "receipt_tx_hash")
    op.drop_column("payments", "chain_id")

    op.drop_constraint("uq_streams_registry_tx_hash", "streams", type_="unique")
    op.drop_constraint("uq_streams_chain_stream_id", "streams", type_="unique")
    op.drop_column("streams", "registry_tx_hash")
    op.drop_column("streams", "chain_stream_id")
    op.drop_column("streams", "chain_id")
