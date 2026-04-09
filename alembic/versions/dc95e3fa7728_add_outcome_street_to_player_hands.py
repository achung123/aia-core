"""add outcome_street to player_hands

Revision ID: dc95e3fa7728
Revises: e17bfa85ae2f
Create Date: 2026-04-09 16:37:00.347669

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc95e3fa7728'
down_revision: Union[str, Sequence[str], None] = 'e17bfa85ae2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('outcome_street', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('player_hands', schema=None) as batch_op:
        batch_op.drop_column('outcome_street')
