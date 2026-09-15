"""add booking completed_at for ticket expiry

Revision ID: j5comp01
Revises: i4refcode01
Create Date: 2026-09-15

Records when the owner marked the haircut done so guest lookup can stop
resolving tickets N days after completion. Existing complete rows are
backfilled with slot_end (best available approximation).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5comp01'
down_revision: Union[str, Sequence[str], None] = 'i4refcode01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'bookings',
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE bookings SET completed_at = slot_end "
            "WHERE status = 'complete' AND completed_at IS NULL"
        )
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('bookings', 'completed_at')
