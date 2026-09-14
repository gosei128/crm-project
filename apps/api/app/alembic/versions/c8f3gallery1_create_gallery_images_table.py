"""create gallery_images table + seed sample showcase photos

Revision ID: c8f3gallery1
Revises: 5f6fb_oauth_columns
Create Date: 2026-09-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f3gallery1'
down_revision: Union[str, Sequence[str], None] = '5f6fb_oauth_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SAMPLES = [
    ("/samples/sample-1.jpg", "Classic taper fade", 0),
    ("/samples/sample-2.jpg", "Skin fade with textured top", 1),
    ("/samples/sample-3.jpg", "Scissor cut, natural finish", 2),
    ("/samples/sample-4.jpg", "Buzz cut with sharp lineup", 3),
    ("/samples/sample-5.jpg", "Pompadour with faded sides", 4),
    ("/samples/sample-6.jpg", "Crop cut, matte texture", 5),
    ("/samples/sample-7.jpg", "Beard trim and shape-up", 6),
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('gallery_images',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('image_url', sa.String(), nullable=False),
    sa.Column('alt', sa.String(), nullable=False, server_default=''),
    sa.Column('caption', sa.String(), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
    sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
    sa.PrimaryKeyConstraint('id')
    )
    for url, alt, order in SAMPLES:
        op.execute(
            sa.text(
                "INSERT INTO gallery_images (id, image_url, alt, caption, sort_order, created_at) "
                "VALUES (gen_random_uuid(), :url, :alt, :alt, :ord, NOW())"
            ).bindparams(url=url, alt=alt, ord=order)
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('gallery_images')
