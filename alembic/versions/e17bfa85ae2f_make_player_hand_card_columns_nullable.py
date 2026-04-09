"""make player_hand card columns nullable

Revision ID: e17bfa85ae2f
Revises: d4f8f94d4080
Create Date: 2026-04-09 02:19:42.381052

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e17bfa85ae2f'
down_revision: Union[str, Sequence[str], None] = 'd4f8f94d4080'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.alter_column('card_1',
               existing_type=sa.VARCHAR(),
               nullable=True)
        batch_op.alter_column('card_2',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.alter_column('card_2',
               existing_type=sa.VARCHAR(),
               nullable=False)
        batch_op.alter_column('card_1',
               existing_type=sa.VARCHAR(),
               nullable=False)
