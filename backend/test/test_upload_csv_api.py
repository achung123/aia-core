"""Tests for POST /upload/csv endpoint — CSV upload and validation."""

import csv
import io


from pydantic_models.csv_schema import CSV_COLUMNS


def _make_csv(rows: list[list[str]], headers: list[str] | None = None) -> bytes:
    """Build CSV bytes for file upload."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers if headers is not None else CSV_COLUMNS)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode()


VALID_ROW_ADAM = [
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
VALID_ROW_GIL = [
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
]


class TestValidCSVUpload:
    def test_valid_single_row_returns_200_valid(self, client):
        csv_bytes = _make_csv([VALID_ROW_ADAM])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True
        assert data['error_count'] == 0
        assert data['errors'] == []

    def test_valid_multiple_rows_returns_200_valid(self, client):
        csv_bytes = _make_csv([VALID_ROW_ADAM, VALID_ROW_GIL])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True
        assert data['total_rows'] == 2

    def test_valid_csv_with_empty_turn_river(self, client):
        row = [
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
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True


class TestInvalidHeaders:
    def test_wrong_headers_returns_400(self, client):
        bad_csv = b'wrong,headers,here\nfoo,bar,baz\n'
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', bad_csv, 'text/csv')},
        )
        assert response.status_code == 400

    def test_wrong_headers_error_message_mentions_headers(self, client):
        bad_csv = b'wrong,headers,here\nfoo,bar,baz\n'
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', bad_csv, 'text/csv')},
        )
        assert response.status_code == 400
        detail = response.json()['detail'].lower()
        assert 'header' in detail


class TestInvalidCardValues:
    def test_invalid_hole_card_1_reported_in_errors(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'XX',
            'KH',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False
        assert data['error_count'] > 0
        fields = [e['field'] for e in data['errors']]
        assert 'hole_card_1' in fields

    def test_invalid_flop_card_reported(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'AS',
            'KH',
            'ZZ',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False
        fields = [e['field'] for e in data['errors']]
        assert 'flop_1' in fields

    def test_multiple_invalid_cards_all_reported(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'XX',
            'YY',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['error_count'] >= 2
        fields = [e['field'] for e in data['errors']]
        assert 'hole_card_1' in fields
        assert 'hole_card_2' in fields

    def test_invalid_optional_turn_card_reported(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'AS',
            'KH',
            '2C',
            '3D',
            '4S',
            'ZZ',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False
        fields = [e['field'] for e in data['errors']]
        assert 'turn' in fields

    def test_error_includes_row_number(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'XX',
            'KH',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        error = data['errors'][0]
        assert 'row' in error
        assert isinstance(error['row'], int)

    def test_error_includes_field_and_value(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'XX',
            'KH',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        error = data['errors'][0]
        assert error['field'] == 'hole_card_1'
        assert error['value'] == 'XX'


class TestDuplicateCardDetection:
    def test_duplicate_hole_cards_within_hand_reported(self, client):
        # Player has AS, AS — duplicate hole cards
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'AS',
            'AS',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False
        assert data['error_count'] > 0

    def test_hole_card_duplicates_community_card(self, client):
        # Player's hole card AS matches flop_1 AS
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'AS',
            'KH',
            'AS',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False

    def test_two_players_same_hole_card_in_hand(self, client):
        # Both Adam and Gil have AS as hole_card_1 — duplicate across players in same hand
        row1 = [
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
        row2 = [
            '03-09-2026',
            '1',
            'Gil',
            'AS',
            'QD',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'lost',
            '-50.0',
        ]
        csv_bytes = _make_csv([row1, row2])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False

    def test_no_false_positive_same_card_different_hands(self, client):
        # AS appears in hand 1 and hand 2 — that's allowed
        row1 = [
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
        row2 = [
            '03-09-2026',
            '2',
            'Adam',
            'AS',
            'JH',
            '7C',
            '8D',
            '9S',
            '10H',
            'JC',
            'lost',
            '-30.0',
        ]
        csv_bytes = _make_csv([row1, row2])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True


class TestResponseStructure:
    def test_response_includes_total_rows(self, client):
        csv_bytes = _make_csv([VALID_ROW_ADAM, VALID_ROW_GIL])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert 'total_rows' in data
        assert data['total_rows'] == 2

    def test_response_includes_error_count(self, client):
        csv_bytes = _make_csv([VALID_ROW_ADAM])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        assert 'error_count' in response.json()


class TestEmptyCSV:
    def test_headers_only_no_data_rows_returns_200(self, client):
        csv_bytes = _make_csv([])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True
        assert data['total_rows'] == 0
        assert data['error_count'] == 0


class TestTenRankCards:
    def test_valid_10_rank_cards_accepted(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            '10H',
            '10S',
            '2C',
            '3D',
            '4S',
            '5H',
            '6C',
            'won',
            '50.0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        # 10H and 10S are duplicate-free, both valid
        assert data['valid'] is True


class TestHeaderEdgeCases:
    def test_extra_columns_returns_400(self, client):
        bad_headers = CSV_COLUMNS + ['extra_col']
        csv_bytes = _make_csv([VALID_ROW_ADAM + ['extra']], headers=bad_headers)
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_missing_columns_returns_400(self, client):
        short_headers = CSV_COLUMNS[:5]
        csv_bytes = _make_csv([VALID_ROW_ADAM[:5]], headers=short_headers)
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_totally_empty_file_returns_valid_empty(self, client):
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', b'', 'text/csv')},
        )
        # Empty file has no headers — parser returns empty dict, treated as 0 rows
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is True
        assert data['total_rows'] == 0


class TestInvalidResultValues:
    """CSV validation rejects invalid result strings."""

    def _row_with_result(self, result: str) -> list[str]:
        return [
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
            result,
            '50.0',
        ]

    def test_arbitrary_result_string_reported_as_error(self, client):
        csv_bytes = _make_csv([self._row_with_result('destroyed')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is False
        assert data['error_count'] > 0
        fields = [e['field'] for e in data['errors']]
        assert 'result' in fields

    def test_legacy_win_value_reported_as_error(self, client):
        csv_bytes = _make_csv([self._row_with_result('win')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is False
        fields = [e['field'] for e in data['errors']]
        assert 'result' in fields

    def test_legacy_loss_value_reported_as_error(self, client):
        csv_bytes = _make_csv([self._row_with_result('loss')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is False

    def test_legacy_fold_value_reported_as_error(self, client):
        csv_bytes = _make_csv([self._row_with_result('fold')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is False

    def test_valid_result_won_accepted(self, client):
        csv_bytes = _make_csv([self._row_with_result('won')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is True

    def test_valid_result_lost_accepted(self, client):
        csv_bytes = _make_csv([self._row_with_result('lost')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is True

    def test_valid_result_folded_accepted(self, client):
        csv_bytes = _make_csv([self._row_with_result('folded')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is True

    def test_empty_result_accepted(self, client):
        csv_bytes = _make_csv([self._row_with_result('')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        assert data['valid'] is True

    def test_error_message_mentions_valid_values(self, client):
        csv_bytes = _make_csv([self._row_with_result('destroyed')])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        data = response.json()
        error = next(e for e in data['errors'] if e['field'] == 'result')
        msg = error['message'].lower()
        assert 'won' in msg or 'lost' in msg or 'folded' in msg


class TestInvalidOptionalCards:
    def test_invalid_river_with_empty_turn_reported(self, client):
        row = [
            '03-09-2026',
            '1',
            'Adam',
            'AS',
            'KH',
            '2C',
            '3D',
            '4S',
            '',
            'ZZ',
            'won',
            '0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 200
        data = response.json()
        assert data['valid'] is False
        fields = [e['field'] for e in data['errors']]
        assert 'river' in fields
