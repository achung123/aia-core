"""rebuy_player_name_to_player_id_fk

Revision ID: a0f7c6c82d0f
Revises: 800ff4556264
Create Date: 2026-04-13 20:56:28.871837

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0f7c6c82d0f'
down_revision: Union[str, Sequence[str], None] = '800ff4556264'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Replace rebuys.player_name (string) with rebuys.player_id (FK to players)."""
    # Step 1: Add player_id column (nullable initially for data migration)
    with op.batch_alter_table('rebuys', schema=None) as batch_op:
        batch_op.add_column(sa.Column('player_id', sa.Integer(), nullable=True))

    # Step 2: Migrate existing data — look up player IDs by name
    conn = op.get_bind()
    conn.execute(
        sa.text(
            'UPDATE rebuys SET player_id = '
            '(SELECT player_id FROM players WHERE players.name = rebuys.player_name)'
        )
    )

    # Step 3: Recreate table with player_id NOT NULL + FK, drop player_name
    with op.batch_alter_table('rebuys', schema=None) as batch_op:
        batch_op.alter_column('player_id', nullable=False)
        batch_op.create_index(
            batch_op.f('ix_rebuys_player_id'), ['player_id'], unique=False
        )
        batch_op.create_foreign_key(
            'fk_rebuys_player_id', 'players', ['player_id'], ['player_id']
        )
        batch_op.drop_column('player_name')


def downgrade() -> None:
    """Restore rebuys.player_name from rebuys.player_id."""
    # Step 1: Add player_name back (nullable initially)
    with op.batch_alter_table('rebuys', schema=None) as batch_op:
        batch_op.add_column(sa.Column('player_name', sa.String(), nullable=True))

    # Step 2: Migrate data back — look up player names by ID
    conn = op.get_bind()
    conn.execute(
        sa.text(
            'UPDATE rebuys SET player_name = '
            '(SELECT name FROM players WHERE players.player_id = rebuys.player_id)'
        )
    )

    # Step 3: Make player_name NOT NULL, drop player_id + FK + index
    with op.batch_alter_table('rebuys', schema=None) as batch_op:
        batch_op.alter_column('player_name', nullable=False)
        batch_op.drop_constraint('fk_rebuys_player_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_rebuys_player_id'))
        batch_op.drop_column('player_id')
