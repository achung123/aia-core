"""add player_hand_actions table

Revision ID: 4d88a1c3a8d4
Revises: 2b5508c850b1
Create Date: 2026-04-12 10:26:03.315139

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d88a1c3a8d4'
down_revision: Union[str, Sequence[str], None] = '2b5508c850b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('player_hand_actions',
    sa.Column('action_id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('player_hand_id', sa.Integer(), nullable=False),
    sa.Column('street', sa.String(), nullable=False),
    sa.Column('action', sa.String(), nullable=False),
    sa.Column('amount', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text("(strftime('%Y-%m-%dT%H:%M:%f', 'now'))"), nullable=True),
    sa.ForeignKeyConstraint(['player_hand_id'], ['player_hands.player_hand_id'], ),
    sa.PrimaryKeyConstraint('action_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('player_hand_actions')
