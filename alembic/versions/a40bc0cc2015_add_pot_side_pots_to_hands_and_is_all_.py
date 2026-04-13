"""add pot side_pots to hands and is_all_in to player_hands

Revision ID: a40bc0cc2015
Revises: e08af6081a61
Create Date: 2026-04-12 23:53:57.935100

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a40bc0cc2015'
down_revision: Union[str, Sequence[str], None] = 'e08af6081a61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('pot', sa.Float(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('side_pots', sa.String(), nullable=False, server_default='[]'))

    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_all_in', sa.Boolean(), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.drop_column('is_all_in')

    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.drop_column('side_pots')
        batch_op.drop_column('pot')
