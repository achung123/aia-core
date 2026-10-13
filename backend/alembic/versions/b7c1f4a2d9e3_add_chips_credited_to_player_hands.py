"""add chips_credited to player_hands

Revision ID: b7c1f4a2d9e3
Revises: 82e125bf0e2b
Create Date: 2026-10-13 21:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c1f4a2d9e3'
down_revision: Union[str, Sequence[str], None] = '82e125bf0e2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('chips_credited', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.drop_column('chips_credited')
