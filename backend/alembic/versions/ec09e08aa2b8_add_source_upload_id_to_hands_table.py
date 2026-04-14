"""add source_upload_id to hands table

Revision ID: ec09e08aa2b8
Revises: 11460bb0db95
Create Date: 2026-03-11 15:18:50.315740

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec09e08aa2b8'
down_revision: Union[str, Sequence[str], None] = '11460bb0db95'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source_upload_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_hands_source_upload_id',
            'image_uploads',
            ['source_upload_id'],
            ['upload_id'],
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('hands', schema=None) as batch_op:
        batch_op.drop_constraint('fk_hands_source_upload_id', type_='foreignkey')
        batch_op.drop_column('source_upload_id')
