"""Tests for blind management endpoints (GET + PATCH)."""

from datetime import datetime, timedelta, timezone


def _utcnow_naive():
    """Return current UTC time as a naive datetime (matches DB storage)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _create_game(client, player_names=None):
    """Helper to create a game session and return the game_id."""
    if player_names is None:
        player_names = ['Alice', 'Bob']
    resp = client.post(
        '/games',
        json={'game_date': '2026-04-12', 'player_names': player_names},
    )
    assert resp.status_code == 201
    return resp.json()['game_id']


class TestGetBlinds:
    """AC-1: GET returns blind fields."""

    def test_get_blinds_returns_defaults(self, client):
        game_id = _create_game(client)
        resp = client.get(f'/games/{game_id}/blinds')
        assert resp.status_code == 200
        data = resp.json()
        assert data['small_blind'] == 0.10
        assert data['big_blind'] == 0.20
        assert data['blind_timer_minutes'] == 15
        assert data['blind_timer_paused'] is False
        assert data['blind_timer_started_at'] is None

    def test_get_blinds_404_for_missing_game(self, client):
        resp = client.get('/games/9999/blinds')
        assert resp.status_code == 404


class TestPatchBlindsPartialUpdate:
    """AC-2 & AC-5: PATCH accepts partial updates for any blind field."""

    def test_patch_blind_timer_minutes_only(self, client):
        game_id = _create_game(client)
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_minutes': 20},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['blind_timer_minutes'] == 20
        # Unchanged fields keep defaults
        assert data['small_blind'] == 0.10
        assert data['big_blind'] == 0.20

    def test_patch_404_for_missing_game(self, client):
        resp = client.patch('/games/9999/blinds', json={'small_blind': 0.50})
        assert resp.status_code == 404


class TestAdvanceBlinds:
    """AC-3: Updating small_blind or big_blind resets blind_timer_started_at to now."""

    def test_updating_small_blind_resets_timer(self, client):
        game_id = _create_game(client)
        before = _utcnow_naive()
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.25},
        )
        after = _utcnow_naive()
        assert resp.status_code == 200
        data = resp.json()
        assert data['small_blind'] == 0.25
        started = datetime.fromisoformat(data['blind_timer_started_at'])
        assert before <= started <= after

    def test_updating_big_blind_resets_timer(self, client):
        game_id = _create_game(client)
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'big_blind': 0.50},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['big_blind'] == 0.50
        assert data['blind_timer_started_at'] is not None

    def test_updating_both_blinds_resets_timer(self, client):
        game_id = _create_game(client)
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.50, 'big_blind': 1.00},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['small_blind'] == 0.50
        assert data['big_blind'] == 1.00
        assert data['blind_timer_started_at'] is not None


class TestPauseBlinds:
    """AC-4: Pausing stores implicit remaining time."""

    def test_pause_sets_flag(self, client):
        game_id = _create_game(client)
        # First start the timer by advancing blinds
        client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.25},
        )
        # Now pause
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['blind_timer_paused'] is True
        # blind_timer_started_at is preserved (not cleared)
        assert data['blind_timer_started_at'] is not None


class TestResumeBlinds:
    """AC-4: Resuming adjusts blind_timer_started_at."""

    def test_resume_adjusts_started_at(self, client):
        game_id = _create_game(client)
        # Start timer
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.25},
        )
        original_started = resp.json()['blind_timer_started_at']

        # Pause
        client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': True},
        )

        # Resume
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['blind_timer_paused'] is False
        # blind_timer_started_at should be approximately the same as original
        # (almost no time elapsed before pause), allow 5s tolerance
        resumed_started = datetime.fromisoformat(data['blind_timer_started_at'])
        original = datetime.fromisoformat(original_started)
        diff = abs((resumed_started - original).total_seconds())
        assert diff <= 5, f'Expected started_at close to original, diff was {diff}s'


class TestPauseResumeRemainingTime:
    """Bug fix: pause/resume must preserve remaining time, not reset full duration."""

    def _set_started_at(self, client, game_id, started_at):
        """Directly set blind_timer_started_at in the DB via the test DB session."""
        from app.database.models import GameSession

        # Access the overridden DB session
        db_gen = client.app.dependency_overrides[
            __import__('app.database.session', fromlist=['get_db']).get_db
        ]
        db = next(db_gen())
        game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
        game.blind_timer_started_at = started_at
        db.commit()
        db.close()

    def test_pause_stores_remaining_seconds(self, client):
        """Pausing should populate blind_timer_remaining_seconds in the response."""
        game_id = _create_game(client)

        # Start the timer (advance blinds sets started_at to now)
        client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.25, 'blind_timer_minutes': 10},
        )

        # Manually set started_at to 3 minutes ago for a deterministic test
        three_min_ago = _utcnow_naive() - timedelta(minutes=3)
        self._set_started_at(client, game_id, three_min_ago)

        # Pause — should store ~420 remaining seconds (10*60 - 180 = 420)
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['blind_timer_paused'] is True
        remaining = data['blind_timer_remaining_seconds']
        assert remaining is not None
        # Allow a 5-second tolerance for test execution time
        assert 415 <= remaining <= 425, f'Expected ~420, got {remaining}'

    def test_resume_preserves_remaining_time(self, client):
        """Resuming after pause should set started_at so remaining time is correct."""
        game_id = _create_game(client)

        # Start timer: 10-minute blind timer
        client.patch(
            f'/games/{game_id}/blinds',
            json={'small_blind': 0.25, 'blind_timer_minutes': 10},
        )

        # Set started_at to 4 minutes ago
        four_min_ago = _utcnow_naive() - timedelta(minutes=4)
        self._set_started_at(client, game_id, four_min_ago)

        # Pause (should store ~360 remaining seconds)
        client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': True},
        )

        # Resume
        resp = client.patch(
            f'/games/{game_id}/blinds',
            json={'blind_timer_paused': False},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['blind_timer_paused'] is False
        # blind_timer_remaining_seconds should be cleared on resume
        assert data['blind_timer_remaining_seconds'] is None

        # The key assertion: started_at should be set such that
        # started_at + 10min ≈ now + ~360s remaining
        # i.e. started_at ≈ now - (10*60 - 360)s = now - 240s = now - 4min
        started = datetime.fromisoformat(data['blind_timer_started_at'])
        now = _utcnow_naive()
        elapsed_since_started = (now - started).total_seconds()
        # elapsed should be ~240s (4 minutes that already passed)
        assert 235 <= elapsed_since_started <= 245, (
            f'Expected ~240s elapsed, got {elapsed_since_started}'
        )

    def test_get_blinds_returns_remaining_seconds_field(self, client):
        """GET /blinds response should include blind_timer_remaining_seconds."""
        game_id = _create_game(client)
        resp = client.get(f'/games/{game_id}/blinds')
        assert resp.status_code == 200
        data = resp.json()
        assert 'blind_timer_remaining_seconds' in data
        assert data['blind_timer_remaining_seconds'] is None
