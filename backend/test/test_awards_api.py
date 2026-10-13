"""Tests for awards endpoint (GET /stats/awards)."""

from datetime import date

import pytest

from app.database.models import GamePlayer, GameSession, Hand, Player, PlayerHand


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_awards_data(db):
    """Seed rich data for awards tests.

    Creates 4 players across 2 games with enough hands to exercise all awards.

    Game 1 (25 hands): Alice, Bob, Charlie
    Game 2 (5 hands): Alice, Bob, Dan

    Player profiles (Game 1):
      Alice:  13 wins, 2 folds, 10 losses — high win rate, long streak
      Bob:     5 wins, 20 folds, 0 losses — paper hands, low win rate
      Charlie: 14 wins, 0 folds, 11 losses — diamond hands, many showdowns

    Player profiles (Game 2):
      Alice: 5 wins → total 18 wins across games
      Bob:   0 wins, 0 folds, 5 losses
      Dan:   3 wins, 2 folds, 0 losses — too few hands for Sniper threshold
    """
    alice = Player(name='Alice')
    bob = Player(name='Bob')
    charlie = Player(name='Charlie')
    dan = Player(name='Dan')
    db.add_all([alice, bob, charlie, dan])
    db.flush()

    game1 = GameSession(game_date=date(2026, 1, 1))
    game2 = GameSession(game_date=date(2026, 1, 8))
    db.add_all([game1, game2])
    db.flush()

    # Register players in games
    for p in [alice, bob, charlie]:
        db.add(GamePlayer(game_id=game1.game_id, player_id=p.player_id))
    for p in [alice, bob, dan]:
        db.add(GamePlayer(game_id=game2.game_id, player_id=p.player_id))
    db.flush()

    # ── Game 1: 25 hands ──
    for i in range(1, 26):
        has_river = i <= 15  # First 15 hands reach the river
        hand = Hand(
            game_id=game1.game_id,
            hand_number=i,
            flop_1='Ah',
            flop_2='Kd',
            flop_3='Qs',
            turn='Jc',
            river='Th' if has_river else None,
        )
        db.add(hand)
        db.flush()

        # Alice: wins 1-5 (streak=5), loses 6-10, wins 11-15, folds 16-17,
        #        wins 18-20, loses 21-25
        if i <= 5:
            a_res, a_pl = 'won', 10.0
        elif i <= 10:
            a_res, a_pl = 'lost', -5.0
        elif i <= 15:
            a_res, a_pl = 'won', 8.0
        elif i <= 17:
            a_res, a_pl = 'folded', 0.0
        elif i <= 20:
            a_res, a_pl = 'won', 12.0
        else:
            a_res, a_pl = 'lost', -3.0

        # Bob: folds every hand except #5,#10,#15,#20,#25 (wins those)
        if i % 5 == 0:
            b_res, b_pl = 'won', 5.0
        else:
            b_res, b_pl = 'folded', -1.0

        # Charlie: wins 1-10, loses 11-21, wins 22-24, loses 25
        if i <= 10:
            c_res, c_pl = 'won', 6.0
        elif i <= 21:
            c_res, c_pl = 'lost', -4.0
        elif i <= 24:
            c_res, c_pl = 'won', 3.0
        else:
            c_res, c_pl = 'lost', -4.0

        for player, result, pl in [
            (alice, a_res, a_pl),
            (bob, b_res, b_pl),
            (charlie, c_res, c_pl),
        ]:
            db.add(
                PlayerHand(
                    hand_id=hand.hand_id,
                    player_id=player.player_id,
                    result=result,
                    profit_loss=pl,
                )
            )

    # ── Game 2: 5 hands ──
    for i in range(1, 6):
        hand = Hand(
            game_id=game2.game_id,
            hand_number=i,
            flop_1='2h',
            flop_2='3d',
            flop_3='4s',
        )
        db.add(hand)
        db.flush()

        # Dan: wins first 3, folds last 2 (only 5 total — below threshold)
        if i <= 3:
            d_res, d_pl = 'won', 4.0
        else:
            d_res, d_pl = 'folded', 0.0

        for player, result, pl in [
            (alice, 'won', 5.0),
            (bob, 'lost', -5.0),
            (dan, d_res, d_pl),
        ]:
            db.add(
                PlayerHand(
                    hand_id=hand.hand_id,
                    player_id=player.player_id,
                    result=result,
                    profit_loss=pl,
                )
            )

    db.commit()
    return game1.game_id, game2.game_id


