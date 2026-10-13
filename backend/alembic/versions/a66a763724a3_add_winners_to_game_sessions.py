"""add_winners_to_game_sessions

Revision ID: a66a763724a3
Revises: dc95e3fa7728
Create Date: 2026-04-09 17:24:32.091735

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a66a763724a3'
down_revision: Union[str, Sequence[str], None] = 'dc95e3fa7728'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('winners', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.drop_column('winners')
