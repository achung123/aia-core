"""add_fk_indexes_for_performance

Revision ID: 800ff4556264
Revises: 8e1b3886b210
Create Date: 2026-04-13 15:45:53.654097

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '800ff4556264'
down_revision: Union[str, Sequence[str], None] = '8e1b3886b210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_INDEXES = [
    ('ix_hands_game_id', 'hands', ['game_id']),
    ('ix_player_hands_hand_id', 'player_hands', ['hand_id']),
    ('ix_player_hands_player_id', 'player_hands', ['player_id']),
    (
        'ix_player_hand_actions_player_hand_id',
        'player_hand_actions',
        ['player_hand_id'],
    ),
    ('ix_hand_states_hand_id', 'hand_states', ['hand_id']),
    ('ix_game_players_game_id', 'game_players', ['game_id']),
    ('ix_game_players_player_id', 'game_players', ['player_id']),
    ('ix_image_uploads_game_id', 'image_uploads', ['game_id']),
    ('ix_card_detections_upload_id', 'card_detections', ['upload_id']),
    ('ix_rebuys_game_id', 'rebuys', ['game_id']),
]


def upgrade() -> None:
    """Add indexes on foreign-key columns for query performance."""
    for index_name, table_name, columns in _INDEXES:
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.create_index(index_name, columns)


def downgrade() -> None:
    """Remove foreign-key indexes."""
    for index_name, table_name, _columns in reversed(_INDEXES):
        with op.batch_alter_table(table_name) as batch_op:
            batch_op.drop_index(index_name)
