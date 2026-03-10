"""CSV schema definition and parser for poker hand data."""

from __future__ import annotations

import csv
import io
from collections import defaultdict

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
    'result': 'win | loss | fold',
    'profit_loss': 'decimal number',
}


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
