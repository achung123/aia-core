"""add buy_in to game_players

Revision ID: 447f9697b2f2
Revises: ec0a5fb26dc7
Create Date: 2026-04-12 10:53:40.977887

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '447f9697b2f2'
down_revision: Union[str, Sequence[str], None] = 'ec0a5fb26dc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.add_column(sa.Column('buy_in', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.drop_column('buy_in')
