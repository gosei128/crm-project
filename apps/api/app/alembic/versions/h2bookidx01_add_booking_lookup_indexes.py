"""add booking lookup indexes (slot_start, status, customer_id)

Revision ID: h2bookidx01
Revises: g1gcash01
Create Date: 2026-09-15

Covers the owner day-range + status queries and customer lookups that
previously seq-scanned at scale. The race-guard partial unique index is
untouched.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h2bookidx01'
down_revision: Union[str, Sequence[str], None] = 'g1gcash01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('ix_bookings_slot_start', 'bookings', ['slot_start'], unique=False)
    op.create_index('ix_bookings_status', 'bookings', ['status'], unique=False)
    op.create_index('ix_bookings_customer', 'bookings', ['customer_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_bookings_customer', table_name='bookings')
    op.drop_index('ix_bookings_status', table_name='bookings')
    op.drop_index('ix_bookings_slot_start', table_name='bookings')
