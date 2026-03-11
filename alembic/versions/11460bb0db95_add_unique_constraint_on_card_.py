"""add unique constraint on card_detections upload_id card_position

Revision ID: 11460bb0db95
Revises: dcdc3e2657a6
Create Date: 2026-03-11 15:07:23.568480

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '11460bb0db95'
down_revision: Union[str, Sequence[str], None] = 'dcdc3e2657a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('card_detections', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_detection_upload_position', ['upload_id', 'card_position'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('card_detections', schema=None) as batch_op:
        batch_op.drop_constraint('uq_detection_upload_position', type_='unique')

