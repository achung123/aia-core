"""Tests for multi-CSV ZIP export and import of full game data."""

import csv
import io
import zipfile
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.database.models import (
    Base,
    GamePlayer,
    GameSession,
    Hand,
    Player,
    PlayerHand,
    PlayerHandAction,
    Rebuy,
)


# ── Helpers ───────────────────────────────────────────────


def _seed_full_game(db):
    """Create a game with players, hands, actions, and rebuys."""
    game = GameSession(
        game_date=date(2026, 4, 10),
        status='completed',
        small_blind=0.10,
        big_blind=0.20,
        blind_timer_minutes=15,
        default_buy_in=20.0,
        winners='["Alice"]',
    )
    db.add(game)
    db.flush()

    alice = Player(name='Alice')
    bob = Player(name='Bob')
    db.add_all([alice, bob])
    db.flush()

    gp_alice = GamePlayer(
        game_id=game.game_id,
        player_id=alice.player_id,
        seat_number=1,
        buy_in=20.0,
        current_chips=25.0,
        is_active=True,
    )
    gp_bob = GamePlayer(
        game_id=game.game_id,
        player_id=bob.player_id,
        seat_number=2,
        buy_in=20.0,
        current_chips=15.0,
        is_active=True,
    )
    db.add_all([gp_alice, gp_bob])
    db.flush()

    hand = Hand(
        game_id=game.game_id,
        hand_number=1,
        flop_1='AH',
        flop_2='KD',
        flop_3='QC',
        turn='JS',
        river='TC',
        sb_player_id=alice.player_id,
        bb_player_id=bob.player_id,
        pot=5.0,
    )
    db.add(hand)
    db.flush()

    ph_alice = PlayerHand(
        hand_id=hand.hand_id,
        player_id=alice.player_id,
        card_1='2H',
        card_2='3H',
        result='won',
        profit_loss=2.5,
        outcome_street='river',
        is_all_in=False,
    )
    ph_bob = PlayerHand(
        hand_id=hand.hand_id,
        player_id=bob.player_id,
        card_1='4D',
        card_2='5D',
        result='lost',
        profit_loss=-2.5,
        outcome_street='flop',
        is_all_in=True,
    )
    db.add_all([ph_alice, ph_bob])
    db.flush()

    # Actions
    action1 = PlayerHandAction(
        player_hand_id=ph_alice.player_hand_id,
        street='preflop',
        action='call',
        amount=0.20,
    )
    action2 = PlayerHandAction(
        player_hand_id=ph_bob.player_hand_id,
        street='preflop',
        action='raise',
        amount=0.60,
    )
    action3 = PlayerHandAction(
        player_hand_id=ph_alice.player_hand_id,
        street='flop',
        action='check',
        amount=None,
    )
    db.add_all([action1, action2, action3])
    db.flush()

    # Rebuy
    rebuy = Rebuy(
        game_id=game.game_id,
        player_id=bob.player_id,
        amount=20.0,
    )
    db.add(rebuy)
    db.commit()

    return game


# ── ZIP Export Tests ──────────────────────────────────────


