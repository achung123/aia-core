"""add is_active to game_players

Revision ID: 2b5508c850b1
Revises: a66a763724a3
Create Date: 2026-04-12 10:15:57.502880

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b5508c850b1'
down_revision: Union[str, Sequence[str], None] = 'a66a763724a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')
            )
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('game_players', schema=None) as batch_op:
        batch_op.drop_column('is_active')
