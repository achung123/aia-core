"""Tests for CSV schema definition, parser, and schema endpoint."""

import csv
import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from pydantic_models.csv_schema import CSV_COLUMNS, CSV_COLUMN_FORMATS, parse_csv


client = TestClient(app)


# === CSV Schema Definition ===


class TestCSVSchema:
    def test_csv_columns_defined(self):
        expected = [
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
        assert CSV_COLUMNS == expected

    def test_csv_column_formats_defined(self):
        assert 'game_date' in CSV_COLUMN_FORMATS
        assert 'hand_number' in CSV_COLUMN_FORMATS
        assert 'hole_card_1' in CSV_COLUMN_FORMATS
        assert 'result' in CSV_COLUMN_FORMATS
        assert 'profit_loss' in CSV_COLUMN_FORMATS


# === CSV Parser ===


def _make_csv(rows: list[list[str]], headers: list[str] | None = None) -> str:
    """Helper to build CSV string content."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    if headers is not None:
        writer.writerow(headers)
    else:
        writer.writerow(CSV_COLUMNS)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue()


class TestCSVParser:
    def test_parse_valid_csv(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'win',
                    '50.0',
                ],
                [
                    '03-09-2026',
                    '1',
                    'Gil',
                    'JH',
                    'QD',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'loss',
                    '-50.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        # Should be grouped by (game_date, hand_number)
        assert ('03-09-2026', '1') in result
        entries = result[('03-09-2026', '1')]
        assert len(entries) == 2
        assert entries[0]['player_name'] == 'Adam'
        assert entries[1]['player_name'] == 'Gil'

    def test_parse_csv_multiple_hands(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'win',
                    '50.0',
                ],
                [
                    '03-09-2026',
                    '2',
                    'Adam',
                    'JS',
                    'QH',
                    '7C',
                    '8D',
                    '9S',
                    '10H',
                    'JC',
                    'loss',
                    '-30.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        assert len(result) == 2
        assert ('03-09-2026', '1') in result
        assert ('03-09-2026', '2') in result

    def test_parse_csv_multiple_dates(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'win',
                    '50.0',
                ],
                [
                    '03-10-2026',
                    '1',
                    'Adam',
                    'JS',
                    'QH',
                    '7C',
                    '8D',
                    '9S',
                    '10H',
                    'JC',
                    'win',
                    '20.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        assert len(result) == 2
        assert ('03-09-2026', '1') in result
        assert ('03-10-2026', '1') in result

    def test_parse_csv_invalid_headers(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'win',
                    '50.0',
                ]
            ],
            headers=['wrong', 'headers', 'here'],
        )
        with pytest.raises(ValueError, match='header'):
            parse_csv(csv_text)

    def test_parse_csv_empty_rows(self):
        csv_text = _make_csv([])
        result = parse_csv(csv_text)
        assert result == {}

    def test_parse_csv_preserves_all_fields(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '5H',
                    '6C',
                    'win',
                    '50.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        entry = result[('03-09-2026', '1')][0]
        assert entry['game_date'] == '03-09-2026'
        assert entry['hand_number'] == '1'
        assert entry['player_name'] == 'Adam'
        assert entry['hole_card_1'] == 'AS'
        assert entry['hole_card_2'] == 'KH'
        assert entry['flop_1'] == '2C'
        assert entry['flop_2'] == '3D'
        assert entry['flop_3'] == '4S'
        assert entry['turn'] == '5H'
        assert entry['river'] == '6C'
        assert entry['result'] == 'win'
        assert entry['profit_loss'] == '50.0'

    def test_parse_csv_optional_turn_river_empty(self):
        csv_text = _make_csv(
            [
                [
                    '03-09-2026',
                    '1',
                    'Adam',
                    'AS',
                    'KH',
                    '2C',
                    '3D',
                    '4S',
                    '',
                    '',
                    'fold',
                    '-10.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        entry = result[('03-09-2026', '1')][0]
        assert entry['turn'] == ''
        assert entry['river'] == ''


# === GET /upload/csv/schema endpoint ===


class TestCSVSchemaEndpoint:
    def test_get_csv_schema(self):
        response = client.get('/upload/csv/schema')
        assert response.status_code == 200
        data = response.json()
        assert 'columns' in data
        assert data['columns'] == CSV_COLUMNS

    def test_get_csv_schema_includes_formats(self):
        response = client.get('/upload/csv/schema')
        assert response.status_code == 200
        data = response.json()
        assert 'formats' in data
        assert 'game_date' in data['formats']
