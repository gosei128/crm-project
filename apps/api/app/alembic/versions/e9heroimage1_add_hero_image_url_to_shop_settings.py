"""add hero_image_url to shop_settings

Revision ID: e9heroimage1
Revises: c8f3gallery1
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9heroimage1'
down_revision: Union[str, Sequence[str], None] = 'c8f3gallery1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'shop_settings',
        sa.Column('hero_image_url', sa.String(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('shop_settings', 'hero_image_url')
