"""Tests for T-026: POST /upload/csv/commit endpoint — CSV bulk commit."""

import csv
import io

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.models import Base
from app.database.session import get_db
from app.main import app
from pydantic_models.csv_schema import CSV_COLUMNS

DATABASE_URL = 'sqlite:///:memory:'
engine = create_engine(
    DATABASE_URL, connect_args={'check_same_thread': False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# CSV helpers
# ---------------------------------------------------------------------------


def _make_csv(rows: list[list[str]], headers: list[str] | None = None) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers if headers is not None else CSV_COLUMNS)
    for row in rows:
        writer.writerow(row)
    return buf.getvalue().encode()


# Two players, one hand, game date 03-09-2026
ADAM_H1 = [
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
GIL_H1 = [
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

# Second hand, same game date
ADAM_H2 = [
    '03-09-2026',
    '2',
    'Adam',
    '10C',
    '9H',
    '7D',
    '8S',
    'KS',
    'QC',
    'JS',
    'folded',
    '-10.0',
]
GIL_H2 = [
    '03-09-2026',
    '2',
    'Gil',
    'AH',
    '2D',
    '7D',
    '8S',
    'KS',
    'QC',
    'JS',
    'won',
    '10.0',
]

# Different date for multi-session test
ADAM_D2 = [
    '03-10-2026',
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
    '20.0',
]
GIL_D2 = [
    '03-10-2026',
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
    '-20.0',
]


# ---------------------------------------------------------------------------
# AC-1 / AC-3: Valid commit returns 201 with summary counts
# ---------------------------------------------------------------------------


class TestCommitSuccessResponse:
    """Successful commit returns 201 and a summary payload."""

    def test_commit_returns_201(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 201

    def test_commit_response_has_required_keys(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        for key in (
            'games_created',
            'hands_created',
            'players_created',
            'players_matched',
        ):
            assert key in data

    def test_commit_single_game_date_creates_one_game(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['games_created'] == 1

    def test_commit_two_hands_counts_two_hands_created(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_H2, GIL_H2])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['hands_created'] == 2

    def test_commit_two_new_players_counts_correctly(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['players_created'] == 2
        assert data['players_matched'] == 0

    def test_commit_one_hand_counts_one_hand_created(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['hands_created'] == 1


# ---------------------------------------------------------------------------
# AC-2: Game sessions grouped by date
# ---------------------------------------------------------------------------


class TestCommitMultiDateSessions:
    """Two distinct game_dates produce two separate GameSession records."""

    def test_two_dates_creates_two_sessions(self, client):
        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_D2, GIL_D2])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['games_created'] == 2

    def test_two_dates_both_sessions_in_db(self, client):
        from datetime import date
        from app.database.models import GameSession

        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_D2, GIL_D2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            sessions = db.query(GameSession).order_by(GameSession.game_date).all()
            assert len(sessions) == 2
            assert sessions[0].game_date == date(2026, 3, 9)
            assert sessions[1].game_date == date(2026, 3, 10)
        finally:
            db.close()

    def test_imported_sessions_have_completed_status(self, client):
        from app.database.models import GameSession

        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_D2, GIL_D2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            sessions = db.query(GameSession).all()
            assert len(sessions) == 2
            for session in sessions:
                assert session.status == 'completed', (
                    f'Game {session.game_id} should be completed, got {session.status!r}'
                )
        finally:
            db.close()


# ---------------------------------------------------------------------------
# AC-2: Players auto-created and reused by name
# ---------------------------------------------------------------------------


class TestCommitPlayerCreation:
    """Players are created on first encounter; existing players are reused."""

    def test_players_created_in_db(self, client):
        from app.database.models import Player

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            players = db.query(Player).order_by(Player.name).all()
            names = [p.name for p in players]
            assert 'Adam' in names
            assert 'Gil' in names
        finally:
            db.close()

    def test_existing_player_is_reused_not_duplicated(self, client):
        from app.database.models import Player

        # Pre-create Adam
        db = SessionLocal()
        try:
            db.add(Player(name='Adam'))
            db.commit()
        finally:
            db.close()

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        # Adam already existed, Gil is new
        assert data['players_created'] == 1
        assert data['players_matched'] == 1

        # Exactly 2 players in DB (no duplicate Adam)
        db = SessionLocal()
        try:
            count = db.query(Player).count()
            assert count == 2
        finally:
            db.close()

    def test_same_player_in_multiple_hands_counted_once(self, client):
        """Adam appears in hand 1 and hand 2 — counted once in players_created."""
        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_H2, GIL_H2])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['players_created'] == 2  # Adam and Gil, not 4


# ---------------------------------------------------------------------------
# DB record verification
# ---------------------------------------------------------------------------


class TestCommitDatabaseRecords:
    """Verify Hand and PlayerHand records are persisted correctly."""

    def test_hand_records_created_in_db(self, client):
        from app.database.models import Hand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_H2, GIL_H2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            hands = db.query(Hand).all()
            assert len(hands) == 2
        finally:
            db.close()

    def test_hand_community_cards_stored_correctly(self, client):
        from app.database.models import Hand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            hand = db.query(Hand).first()
            assert hand is not None
            assert hand.flop_1 == '2C'
            assert hand.flop_2 == '3D'
            assert hand.flop_3 == '4S'
            assert hand.turn == '5H'
            assert hand.river == '6C'
        finally:
            db.close()

    def test_player_hand_records_created_in_db(self, client):
        from app.database.models import PlayerHand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            phs = db.query(PlayerHand).all()
            assert len(phs) == 2
        finally:
            db.close()

    def test_player_hand_hole_cards_stored_correctly(self, client):
        from app.database.models import Player, PlayerHand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            adam = db.query(Player).filter(Player.name == 'Adam').first()
            ph = (
                db.query(PlayerHand)
                .filter(PlayerHand.player_id == adam.player_id)
                .first()
            )
            assert ph.card_1 == 'AS'
            assert ph.card_2 == 'KH'
        finally:
            db.close()

    def test_player_hand_result_and_profit_loss_stored(self, client):
        from app.database.models import Player, PlayerHand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            adam = db.query(Player).filter(Player.name == 'Adam').first()
            ph = (
                db.query(PlayerHand)
                .filter(PlayerHand.player_id == adam.player_id)
                .first()
            )
            assert ph.result == 'won'
            assert ph.profit_loss == pytest.approx(50.0)
        finally:
            db.close()

    def test_turn_river_empty_stored_as_null(self, client):
        from app.database.models import Hand

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
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            hand = db.query(Hand).first()
            assert hand.turn is None
            assert hand.river is None
        finally:
            db.close()

    def test_game_session_linked_to_hand(self, client):
        from app.database.models import GameSession, Hand

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            session = db.query(GameSession).first()
            hand = db.query(Hand).first()
            assert hand.game_id == session.game_id
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Validation failures — no data committed (AC-1 rollback path)
# ---------------------------------------------------------------------------


class TestCommitValidationErrors:
    """Invalid CSV must return 400 and leave the database unchanged."""

    def test_wrong_headers_returns_400(self, client):
        bad_csv = b'wrong,headers\nfoo,bar\n'
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', bad_csv, 'text/csv')},
        )
        assert response.status_code == 400

    def test_invalid_card_values_returns_400(self, client):
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
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_invalid_csv_no_game_sessions_created(self, client):
        from app.database.models import GameSession

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
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            assert db.query(GameSession).count() == 0
        finally:
            db.close()

    def test_invalid_csv_no_players_created(self, client):
        from app.database.models import Player

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
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            assert db.query(Player).count() == 0
        finally:
            db.close()

    def test_duplicate_cards_in_hand_returns_400(self, client):
        # Adam and Gil share the same hole card (AS)
        dup_row_1 = [
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
            '0',
        ]
        dup_row_2 = [
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
            '0',
        ]
        csv_bytes = _make_csv([dup_row_1, dup_row_2])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400


# ---------------------------------------------------------------------------
# Edge cases: empty CSV, GamePlayer association, error detail structure
# ---------------------------------------------------------------------------


class TestCommitEmptyCSV:
    """Headers-only CSV should commit successfully with zero counts."""

    def test_empty_csv_returns_201(self, client):
        csv_bytes = _make_csv([])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 201

    def test_empty_csv_zero_counts(self, client):
        csv_bytes = _make_csv([])
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        ).json()
        assert data['games_created'] == 0
        assert data['hands_created'] == 0
        assert data['players_created'] == 0
        assert data['players_matched'] == 0


class TestCommitGamePlayerAssociation:
    """Verify GamePlayer association records link players to game sessions."""

    def test_game_player_records_created(self, client):
        from app.database.models import GamePlayer

        csv_bytes = _make_csv([ADAM_H1, GIL_H1])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            gps = db.query(GamePlayer).all()
            assert len(gps) == 2
        finally:
            db.close()

    def test_game_player_not_duplicated_across_hands(self, client):
        from app.database.models import GamePlayer

        # Adam appears in hand 1 and hand 2 — only 1 GamePlayer for Adam in this session
        csv_bytes = _make_csv([ADAM_H1, GIL_H1, ADAM_H2, GIL_H2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            gps = db.query(GamePlayer).all()
            # 2 players × 1 game session = 2 GamePlayer records
            assert len(gps) == 2
        finally:
            db.close()


class TestCommitValidationErrorDetails:
    """400 responses from commit include structured error details."""

    def test_invalid_card_error_contains_detail_dict(self, client):
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
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400
        detail = response.json()['detail']
        assert detail['valid'] is False
        assert detail['error_count'] > 0
        assert isinstance(detail['errors'], list)

    def test_no_hands_created_on_duplicate_card_error(self, client):
        from app.database.models import Hand

        dup_row_1 = [
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
            '0',
        ]
        dup_row_2 = [
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
            '0',
        ]
        csv_bytes = _make_csv([dup_row_1, dup_row_2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        db = SessionLocal()
        try:
            assert db.query(Hand).count() == 0
        finally:
            db.close()


class TestCommitSecondAppend:
    """Two separate commits create independent data — no cross-commit dedup."""

    def test_second_commit_creates_separate_session(self, client):
        from app.database.models import GameSession

        csv_bytes_1 = _make_csv([ADAM_H1, GIL_H1])
        csv_bytes_2 = _make_csv([ADAM_D2, GIL_D2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes_1, 'text/csv')},
        )
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes_2, 'text/csv')},
        )
        db = SessionLocal()
        try:
            sessions = db.query(GameSession).all()
            assert len(sessions) == 2
        finally:
            db.close()

    def test_second_commit_reuses_existing_players(self, client):
        csv_bytes_1 = _make_csv([ADAM_H1, GIL_H1])
        csv_bytes_2 = _make_csv([ADAM_D2, GIL_D2])
        client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes_1, 'text/csv')},
        )
        data = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes_2, 'text/csv')},
        ).json()
        # Second commit should match both players, create none
        assert data['players_created'] == 0
        assert data['players_matched'] == 2


# ---------------------------------------------------------------------------
# Result validation: invalid result strings rejected at commit
# ---------------------------------------------------------------------------


class TestCommitRejectsInvalidResults:
    """Commit endpoint rejects CSV with invalid result enum values."""

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

    def test_arbitrary_result_rejected_with_400(self, client):
        csv_bytes = _make_csv([self._row_with_result('destroyed')])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_legacy_win_rejected(self, client):
        csv_bytes = _make_csv([self._row_with_result('win')])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_legacy_loss_rejected(self, client):
        csv_bytes = _make_csv([self._row_with_result('loss')])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_legacy_fold_rejected(self, client):
        csv_bytes = _make_csv([self._row_with_result('fold')])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 400

    def test_valid_results_still_commit_successfully(self, client):
        row_won = [
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
        row_lost = [
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
        csv_bytes = _make_csv([row_won, row_lost])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 201

    def test_empty_result_commits_successfully(self, client):
        row = [
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
            '',
            '50.0',
        ]
        csv_bytes = _make_csv([row])
        response = client.post(
            '/upload/csv/commit',
            files={'file': ('hands.csv', csv_bytes, 'text/csv')},
        )
        assert response.status_code == 201
