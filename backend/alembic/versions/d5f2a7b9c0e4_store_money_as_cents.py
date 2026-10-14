"""store money as whole cents

Revision ID: d5f2a7b9c0e4
Revises: c3d9e8a1f5b2
Create Date: 2026-10-14 22:30:00.000000

Money columns were floats (0.1 + 0.2 != 0.3, pots of 0.30000000000000004).
They become integer cents. The application layer converts, so the API still
speaks dollars.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f2a7b9c0e4'
down_revision: Union[str, Sequence[str], None] = 'c3d9e8a1f5b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONEY_COLUMNS: dict[str, list[tuple[str, bool]]] = {
    # table: [(column, nullable)]
    'game_sessions': [
        ('small_blind', False),
        ('big_blind', False),
        ('default_buy_in', True),
    ],
    'game_players': [('buy_in', True), ('current_chips', True)],
    'hands': [('pot', False), ('small_blind', True), ('big_blind', True)],
    'player_hands': [('profit_loss', True), ('chips_credited', True)],
    'player_hand_actions': [('amount', True)],
    'rebuys': [('amount', False)],
    'chip_adjustments': [('delta', False), ('chips_after', False)],
}


def _convert(factor_sql: str, target_type: sa.types.TypeEngine) -> None:
    connection = op.get_bind()
    for table, columns in MONEY_COLUMNS.items():
        for column, _nullable in columns:
            connection.execute(
                sa.text(
                    f'UPDATE {table} SET {column} = {factor_sql.format(c=column)} '
                    f'WHERE {column} IS NOT NULL'
                )
            )
        with op.batch_alter_table(table, schema=None) as batch_op:
            for column, nullable in columns:
                batch_op.alter_column(
                    column, existing_nullable=nullable, type_=target_type
                )


def upgrade() -> None:
    """Upgrade schema: dollars (float) -> cents (integer)."""
    _convert('CAST(ROUND({c} * 100) AS INTEGER)', sa.Integer())


def downgrade() -> None:
    """Downgrade schema: cents (integer) -> dollars (float)."""
    _convert('{c} / 100.0', sa.Float())
