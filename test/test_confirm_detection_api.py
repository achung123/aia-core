"""Tests for T-041: Confirm Detected Cards endpoint.

POST /games/{game_id}/hands/image/{upload_id}/confirm
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database.database_models import Base as LegacyBase
from app.database.models import (
    Base as ModelsBase,
    CardDetection,
    DetectionCorrection,
    Hand,
)
from app.database.session import get_db
from app.main import app

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
    LegacyBase.metadata.create_all(bind=engine)
    ModelsBase.metadata.create_all(bind=engine)
    yield
    ModelsBase.metadata.drop_all(bind=engine)
    LegacyBase.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def game_id(client):
    """Create a game session with two players and return the game_id."""
    response = client.post(
        '/games',
        json={'game_date': '2026-03-11', 'player_names': ['Alice', 'Bob']},
    )
    assert response.status_code == 201
    return response.json()['game_id']


def _make_jpeg(size_bytes: int = 100) -> bytes:
    return b'\xff\xd8\xff\xe0' + b'\x00' * (size_bytes - 4)


def _upload_and_detect(client, game_id):
    """Upload an image and trigger detection, returning the upload_id."""
    resp = client.post(
        f'/games/{game_id}/hands/image',
        files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
    )
    assert resp.status_code == 201
    upload_id = resp.json()['upload_id']
    # Trigger detection so status becomes 'detected'
    det_resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
    assert det_resp.status_code == 200
    assert det_resp.json()['status'] == 'detected'
    return upload_id


def _valid_confirm_payload():
    """Return a valid confirm payload with no duplicate cards."""
    return {
        'community_cards': {
            'flop_1': {'rank': 'A', 'suit': 'S'},
            'flop_2': {'rank': 'K', 'suit': 'H'},
            'flop_3': {'rank': 'Q', 'suit': 'D'},
            'turn': {'rank': 'J', 'suit': 'C'},
            'river': {'rank': '10', 'suit': 'S'},
        },
        'player_hands': [
            {
                'player_name': 'Alice',
                'card_1': {'rank': '2', 'suit': 'H'},
                'card_2': {'rank': '3', 'suit': 'D'},
            },
            {
                'player_name': 'Bob',
                'card_1': {'rank': '4', 'suit': 'C'},
                'card_2': {'rank': '5', 'suit': 'S'},
            },
        ],
    }


# ── Model: source_upload_id on Hand ────────────────────────────────────


class TestHandModelSourceUploadId:
    """AC-3: Hand has source_upload_id FK back to ImageUpload."""

    def test_hand_has_source_upload_id_column(self):
        assert hasattr(Hand, 'source_upload_id')

    def test_source_upload_id_is_nullable(self):
        col = Hand.__table__.columns['source_upload_id']
        assert col.nullable is True

    def test_source_upload_id_fk_target(self):
        col = Hand.__table__.columns['source_upload_id']
        fk_targets = [fk.target_fullname for fk in col.foreign_keys]
        assert 'image_uploads.upload_id' in fk_targets


# ── Confirm Endpoint: Happy Path ────────────────────────────────────────


class TestConfirmEndpointHappyPath:
    """AC-1/AC-3/AC-4: Confirm creates Hand+PlayerHand, links upload, updates status."""

    def test_confirm_returns_201(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp.status_code == 201

    def test_confirm_returns_hand_response(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        data = resp.json()
        assert 'hand_id' in data
        assert 'hand_number' in data
        assert data['game_id'] == game_id

    def test_confirm_sets_community_cards(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == 'QD'
        assert data['turn'] == 'JC'
        assert data['river'] == '10S'

    def test_confirm_creates_player_hands(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        data = resp.json()
        assert len(data['player_hands']) == 2
        names = {ph['player_name'] for ph in data['player_hands']}
        assert names == {'Alice', 'Bob'}

    def test_confirm_links_source_upload_id(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        data = resp.json()
        assert data['source_upload_id'] == upload_id

    def test_confirm_updates_upload_status_to_confirmed(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        # Re-fetch the upload to verify status
        det_resp = client.get(f'/games/{game_id}/hands/image/{upload_id}')
        assert det_resp.json()['status'] == 'confirmed'

    def test_confirm_auto_increments_hand_number(self, client, game_id):
        # Record a hand first via manual endpoint
        client.post(
            f'/games/{game_id}/hands',
            json={
                'flop_1': {'rank': '9', 'suit': 'S'},
                'flop_2': {'rank': '8', 'suit': 'H'},
                'flop_3': {'rank': '7', 'suit': 'D'},
                'player_entries': [
                    {
                        'player_name': 'Alice',
                        'card_1': {'rank': '6', 'suit': 'C'},
                        'card_2': {'rank': '5', 'suit': 'S'},
                    },
                ],
            },
        )
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        data = resp.json()
        assert data['hand_number'] == 2

    def test_confirm_without_turn_river(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        payload['community_cards'].pop('turn')
        payload['community_cards'].pop('river')
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['turn'] is None
        assert data['river'] is None


# ── Confirm Endpoint: Validation Errors ─────────────────────────────────


class TestConfirmEndpointValidation:
    """AC-2: Card validation rejects duplicates with 400."""

    def test_duplicate_community_cards_rejected(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        # Make flop_2 same as flop_1
        payload['community_cards']['flop_2'] = {'rank': 'A', 'suit': 'S'}
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400
        assert 'Duplicate' in resp.json()['detail']

    def test_duplicate_across_community_and_player(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        # Player card same as community card
        payload['player_hands'][0]['card_1'] = {'rank': 'A', 'suit': 'S'}
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400
        assert 'Duplicate' in resp.json()['detail']

    def test_duplicate_player_hole_cards(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        # Both player cards the same
        payload['player_hands'][0]['card_2'] = payload['player_hands'][0]['card_1']
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400
        assert 'Duplicate' in resp.json()['detail']


# ── Confirm Endpoint: Error Cases ──────────────────────────────────────


class TestConfirmEndpointErrors:
    """Edge cases: 404s, wrong status, player not found, etc."""

    def test_upload_not_found_returns_404(self, client, game_id):
        resp = client.post(
            f'/games/{game_id}/hands/image/9999/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp.status_code == 404

    def test_game_not_found_returns_404(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        resp = client.post(
            f'/games/9999/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp.status_code == 404

    def test_upload_wrong_game_returns_404(self, client, game_id):
        """Upload belongs to game_id but we pass a different game."""
        upload_id = _upload_and_detect(client, game_id)
        # Create second game
        resp2 = client.post(
            '/games',
            json={'game_date': '2026-03-12', 'player_names': ['Alice']},
        )
        other_game_id = resp2.json()['game_id']
        resp = client.post(
            f'/games/{other_game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp.status_code == 404

    def test_upload_not_detected_returns_409(self, client, game_id):
        """Upload still in 'processing' status should be rejected."""
        resp = client.post(
            f'/games/{game_id}/hands/image',
            files={'file': ('hand.jpg', _make_jpeg(), 'image/jpeg')},
        )
        upload_id = resp.json()['upload_id']
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp.status_code == 409

    def test_already_confirmed_returns_409(self, client, game_id):
        """Confirming twice should fail."""
        upload_id = _upload_and_detect(client, game_id)
        resp1 = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp1.status_code == 201
        resp2 = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=_valid_confirm_payload(),
        )
        assert resp2.status_code == 409

    def test_player_not_found_returns_404(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        payload['player_hands'][0]['player_name'] = 'UnknownPlayer'
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 404

    def test_player_not_in_game_returns_400(self, client, game_id):
        """Player exists but isn't in this game."""
        # Create a player not in the game
        client.post('/players', json={'name': 'Charlie'})
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        payload['player_hands'][0]['player_name'] = 'Charlie'
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400

    def test_missing_community_cards_returns_422(self, client, game_id):
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        del payload['community_cards']['flop_1']
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 422

    def test_empty_player_hands_accepted(self, client, game_id):
        """AC-1 (T-015): 0 player_hands entries are now accepted."""
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        payload['player_hands'] = []
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['player_hands'] == []

    def test_duplicate_player_name_returns_400(self, client, game_id):
        """Same player_name appearing twice should be rejected with 400."""
        upload_id = _upload_and_detect(client, game_id)
        payload = _valid_confirm_payload()
        payload['player_hands'] = [
            {
                'player_name': 'Alice',
                'card_1': {'rank': '2', 'suit': 'H'},
                'card_2': {'rank': '3', 'suit': 'D'},
            },
            {
                'player_name': 'Alice',
                'card_1': {'rank': '4', 'suit': 'C'},
                'card_2': {'rank': '5', 'suit': 'S'},
            },
        ]
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400
        assert 'duplicate' in resp.json()['detail'].lower()


