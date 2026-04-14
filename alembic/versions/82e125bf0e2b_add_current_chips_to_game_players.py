"""add current_chips to game_players

Revision ID: 82e125bf0e2b
Revises: a0f7c6c82d0f
Create Date: 2026-04-13 21:41:22.695348

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82e125bf0e2b'
down_revision: Union[str, Sequence[str], None] = 'a0f7c6c82d0f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.add_column(sa.Column('current_chips', sa.Float(), nullable=True))

    # Backfill: set current_chips = buy_in for all existing rows where buy_in is set
    op.execute('UPDATE game_players SET current_chips = buy_in WHERE buy_in IS NOT NULL AND current_chips IS NULL')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.drop_column('current_chips')
