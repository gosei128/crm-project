"""add gcash payment fields to shop_settings

Revision ID: g1gcash01
Revises: f1socials01
Create Date: 2026-09-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1gcash01'
down_revision: Union[str, Sequence[str], None] = 'f1socials01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'shop_settings',
        sa.Column('gcash_number', sa.String(), nullable=True),
    )
    op.add_column(
        'shop_settings',
        sa.Column('gcash_account_name', sa.String(), nullable=True),
    )
    op.add_column(
        'shop_settings',
        sa.Column('gcash_qr_url', sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('shop_settings', 'gcash_qr_url')
    op.drop_column('shop_settings', 'gcash_account_name')
    op.drop_column('shop_settings', 'gcash_number')