# ── T-015: Dynamic Card Count ──────────────────────────────────────────


class TestConfirmDynamicCardCount:
    """T-015: Confirm endpoint handles variable number of detected cards."""

    def test_confirm_with_zero_player_hands(self, client, game_id):
        """AC-1: Accepts 0 player_hands entries."""
        upload_id = _upload_and_detect(client, game_id)
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['flop_1'] == 'AS'
        assert data['flop_2'] == 'KH'
        assert data['flop_3'] == 'QD'
        assert data['player_hands'] == []

    def test_confirm_community_only_flop(self, client, game_id):
        """AC-2: flop_1/2/3 required, turn/river optional."""
        upload_id = _upload_and_detect(client, game_id)
        payload = {
            'community_cards': {
                'flop_1': {'rank': '9', 'suit': 'S'},
                'flop_2': {'rank': '8', 'suit': 'H'},
                'flop_3': {'rank': '7', 'suit': 'D'},
            },
            'player_hands': [],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['turn'] is None
        assert data['river'] is None

    def test_confirm_three_players(self, client):
        """AC-1: Accepts multiple player_hands entries."""
        # Create a game with 3 players
        resp = client.post(
            '/games',
            json={
                'game_date': '2026-03-15',
                'player_names': ['Alice', 'Bob', 'Charlie'],
            },
        )
        gid = resp.json()['game_id']
        upload_id = _upload_and_detect(client, gid)
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '2', 'suit': 'H'},
                    'card_2': {'rank': '3', 'suit': 'D'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '4', 'suit': 'C'},
                    'card_2': {'rank': '5', 'suit': 'S'},
                },
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': '6', 'suit': 'H'},
                    'card_2': {'rank': '7', 'suit': 'C'},
                },
            ],
        }
        resp = client.post(
            f'/games/{gid}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data['player_hands']) == 3

    def test_confirm_duplicate_across_all_players(self, client):
        """AC-4: Duplicate validation on full confirmed set."""
        resp = client.post(
            '/games',
            json={
                'game_date': '2026-03-15',
                'player_names': ['Alice', 'Bob', 'Charlie'],
            },
        )
        gid = resp.json()['game_id']
        upload_id = _upload_and_detect(client, gid)
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '2', 'suit': 'H'},
                    'card_2': {'rank': '3', 'suit': 'D'},
                },
                {
                    'player_name': 'Bob',
                    'card_1': {'rank': '4', 'suit': 'C'},
                    'card_2': {'rank': '5', 'suit': 'S'},
                },
                {
                    'player_name': 'Charlie',
                    'card_1': {'rank': '6', 'suit': 'H'},
                    # Duplicate of Alice's card_1
                    'card_2': {'rank': '2', 'suit': 'H'},
                },
            ],
        }
        resp = client.post(
            f'/games/{gid}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 400
        assert 'Duplicate' in resp.json()['detail']

    def test_unmapped_detections_not_in_hand(self, client, game_id):
        """AC-3: Only explicitly confirmed cards appear in the Hand record."""
        upload_id = _upload_and_detect(client, game_id)
        # Confirm only community + 1 player (fewer than detected)
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '2', 'suit': 'H'},
                    'card_2': {'rank': '3', 'suit': 'D'},
                },
            ],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201
        data = resp.json()
        # Hand only has community + 1 player's cards
        assert data['flop_1'] == 'AS'
        assert len(data['player_hands']) == 1


