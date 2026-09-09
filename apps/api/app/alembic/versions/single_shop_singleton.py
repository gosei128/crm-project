"""single shop single haircut: make service owner_id nullable

Revision ID: single_shop
Revises: fd691dbc44d8
Create Date: 2026-09-04

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'single_shop'
down_revision: Union[str, Sequence[str], None] = 'fd691dbc44d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('services', 'owner_id', existing_type=sa.UUID(), nullable=True)


def downgrade() -> None:
    op.alter_column('services', 'owner_id', existing_type=sa.UUID(), nullable=False)
