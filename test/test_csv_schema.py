"""Tests for CSV schema definition, parser, and schema endpoint."""

import csv
import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from pydantic_models.csv_schema import (
    CSV_COLUMNS,
    CSV_COLUMN_FORMATS,
    is_valid_card,
    parse_csv,
    validate_csv_rows,
)


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
                    'won',
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
                    'lost',
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
                    'won',
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
                    'lost',
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
                    'won',
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
                    'won',
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
                    'won',
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
                    'won',
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
        assert entry['result'] == 'won'
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
                    'folded',
                    '-10.0',
                ],
            ]
        )
        result = parse_csv(csv_text)
        entry = result[('03-09-2026', '1')][0]
        assert entry['turn'] == ''
        assert entry['river'] == ''


# === is_valid_card() unit tests ===


class TestIsValidCard:
    def test_valid_standard_cards(self):
        assert is_valid_card('AS') is True
        assert is_valid_card('KH') is True
        assert is_valid_card('2D') is True
        assert is_valid_card('QC') is True

    def test_valid_ten_rank_card(self):
        assert is_valid_card('10H') is True
        assert is_valid_card('10S') is True
        assert is_valid_card('10D') is True
        assert is_valid_card('10C') is True

    def test_invalid_card_bad_rank(self):
        assert is_valid_card('XX') is False
        assert is_valid_card('1S') is False

    def test_invalid_card_bad_suit(self):
        assert is_valid_card('AX') is False
        assert is_valid_card('KZ') is False

    def test_invalid_card_empty_string(self):
        assert is_valid_card('') is False

    def test_invalid_card_single_char(self):
        assert is_valid_card('A') is False


# === validate_csv_rows() unit tests ===


class TestValidateCSVRows:
    def _valid_grouped(self):
        return {
            ('03-09-2026', '1'): [
                {
                    'game_date': '03-09-2026',
                    'hand_number': '1',
                    'player_name': 'Adam',
                    'hole_card_1': 'AS',
                    'hole_card_2': 'KH',
                    'flop_1': '2C',
                    'flop_2': '3D',
                    'flop_3': '4S',
                    'turn': '5H',
                    'river': '6C',
                    'result': 'won',
                    'profit_loss': '50.0',
                },
            ]
        }

    def test_valid_rows_no_errors(self):
        errors = validate_csv_rows(self._valid_grouped())
        assert errors == []

    def test_invalid_card_produces_error(self):
        grouped = self._valid_grouped()
        grouped[('03-09-2026', '1')][0]['hole_card_1'] = 'XX'
        errors = validate_csv_rows(grouped)
        assert len(errors) >= 1
        assert errors[0]['field'] == 'hole_card_1'

    def test_optional_empty_turn_river_no_errors(self):
        grouped = self._valid_grouped()
        grouped[('03-09-2026', '1')][0]['turn'] = ''
        grouped[('03-09-2026', '1')][0]['river'] = ''
        errors = validate_csv_rows(grouped)
        assert errors == []

    def test_invalid_optional_turn_produces_error(self):
        grouped = self._valid_grouped()
        grouped[('03-09-2026', '1')][0]['turn'] = 'ZZ'
        errors = validate_csv_rows(grouped)
        assert len(errors) >= 1
        fields = [e['field'] for e in errors]
        assert 'turn' in fields

    def test_duplicate_cards_detected(self):
        grouped = {
            ('03-09-2026', '1'): [
                {
                    'game_date': '03-09-2026',
                    'hand_number': '1',
                    'player_name': 'Adam',
                    'hole_card_1': 'AS',
                    'hole_card_2': 'AS',
                    'flop_1': '2C',
                    'flop_2': '3D',
                    'flop_3': '4S',
                    'turn': '5H',
                    'river': '6C',
                    'result': 'won',
                    'profit_loss': '50.0',
                },
            ]
        }
        errors = validate_csv_rows(grouped)
        assert len(errors) >= 1
        dup_errors = [e for e in errors if 'Duplicate' in e.get('message', '')]
        assert len(dup_errors) >= 1

    def test_empty_grouped_no_errors(self):
        errors = validate_csv_rows({})
        assert errors == []


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