class TestConfirmCorrectionRecords:
    """T-015 AC-5: Corrections created for changed detections using DetectionResult format."""

    def _seed_detections(self, client, game_id, upload_id, detections):
        """Directly insert CardDetection rows for a controlled test."""
        db = SessionLocal()
        try:
            for det in detections:
                db.add(CardDetection(upload_id=upload_id, **det))
            db.commit()
        finally:
            db.close()

    def test_correction_created_when_confirmed_differs(self, client, game_id):
        """Correction record created when confirmed value != detected value."""
        upload_id = _upload_and_detect(client, game_id)

        # Overwrite detections with known positions/values
        db = SessionLocal()
        try:
            db.query(CardDetection).filter(
                CardDetection.upload_id == upload_id
            ).delete()
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_1',
                    detected_value='AS',
                    confidence=0.95,
                    bbox_x=100.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_2',
                    detected_value='KH',
                    confidence=0.90,
                    bbox_x=200.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_3',
                    detected_value='QD',
                    confidence=0.85,
                    bbox_x=300.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='hole_1',
                    detected_value='2H',
                    confidence=0.88,
                    bbox_x=100.0,
                    bbox_y=300.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='hole_2',
                    detected_value='3D',
                    confidence=0.82,
                    bbox_x=200.0,
                    bbox_y=300.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.commit()
        finally:
            db.close()

        # Confirm with flop_1 changed from AS to 9S
        payload = {
            'community_cards': {
                'flop_1': {'rank': '9', 'suit': 'S'},  # Changed from AS
                'flop_2': {'rank': 'K', 'suit': 'H'},  # Same
                'flop_3': {'rank': 'Q', 'suit': 'D'},  # Same
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '2', 'suit': 'H'},  # Same
                    'card_2': {'rank': '3', 'suit': 'D'},  # Same
                },
            ],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201

        # Check correction records
        db = SessionLocal()
        try:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 1
            c = corrections[0]
            assert c.card_position == 'flop_1'
            assert c.detected_value == 'AS'
            assert c.corrected_value == '9S'
        finally:
            db.close()

    def test_no_corrections_when_all_match(self, client, game_id):
        """No corrections when confirmed values match detected values."""
        upload_id = _upload_and_detect(client, game_id)

        # Overwrite detections with exact values we'll confirm
        db = SessionLocal()
        try:
            db.query(CardDetection).filter(
                CardDetection.upload_id == upload_id
            ).delete()
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_1',
                    detected_value='AS',
                    confidence=0.95,
                    bbox_x=100.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_2',
                    detected_value='KH',
                    confidence=0.90,
                    bbox_x=200.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_3',
                    detected_value='QD',
                    confidence=0.85,
                    bbox_x=300.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.commit()
        finally:
            db.close()

        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201

        db = SessionLocal()
        try:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 0
        finally:
            db.close()

    def test_corrections_for_hole_cards(self, client, game_id):
        """Corrections created for changed hole cards."""
        upload_id = _upload_and_detect(client, game_id)

        db = SessionLocal()
        try:
            db.query(CardDetection).filter(
                CardDetection.upload_id == upload_id
            ).delete()
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_1',
                    detected_value='AS',
                    confidence=0.95,
                    bbox_x=100.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_2',
                    detected_value='KH',
                    confidence=0.90,
                    bbox_x=200.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_3',
                    detected_value='QD',
                    confidence=0.85,
                    bbox_x=300.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='hole_1',
                    detected_value='2H',
                    confidence=0.88,
                    bbox_x=100.0,
                    bbox_y=300.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='hole_2',
                    detected_value='3D',
                    confidence=0.82,
                    bbox_x=200.0,
                    bbox_y=300.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.commit()
        finally:
            db.close()

        # Confirm with hole cards changed
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
            },
            'player_hands': [
                {
                    'player_name': 'Alice',
                    'card_1': {'rank': '9', 'suit': 'H'},  # Changed from 2H
                    'card_2': {'rank': '8', 'suit': 'D'},  # Changed from 3D
                },
            ],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201

        db = SessionLocal()
        try:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 2
            positions = {c.card_position for c in corrections}
            assert positions == {'hole_1', 'hole_2'}
        finally:
            db.close()

    def test_correction_uses_detection_position_keys(self, client, game_id):
        """AC-5: Correction position keys match flop_1, turn, hole_1, etc."""
        upload_id = _upload_and_detect(client, game_id)

        db = SessionLocal()
        try:
            db.query(CardDetection).filter(
                CardDetection.upload_id == upload_id
            ).delete()
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_1',
                    detected_value='AS',
                    confidence=0.95,
                    bbox_x=100.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_2',
                    detected_value='KH',
                    confidence=0.90,
                    bbox_x=200.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='flop_3',
                    detected_value='QD',
                    confidence=0.85,
                    bbox_x=300.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='turn',
                    detected_value='JC',
                    confidence=0.80,
                    bbox_x=400.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.add(
                CardDetection(
                    upload_id=upload_id,
                    card_position='river',
                    detected_value='10S',
                    confidence=0.78,
                    bbox_x=500.0,
                    bbox_y=50.0,
                    bbox_width=60.0,
                    bbox_height=80.0,
                )
            )
            db.commit()
        finally:
            db.close()

        # Confirm with turn and river changed
        payload = {
            'community_cards': {
                'flop_1': {'rank': 'A', 'suit': 'S'},
                'flop_2': {'rank': 'K', 'suit': 'H'},
                'flop_3': {'rank': 'Q', 'suit': 'D'},
                'turn': {'rank': '2', 'suit': 'C'},  # Changed from JC
                'river': {'rank': '3', 'suit': 'S'},  # Changed from 10S
            },
            'player_hands': [],
        }
        resp = client.post(
            f'/games/{game_id}/hands/image/{upload_id}/confirm',
            json=payload,
        )
        assert resp.status_code == 201

        db = SessionLocal()
        try:
            corrections = (
                db.query(DetectionCorrection)
                .filter(DetectionCorrection.upload_id == upload_id)
                .all()
            )
            assert len(corrections) == 2
            by_pos = {c.card_position: c for c in corrections}
            assert 'turn' in by_pos
            assert 'river' in by_pos
            assert by_pos['turn'].detected_value == 'JC'
            assert by_pos['turn'].corrected_value == '2C'
            assert by_pos['river'].detected_value == '10S'
            assert by_pos['river'].corrected_value == '3S'
        finally:
            db.close()
