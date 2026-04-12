"""add blind fields to game_sessions

Revision ID: e1cc346116d4
Revises: 52d3d811056e
Create Date: 2026-04-12 10:40:24.893475

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1cc346116d4'
down_revision: Union[str, Sequence[str], None] = '52d3d811056e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('small_blind', sa.Float(), nullable=False, server_default='0.1')
        )
        batch_op.add_column(
            sa.Column('big_blind', sa.Float(), nullable=False, server_default='0.2')
        )
        batch_op.add_column(
            sa.Column(
                'blind_timer_minutes', sa.Integer(), nullable=False, server_default='15'
            )
        )
        batch_op.add_column(
            sa.Column(
                'blind_timer_paused',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('0'),
            )
        )
        batch_op.add_column(
            sa.Column('blind_timer_started_at', sa.DateTime(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_sessions', schema=None) as batch_op:
        batch_op.drop_column('blind_timer_started_at')
        batch_op.drop_column('blind_timer_paused')
        batch_op.drop_column('blind_timer_minutes')
        batch_op.drop_column('big_blind')
        batch_op.drop_column('small_blind')
