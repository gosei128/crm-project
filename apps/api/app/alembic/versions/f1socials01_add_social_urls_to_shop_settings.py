"""add facebook_url + tiktok_url to shop_settings

Revision ID: f1socials01
Revises: e9heroimage1
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1socials01'
down_revision: Union[str, Sequence[str], None] = 'e9heroimage1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'shop_settings',
        sa.Column('facebook_url', sa.String(), nullable=True),
    )
    op.add_column(
        'shop_settings',
        sa.Column('tiktok_url', sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('shop_settings', 'tiktok_url')
    op.drop_column('shop_settings', 'facebook_url')
