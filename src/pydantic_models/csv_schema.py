"""CSV schema definition and parser for poker hand data."""

from __future__ import annotations

import csv
import io
from collections import defaultdict

from pydantic_models.app_models import CardRank, CardSuit, ResultEnum

CSV_COLUMNS = [
    'game_date',
    'hand_number',
    'player_name',
    'hole_card_1',
    'hole_card_2',
    'flop_1',
    'flop_2',
    'flop_3',
    'turn',
    'river',
    'result',
    'profit_loss',
]

CSV_COLUMN_FORMATS = {
    'game_date': 'MM-DD-YYYY',
    'hand_number': 'integer',
    'player_name': 'string',
    'hole_card_1': 'card (e.g. AS, KH, 10D)',
    'hole_card_2': 'card (e.g. AS, KH, 10D)',
    'flop_1': 'card (e.g. AS, KH, 10D)',
    'flop_2': 'card (e.g. AS, KH, 10D)',
    'flop_3': 'card (e.g. AS, KH, 10D)',
    'turn': 'card or empty',
    'river': 'card or empty',
    'result': 'won | lost | folded',
    'profit_loss': 'decimal number',
}


REQUIRED_CARD_FIELDS = ['hole_card_1', 'hole_card_2']
FLOP_CARD_FIELDS = ['flop_1', 'flop_2', 'flop_3']
OPTIONAL_CARD_FIELDS = ['turn', 'river']

_VALID_RANKS = {r.value for r in CardRank}
_VALID_SUITS = {s.value for s in CardSuit}
_VALID_RESULTS = {r.value for r in ResultEnum}


def is_valid_card(card_str: str) -> bool:
    """Return True if card_str is a valid card token (e.g. 'AS', '10D')."""
    if not card_str:
        return False
    suit = card_str[-1]
    rank = card_str[:-1]
    return rank in _VALID_RANKS and suit in _VALID_SUITS


def validate_csv_rows(
    grouped: dict[tuple[str, str], list[dict[str, str]]],
) -> list[dict]:
    """Validate parsed CSV rows for card values and duplicates.

    Args:
        grouped: Output of parse_csv — rows keyed by (game_date, hand_number).

    Returns:
        List of error dicts with keys: row, field, value, message.
    """
    errors: list[dict] = []

    # Build a flat list with row numbers to report per-row errors.
    # Row index 2 = first data row (1-based, 1 = header).
    row_index = 2
    for (game_date, hand_number), rows in grouped.items():
        # Community card fields are shared across all player rows in a hand.
        # Hole card fields are unique per player.
        COMMUNITY_FIELDS = ['flop_1', 'flop_2', 'flop_3', 'turn', 'river']
        HOLE_FIELDS = ['hole_card_1', 'hole_card_2']

        # Cards to include in duplicate check: community once + each player's hole cards.
        hand_cards: list[str] = []
        community_added = False

        hand_row_start = row_index
        for row in rows:
            for field in REQUIRED_CARD_FIELDS:
                value = row.get(field, '').strip()
                if not is_valid_card(value):
                    errors.append(
                        {
                            'row': row_index,
                            'field': field,
                            'value': value,
                            'message': f'Invalid card value: {value}',
                        }
                    )

            # Flop cards: all 3 must be present or all 3 empty (preflop hand).
            flop_values = [row.get(f, '').strip() for f in FLOP_CARD_FIELDS]
            flop_present = [v for v in flop_values if v]
            if flop_present:
                # Some flop cards present — validate all 3
                for field in FLOP_CARD_FIELDS:
                    value = row.get(field, '').strip()
                    if not is_valid_card(value):
                        errors.append(
                            {
                                'row': row_index,
                                'field': field,
                                'value': value,
                                'message': f'Invalid card value: {value}',
                            }
                        )

            for field in OPTIONAL_CARD_FIELDS:
                value = row.get(field, '').strip()
                if value and not is_valid_card(value):
                    errors.append(
                        {
                            'row': row_index,
                            'field': field,
                            'value': value,
                            'message': f'Invalid card value: {value}',
                        }
                    )

            # Validate result against ResultEnum
            result_value = row.get('result', '').strip()
            if result_value and result_value not in _VALID_RESULTS:
                errors.append(
                    {
                        'row': row_index,
                        'field': 'result',
                        'value': result_value,
                        'message': (
                            f'Invalid result: {result_value}. '
                            f'Must be one of: {", ".join(sorted(_VALID_RESULTS))}'
                        ),
                    }
                )

            # Add community cards once (from first row) and hole cards per player.
            if not community_added:
                for field in COMMUNITY_FIELDS:
                    v = row.get(field, '').strip()
                    if is_valid_card(v):
                        hand_cards.append(v)
                community_added = True

            for field in HOLE_FIELDS:
                v = row.get(field, '').strip()
                if is_valid_card(v):
                    hand_cards.append(v)

            row_index += 1

        # Duplicate check across the whole hand
        seen: set[str] = set()
        for card in hand_cards:
            if card in seen:
                errors.append(
                    {
                        'row': hand_row_start,
                        'field': 'hand',
                        'value': card,
                        'message': (
                            f'Duplicate card {card} in hand '
                            f'(game_date={game_date}, hand_number={hand_number})'
                        ),
                    }
                )
                break
            seen.add(card)

    return errors


def parse_csv(csv_text: str) -> dict[tuple[str, str], list[dict[str, str]]]:
    """Parse CSV text and return rows grouped by (game_date, hand_number).

    Args:
        csv_text: Raw CSV content as a string (with headers).

    Returns:
        Dict mapping (game_date, hand_number) tuples to lists of row dicts.

    Raises:
        ValueError: If CSV headers don't match the expected schema.
    """
    reader = csv.reader(io.StringIO(csv_text))

    # Validate headers
    try:
        headers = next(reader)
    except StopIteration:
        return {}

    headers = [h.strip() for h in headers]
    if headers != CSV_COLUMNS:
        raise ValueError(f'Invalid CSV header. Expected {CSV_COLUMNS}, got {headers}')

    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)

    for row in reader:
        if not row or all(cell.strip() == '' for cell in row):
            continue
        row_dict = dict(zip(headers, row))
        key = (row_dict['game_date'], row_dict['hand_number'])
        grouped[key].append(row_dict)

    return dict(grouped)
