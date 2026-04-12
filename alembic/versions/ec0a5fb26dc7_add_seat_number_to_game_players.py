"""add seat_number to game_players

Revision ID: ec0a5fb26dc7
Revises: e1cc346116d4
Create Date: 2026-04-12 10:47:08.675822

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec0a5fb26dc7'
down_revision: Union[str, Sequence[str], None] = 'e1cc346116d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.add_column(sa.Column('seat_number', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.drop_column('seat_number')
