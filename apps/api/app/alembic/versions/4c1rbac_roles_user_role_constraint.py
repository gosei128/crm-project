"""enforce user roles via check constraint (owner/customer)

Revision ID: 4c1rbac_roles
Revises: single_shop
Create Date: 2026-09-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c1rbac_roles'
down_revision: Union[str, Sequence[str], None] = 'single_shop'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Backfill any legacy/unexpected roles to customer before enforcing.
    op.execute(
        sa.text("UPDATE users SET role = 'customer' WHERE role NOT IN ('owner', 'customer')")
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('owner', 'customer')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_users_role", "users", type_="check")
