"""add blind snapshot to hands and chip_adjustments table

Revision ID: c3d9e8a1f5b2
Revises: b7c1f4a2d9e3
Create Date: 2026-10-13 22:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d9e8a1f5b2'
down_revision: Union[str, Sequence[str], None] = 'b7c1f4a2d9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('small_blind', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('big_blind', sa.Float(), nullable=True))
    op.create_table(
        'chip_adjustments',
        sa.Column('adjustment_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('game_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('delta', sa.Float(), nullable=False),
        sa.Column('chips_after', sa.Float(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['game_id'], ['game_sessions.game_id']),
        sa.ForeignKeyConstraint(['player_id'], ['players.player_id']),
        sa.PrimaryKeyConstraint('adjustment_id'),
    )
    with op.batch_alter_table('chip_adjustments', schema=None) as batch_op:
        batch_op.create_index('ix_chip_adjustments_game_id', ['game_id'])
        batch_op.create_index('ix_chip_adjustments_player_id', ['player_id'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('chip_adjustments', schema=None) as batch_op:
        batch_op.drop_index('ix_chip_adjustments_player_id')
        batch_op.drop_index('ix_chip_adjustments_game_id')
    op.drop_table('chip_adjustments')
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.drop_column('big_blind')
        batch_op.drop_column('small_blind')
