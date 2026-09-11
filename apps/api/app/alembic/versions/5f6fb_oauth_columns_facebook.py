"""facebook oauth columns on users (facebook_id + nullable password_hash)

Revision ID: 5f6fb_oauth_columns
Revises: 4c1rbac_roles
Create Date: 2026-09-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f6fb_oauth_columns'
down_revision: Union[str, Sequence[str], None] = '4c1rbac_roles'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Facebook user ID: at most one local account per Facebook profile.
    # (Postgres unique constraints ignore NULLs, so this is a sparse unique.)
    op.add_column('users', sa.Column('facebook_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_facebook_id', 'users', ['facebook_id'])
    # OAuth-created users have no password.
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Requires no NULL password_hash rows (i.e. no OAuth-only users exist).
    op.alter_column('users', 'password_hash', existing_type=sa.String(), nullable=False)
    op.drop_constraint('uq_users_facebook_id', 'users', type_='unique')
    op.drop_column('users', 'facebook_id')
