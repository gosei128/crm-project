"""add booking reference_code for guest lookup

Revision ID: i4refcode01
Revises: h2bookidx01
Create Date: 2026-09-15

Adds a short unique customer-facing code (8 chars, no ambiguous glyphs)
and backfills existing rows so every booking is lookable.
"""
import secrets
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i4refcode01'
down_revision: Union[str, Sequence[str], None] = 'h2bookidx01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate(existing: set[str]) -> str:
    while True:
        code = "".join(secrets.choice(_ALPHABET) for _ in range(8))
        if code not in existing:
            existing.add(code)
            return code


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'bookings',
        sa.Column('reference_code', sa.String(8), nullable=True),
    )
    # Backfill existing rows before the unique constraint lands.
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, reference_code FROM bookings")).fetchall()
    used = {r[1] for r in rows if r[1]}
    for row_id, code in rows:
        if not code:
            conn.execute(
                sa.text("UPDATE bookings SET reference_code = :code WHERE id = :id"),
                {"code": _generate(used), "id": str(row_id)},
            )
    op.create_unique_constraint('uq_bookings_reference_code', 'bookings', ['reference_code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_bookings_reference_code', 'bookings', type_='unique')
    op.drop_column('bookings', 'reference_code')