@pytest.fixture()
def seeded(client, db_session):
    """Seed awards data and return (client, game1_id, game2_id)."""
    gid1, gid2 = _seed_awards_data(db_session)
    return client, gid1, gid2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestAwardsGlobal:
    """Awards computed across all games."""

    def test_returns_at_least_8_awards(self, seeded):
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        assert resp.status_code == 200
        awards = resp.json()
        assert len(awards) >= 8

    def test_all_base_awards_present(self, seeded):
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        names = {a['award_name'] for a in resp.json()}
        expected = {
            'Iron Man',
            'Sniper',
            'Paper Hands',
            'Diamond Hands',
            'River Rat',
            'One and Done',
            'Streak King',
            'Showdown Magnet',
        }
        assert expected.issubset(names)

    def test_pnl_awards_included(self, seeded):
        """Big Stack and Degen should appear when P&L data exists."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        names = {a['award_name'] for a in resp.json()}
        assert 'Big Stack' in names
        assert 'Degen' in names

    def test_iron_man_is_most_hands_played(self, seeded):
        """Iron Man winner should have the most hands (30: Alice or Bob)."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        iron = next(a for a in resp.json() if a['award_name'] == 'Iron Man')
        assert iron['stat_value'] == 30

    def test_paper_hands_is_bob(self, seeded):
        """Bob has the highest fold rate (20/25 in G1 + 0/5 in G2 = 20/30)."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        paper = next(a for a in resp.json() if a['award_name'] == 'Paper Hands')
        assert paper['winner_name'] == 'Bob'

    def test_diamond_hands_is_charlie(self, seeded):
        """Charlie never folds (0% fold rate)."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        diamond = next(a for a in resp.json() if a['award_name'] == 'Diamond Hands')
        assert diamond['winner_name'] == 'Charlie'

    def test_streak_king_is_charlie(self, seeded):
        """Charlie wins hands 1-10 in Game 1 → streak of 10."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        streak = next(a for a in resp.json() if a['award_name'] == 'Streak King')
        assert streak['winner_name'] == 'Charlie'
        assert streak['stat_value'] == 10


class TestAwardsGameScoped:
    """Awards scoped to a single game session."""

    def test_game_scoped_returns_awards(self, seeded):
        client, gid1, _ = seeded
        resp = client.get(f'/stats/awards?game_id={gid1}')
        assert resp.status_code == 200
        assert len(resp.json()) >= 4

    def test_game_scoped_excludes_other_game_players(self, seeded):
        """Dan is only in Game 2 — shouldn't appear in Game 1 awards."""
        client, gid1, _ = seeded
        resp = client.get(f'/stats/awards?game_id={gid1}')
        winners = {a['winner_name'] for a in resp.json()}
        assert 'Dan' not in winners

    def test_game2_scoped_awards(self, seeded):
        """Game 2 has only 5 hands — Sniper threshold should prevent it."""
        client, _, gid2 = seeded
        resp = client.get(f'/stats/awards?game_id={gid2}')
        names = {a['award_name'] for a in resp.json()}
        assert 'Sniper' not in names


class TestAwardsThresholds:
    """Minimum thresholds prevent meaningless awards."""

    def test_sniper_requires_min_hands(self, seeded):
        """Dan has 3 hands with 60% win rate — shouldn't win Sniper."""
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        sniper = next(a for a in resp.json() if a['award_name'] == 'Sniper')
        assert sniper['winner_name'] != 'Dan'


class TestAwardsFieldValidation:
    """Each AwardEntry has all required fields populated."""

    def test_all_fields_non_empty(self, seeded):
        client, _, _ = seeded
        resp = client.get('/stats/awards')
        for award in resp.json():
            assert award['award_name'], 'award_name must not be empty'
            assert award['emoji'], 'emoji must not be empty'
            assert award['description'], 'description must not be empty'
            assert award['winner_name'], 'winner_name must not be empty'
            assert award['stat_label'], 'stat_label must not be empty'
            assert award['stat_value'] is not None, 'stat_value must not be None'


class TestAwardsEmptyData:
    """Edge case: no data at all."""

    def test_empty_db_returns_empty_list(self, client):
        resp = client.get('/stats/awards')
        assert resp.status_code == 200
        assert resp.json() == []

    def test_nonexistent_game_returns_empty(self, client):
        resp = client.get('/stats/awards?game_id=9999')
        assert resp.status_code == 200
        assert resp.json() == []
