"""add default_buy_in to game_sessions

Revision ID: 8e1b3886b210
Revises: a40bc0cc2015
Create Date: 2026-04-13 07:49:26.678696

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8e1b3886b210'
down_revision: Union[str, Sequence[str], None] = 'a40bc0cc2015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_buy_in', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.drop_column('default_buy_in')
