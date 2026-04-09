"""make_flop_columns_nullable

Revision ID: d4f8f94d4080
Revises: 9a2de4cde190
Create Date: 2026-04-09 01:17:02.103077

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4f8f94d4080'
down_revision: Union[str, Sequence[str], None] = '9a2de4cde190'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.alter_column('flop_1',
               existing_type=sa.VARCHAR(),
               nullable=True)
        batch_op.alter_column('flop_2',
               existing_type=sa.VARCHAR(),
               nullable=True)
        batch_op.alter_column('flop_3',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.alter_column('flop_3',
               existing_type=sa.VARCHAR(),
               nullable=False)
        batch_op.alter_column('flop_2',
               existing_type=sa.VARCHAR(),
               nullable=False)
        batch_op.alter_column('flop_1',
               existing_type=sa.VARCHAR(),
               nullable=False)
