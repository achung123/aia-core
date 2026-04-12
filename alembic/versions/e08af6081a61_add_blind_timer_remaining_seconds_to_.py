"""add blind_timer_remaining_seconds to game_sessions

Revision ID: e08af6081a61
Revises: 72219689ea6b
Create Date: 2026-04-12 12:32:41.393575

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e08af6081a61'
down_revision: Union[str, Sequence[str], None] = '72219689ea6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('blind_timer_remaining_seconds', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.drop_column('blind_timer_remaining_seconds')
