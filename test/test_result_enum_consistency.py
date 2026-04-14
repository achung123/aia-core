"""Tests for ResultEnum consistency bugs B-001, B-002, B-003."""

import io

import pytest
from pydantic import ValidationError

from pydantic_models.hand_schemas import PlayerHandResponse, PlayerStatusEntry


class TestB002PlayerHandResponseResultEnum:
    """B-002: PlayerHandResponse.result should be typed as ResultEnum | None."""

    def test_valid_result_enum_accepted(self):
        resp = PlayerHandResponse(
            player_hand_id=1,
            hand_id=1,
            player_id=1,
            player_name='Alice',
            result='won',
        )
        assert resp.result == 'won'

    def test_none_result_accepted(self):
        resp = PlayerHandResponse(
            player_hand_id=1,
            hand_id=1,
            player_id=1,
            player_name='Alice',
            result=None,
        )
        assert resp.result is None

    def test_invalid_result_rejected(self):
        """Arbitrary strings like 'win' should be rejected by the model."""
        with pytest.raises(ValidationError):
            PlayerHandResponse(
                player_hand_id=1,
                hand_id=1,
                player_id=1,
                player_name='Alice',
                result='win',
            )

    def test_handed_back_accepted(self):
        resp = PlayerHandResponse(
            player_hand_id=1,
            hand_id=1,
            player_id=1,
            player_name='Alice',
            result='handed_back',
        )
        assert resp.result == 'handed_back'


class TestB002PlayerStatusEntryResultEnum:
    """B-002: PlayerStatusEntry.result should also be typed as ResultEnum | None."""

    def test_valid_result_accepted(self):
        entry = PlayerStatusEntry(
            name='Alice',
            participation_status='joined',
            result='folded',
        )
        assert entry.result == 'folded'

    def test_invalid_result_rejected(self):
        with pytest.raises(ValidationError):
            PlayerStatusEntry(
                name='Alice',
                participation_status='joined',
                result='fold',
            )


class TestB003StatsUsesResultEnum:
    """B-003: stats.py should use ResultEnum constants, not string literals.

    We verify indirectly: if stats returns correct data for enum values,
    the constants are in use. The real test is that stats work after we
    tighten the model (B-002) — if stats used wrong strings, they'd
    silently return 0 for all counts.
    """

    def test_player_stats_counts_won(self, client):
        # Create game + hand with a won result
        client.post('/players', json={'name': 'Alice'})
        client.post('/players', json={'name': 'Bob'})
        game = client.post(
            '/games', json={'game_date': '2026-01-01', 'player_names': ['Alice', 'Bob']}
        ).json()
        gid = game['game_id']
        client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': 'AH',
                'flop_2': 'KH',
                'flop_3': 'QH',
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': '2S',
                        'card_2': '3S',
                        'result': 'won',
                        'profit_loss': 1.0,
                    },
                    {
                        'player_name': 'Bob',
                        'card_1': '4S',
                        'card_2': '5S',
                        'result': 'lost',
                        'profit_loss': -1.0,
                    },
                ],
            },
        )

        resp = client.get('/stats/players/Alice')
        assert resp.status_code == 200
        data = resp.json()
        assert data['hands_won'] == 1
        assert data['hands_lost'] == 0
        assert data['hands_folded'] == 0

    def test_game_stats_counts_correctly(self, client):
        client.post('/players', json={'name': 'Alice'})
        client.post('/players', json={'name': 'Bob'})
        game = client.post(
            '/games', json={'game_date': '2026-01-01', 'player_names': ['Alice', 'Bob']}
        ).json()
        gid = game['game_id']
        client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': 'AH',
                'flop_2': 'KH',
                'flop_3': 'QH',
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': '2S',
                        'card_2': '3S',
                        'result': 'folded',
                    },
                    {
                        'player_name': 'Bob',
                        'card_1': '4S',
                        'card_2': '5S',
                        'result': 'won',
                        'profit_loss': 1.0,
                    },
                ],
            },
        )

        resp = client.get(f'/stats/games/{gid}')
        assert resp.status_code == 200
        data = resp.json()
        alice_stats = next(
            p for p in data['player_stats'] if p['player_name'] == 'Alice'
        )
        assert alice_stats['hands_folded'] == 1
        assert alice_stats['hands_won'] == 0

    def test_leaderboard_counts_wins(self, client):
        client.post('/players', json={'name': 'Alice'})
        client.post('/players', json={'name': 'Bob'})
        game = client.post(
            '/games', json={'game_date': '2026-01-01', 'player_names': ['Alice', 'Bob']}
        ).json()
        gid = game['game_id']
        client.post(
            f'/games/{gid}/hands',
            json={
                'flop_1': 'AH',
                'flop_2': 'KH',
                'flop_3': 'QH',
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': '2S',
                        'card_2': '3S',
                        'result': 'won',
                        'profit_loss': 5.0,
                    },
                    {
                        'player_name': 'Bob',
                        'card_1': '4S',
                        'card_2': '5S',
                        'result': 'lost',
                        'profit_loss': -5.0,
                    },
                ],
            },
        )

        resp = client.get('/stats/leaderboard')
        assert resp.status_code == 200
        data = resp.json()
        alice = next(e for e in data if e['player_name'] == 'Alice')
        assert alice['win_rate'] == 100.0


class TestB001CSVResultValidation:
    """B-001: CSV upload should reject invalid result strings."""

    def _make_csv(self, result_value: str) -> bytes:
        header = 'game_date,hand_number,player_name,hole_card_1,hole_card_2,flop_1,flop_2,flop_3,turn,river,result,profit_loss'
        row = f'01-01-2026,1,Alice,AH,KH,2S,3S,4S,5S,6S,{result_value},1.0'
        return f'{header}\n{row}'.encode('utf-8')

    def test_csv_commit_rejects_invalid_result(self, client):
        """CSV with result='win' (not a valid enum value) should be rejected."""
        csv_bytes = self._make_csv('win')
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', io.BytesIO(csv_bytes), 'text/csv')},
        )
        assert resp.status_code != 201, (
            f'Invalid result "win" was accepted: {resp.json()}'
        )

    def test_csv_commit_accepts_valid_result(self, client):
        """CSV with result='won' (valid enum value) should be accepted."""
        csv_bytes = self._make_csv('won')
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', io.BytesIO(csv_bytes), 'text/csv')},
        )
        assert resp.status_code == 201, (
            f'Valid result "won" was rejected: {resp.json()}'
        )

    def test_csv_commit_accepts_empty_result(self, client):
        """CSV with empty result should be accepted (stored as None)."""
        csv_bytes = self._make_csv('')
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', io.BytesIO(csv_bytes), 'text/csv')},
        )
        assert resp.status_code == 201

    def test_csv_commit_rejects_typo_fold(self, client):
        """CSV with result='fold' (should be 'folded') must be rejected."""
        csv_bytes = self._make_csv('fold')
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', io.BytesIO(csv_bytes), 'text/csv')},
        )
        assert resp.status_code != 201

    def test_csv_commit_result_stored_correctly(self, client):
        """Verify that a valid result is stored as the correct enum value, not raw text."""
        csv_bytes = self._make_csv('won')
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', io.BytesIO(csv_bytes), 'text/csv')},
        )
        assert resp.status_code == 201

        # Retrieve the hand to check the stored result
        games = client.get('/games').json()
        gid = games[0]['game_id']
        hand_resp = client.get(f'/games/{gid}/hands/1')
        assert hand_resp.status_code == 200
        ph = hand_resp.json()['player_hands'][0]
        assert ph['result'] == 'won'