class TestZipExport:
    def test_export_zip_returns_zip_file(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        assert resp.status_code == 200
        assert resp.headers['content-type'] == 'application/zip'
        assert 'attachment' in resp.headers['content-disposition']

    def test_export_zip_contains_expected_files(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = set(zf.namelist())
        assert names == {
            'game_info.csv',
            'players.csv',
            'hands.csv',
            'actions.csv',
            'rebuys.csv',
        }

    def test_export_zip_game_info_csv(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        reader = csv.DictReader(io.StringIO(zf.read('game_info.csv').decode()))
        rows = list(reader)
        assert len(rows) == 1
        row = rows[0]
        assert row['game_date'] == '04-10-2026'
        assert row['status'] == 'completed'
        assert row['small_blind'] == '0.1'
        assert row['big_blind'] == '0.2'
        assert row['blind_timer_minutes'] == '15'
        assert row['default_buy_in'] == '20.0'
        assert row['winners'] == 'Alice'

    def test_export_zip_players_csv(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        reader = csv.DictReader(io.StringIO(zf.read('players.csv').decode()))
        rows = list(reader)
        assert len(rows) == 2
        by_name = {r['player_name']: r for r in rows}
        assert by_name['Alice']['seat_number'] == '1'
        assert by_name['Alice']['buy_in'] == '20.0'
        assert by_name['Alice']['current_chips'] == '25.0'
        assert by_name['Bob']['seat_number'] == '2'

    def test_export_zip_hands_csv(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        reader = csv.DictReader(io.StringIO(zf.read('hands.csv').decode()))
        rows = list(reader)
        assert len(rows) == 2  # one row per player-hand

        # First 12 columns match legacy CSV format
        alice_row = next(r for r in rows if r['player_name'] == 'Alice')
        assert alice_row['game_date'] == '04-10-2026'
        assert alice_row['hand_number'] == '1'
        assert alice_row['hole_card_1'] == '2H'
        assert alice_row['hole_card_2'] == '3H'
        assert alice_row['flop_1'] == 'AH'
        assert alice_row['result'] == 'won'
        assert alice_row['profit_loss'] == '2.5'

        # New columns
        assert alice_row['outcome_street'] == 'river'
        assert alice_row['is_all_in'] == 'false'

        bob_row = next(r for r in rows if r['player_name'] == 'Bob')
        assert bob_row['outcome_street'] == 'flop'
        assert bob_row['is_all_in'] == 'true'

    def test_export_zip_actions_csv(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        reader = csv.DictReader(io.StringIO(zf.read('actions.csv').decode()))
        rows = list(reader)
        assert len(rows) == 3
        # Check first action
        preflop_actions = [r for r in rows if r['street'] == 'preflop']
        assert len(preflop_actions) == 2
        flop_actions = [r for r in rows if r['street'] == 'flop']
        assert len(flop_actions) == 1
        assert flop_actions[0]['action'] == 'check'
        assert flop_actions[0]['amount'] == ''

    def test_export_zip_rebuys_csv(self, client, db_session):
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/zip')
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        reader = csv.DictReader(io.StringIO(zf.read('rebuys.csv').decode()))
        rows = list(reader)
        assert len(rows) == 1
        assert rows[0]['player_name'] == 'Bob'
        assert rows[0]['amount'] == '20.0'

    def test_export_zip_404_for_missing_game(self, client):
        resp = client.get('/games/9999/export/zip')
        assert resp.status_code == 404

    def test_export_zip_empty_game(self, client, db_session):
        """A game with no hands still exports correctly."""
        game = GameSession(
            game_date=date(2026, 4, 10), status='active', small_blind=0.10, big_blind=0.20
        )
        db_session.add(game)
        db_session.commit()

        resp = client.get(f'/games/{game.game_id}/export/zip')
        assert resp.status_code == 200
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        # hands.csv should have header only
        reader = csv.DictReader(io.StringIO(zf.read('hands.csv').decode()))
        assert list(reader) == []


# ── Enhanced Single-CSV Export Tests ──────────────────────


class TestEnhancedCsvExport:
    def test_single_csv_includes_new_columns(self, client, db_session):
        """Existing CSV export should include outcome_street and is_all_in."""
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/csv')
        assert resp.status_code == 200
        reader = csv.DictReader(io.StringIO(resp.text))
        rows = list(reader)
        assert len(rows) == 2
        alice_row = next(r for r in rows if r['player_name'] == 'Alice')
        assert alice_row['outcome_street'] == 'river'
        assert alice_row['is_all_in'] == 'false'

    def test_single_csv_backward_compat_first_12_columns(self, client, db_session):
        """First 12 columns of the CSV should match the old format exactly."""
        game = _seed_full_game(db_session)
        resp = client.get(f'/games/{game.game_id}/export/csv')
        reader = csv.reader(io.StringIO(resp.text))
        headers = next(reader)
        # First 12 must be the original columns
        expected_original = [
            'game_date', 'hand_number', 'player_name',
            'hole_card_1', 'hole_card_2',
            'flop_1', 'flop_2', 'flop_3', 'turn', 'river',
            'result', 'profit_loss',
        ]
        assert headers[:12] == expected_original
        # New columns appended
        assert 'outcome_street' in headers
        assert 'is_all_in' in headers


# ── Backward Compatible CSV Import Tests ──────────────────


class TestBackwardCompatCsvImport:
    def test_old_12_column_csv_still_validates(self, client):
        """Legacy CSV with 12 columns should still pass validation."""
        csv_text = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss\n'
            '04-10-2026,1,Alice,AH,KD,QC,JS,10C,2H,3H,won,5.0\n'
        )
        resp = client.post(
            '/upload/csv',
            files={'file': ('test.csv', csv_text.encode(), 'text/csv')},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['valid'] is True

    def test_new_14_column_csv_validates(self, client):
        """Enhanced CSV with 14 columns (outcome_street, is_all_in) should validate."""
        csv_text = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss,'
            'outcome_street,is_all_in\n'
            '04-10-2026,1,Alice,AH,KD,QC,JS,10C,2H,3H,won,5.0,river,false\n'
        )
        resp = client.post(
            '/upload/csv',
            files={'file': ('test.csv', csv_text.encode(), 'text/csv')},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['valid'] is True

    def test_new_14_column_csv_commits_with_outcome_street(self, client):
        """Enhanced CSV commit should persist outcome_street and is_all_in."""
        csv_text = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss,'
            'outcome_street,is_all_in\n'
            '04-10-2026,1,Alice,AH,KD,QC,JS,10C,2H,3H,won,5.0,river,true\n'
        )
        resp = client.post(
            '/upload/csv/commit',
            files={'file': ('test.csv', csv_text.encode(), 'text/csv')},
        )
        assert resp.status_code == 201

        # Verify the data was persisted — fetch the game's hands
        games_resp = client.get('/games')
        game_id = games_resp.json()[0]['game_id']
        hands_resp = client.get(f'/games/{game_id}/hands')
        hands = hands_resp.json()
        assert len(hands) == 1
        ph = hands[0]['player_hands'][0]
        assert ph['outcome_street'] == 'river'


# ── ZIP Import Tests ──────────────────────────────────────


def _build_zip(files: dict[str, str]) -> bytes:
    """Build a ZIP file in memory from a dict of {filename: csv_content}."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    buf.seek(0)
    return buf.read()


class TestZipImport:
    def _make_full_zip(self) -> bytes:
        game_info = (
            'game_date,status,small_blind,big_blind,blind_timer_minutes,default_buy_in,winners\n'
            '04-10-2026,completed,0.10,0.20,15,20.0,Alice\n'
        )
        players = (
            'player_name,seat_number,buy_in,current_chips,is_active\n'
            'Alice,1,20.0,25.0,true\n'
            'Bob,2,20.0,15.0,true\n'
        )
        hands = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss,'
            'outcome_street,is_all_in\n'
            '04-10-2026,1,Alice,2H,3H,AH,KD,QC,JS,TC,won,2.5,river,false\n'
            '04-10-2026,1,Bob,4D,5D,AH,KD,QC,JS,TC,lost,-2.5,flop,true\n'
        )
        actions = (
            'hand_number,player_name,street,action,amount\n'
            '1,Alice,preflop,call,0.20\n'
            '1,Bob,preflop,raise,0.60\n'
            '1,Alice,flop,check,\n'
        )
        rebuys = (
            'player_name,amount\n'
            'Bob,20.0\n'
        )
        return _build_zip({
            'game_info.csv': game_info,
            'players.csv': players,
            'hands.csv': hands,
            'actions.csv': actions,
            'rebuys.csv': rebuys,
        })

    def test_zip_import_validate(self, client):
        zip_bytes = self._make_full_zip()
        resp = client.post(
            '/upload/zip',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['valid'] is True
        assert data['files_found'] == 5

    def test_zip_import_commit_creates_game(self, client):
        zip_bytes = self._make_full_zip()
        resp = client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['games_created'] == 1
        assert data['hands_created'] == 1
        assert data['players_created'] == 2
        assert data['actions_created'] == 3
        assert data['rebuys_created'] == 1

    def test_zip_import_commit_persists_game_info(self, client):
        zip_bytes = self._make_full_zip()
        client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        games_resp = client.get('/games')
        games = games_resp.json()
        assert len(games) == 1
        game_id = games[0]['game_id']
        game_resp = client.get(f'/games/{game_id}')
        game = game_resp.json()
        assert game['game_date'] == '2026-04-10'
        assert game['status'] == 'completed'

    def test_zip_import_commit_persists_players(self, client):
        zip_bytes = self._make_full_zip()
        client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        games = client.get('/games').json()
        game_id = games[0]['game_id']
        game = client.get(f'/games/{game_id}').json()
        names = sorted(game['player_names'])
        assert names == ['Alice', 'Bob']

    def test_zip_import_commit_persists_actions(self, client):
        zip_bytes = self._make_full_zip()
        client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        games = client.get('/games').json()
        game_id = games[0]['game_id']
        hands = client.get(f'/games/{game_id}/hands').json()
        assert len(hands) == 1
        # Verify outcome_street is persisted
        alice_ph = next(ph for ph in hands[0]['player_hands'] if ph['player_name'] == 'Alice')
        assert alice_ph['outcome_street'] == 'river'

    def test_zip_import_minimal_hands_only(self, client):
        """ZIP with only game_info.csv and hands.csv should still work."""
        game_info = (
            'game_date,status,small_blind,big_blind,blind_timer_minutes,default_buy_in,winners\n'
            '04-10-2026,active,0.10,0.20,15,,\n'
        )
        hands = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss,'
            'outcome_street,is_all_in\n'
            '04-10-2026,1,Alice,AH,KD,QC,JS,TC,,,won,5.0,,false\n'
        )
        zip_bytes = _build_zip({
            'game_info.csv': game_info,
            'hands.csv': hands,
        })
        resp = client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['games_created'] == 1
        assert data['hands_created'] == 1

    def test_zip_import_rejects_missing_game_info(self, client):
        """ZIP without game_info.csv should be rejected."""
        hands = (
            'game_date,hand_number,player_name,hole_card_1,hole_card_2,'
            'flop_1,flop_2,flop_3,turn,river,result,profit_loss\n'
            '04-10-2026,1,Alice,AH,KD,QC,JS,TC,,,won,5.0\n'
        )
        zip_bytes = _build_zip({'hands.csv': hands})
        resp = client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        assert resp.status_code == 400

    def test_zip_import_rejects_missing_hands(self, client):
        """ZIP without hands.csv should be rejected."""
        game_info = (
            'game_date,status,small_blind,big_blind,blind_timer_minutes,default_buy_in,winners\n'
            '04-10-2026,active,0.10,0.20,15,,\n'
        )
        zip_bytes = _build_zip({'game_info.csv': game_info})
        resp = client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', zip_bytes, 'application/zip')},
        )
        assert resp.status_code == 400


# ── Round-Trip Test ───────────────────────────────────────


class TestRoundTrip:
    def test_export_then_import_zip(self, client, db_session):
        """Export a game as ZIP, then import it and verify data matches."""
        game = _seed_full_game(db_session)
        original_id = game.game_id

        # Export
        export_resp = client.get(f'/games/{original_id}/export/zip')
        assert export_resp.status_code == 200

        # Import into a fresh state (note: we can't easily reset the DB mid-test,
        # so just verify the import succeeds — it will create new entities)
        resp = client.post(
            '/upload/zip/commit',
            files={'file': ('game.zip', export_resp.content, 'application/zip')},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data['games_created'] == 1
        assert data['hands_created'] == 1
        assert data['players_created'] == 0  # already exist from seed
        assert data['players_matched'] == 2
