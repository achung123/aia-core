"""add position_confidence and image dimensions

Revision ID: aeb59dd31b92
Revises: 9a2de4cde190
Create Date: 2026-03-21 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aeb59dd31b92'
down_revision: Union[str, Sequence[str], None] = '9a2de4cde190'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add position_confidence to card_detections and image dimensions to image_uploads."""
    op.add_column(
        'card_detections',
        sa.Column('position_confidence', sa.String(), nullable=True),
    )
    op.add_column(
        'image_uploads',
        sa.Column('image_width', sa.Integer(), nullable=True),
    )
    op.add_column(
        'image_uploads',
        sa.Column('image_height', sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    """Remove position_confidence and image dimension columns."""
    op.drop_column('image_uploads', 'image_height')
    op.drop_column('image_uploads', 'image_width')
    op.drop_column('card_detections', 'position_confidence')
