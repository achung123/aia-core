"""Tests for app.services.hand_state — extracted game-state logic."""

import pytest
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import Session, sessionmaker

from app.database.models import (
    Base,
    GamePlayer,
    GameSession,
    Hand,
    HandState,
    Player,
    PlayerHand,
    PlayerHandAction,
)
from app.services.hand_state import (
    PHASE_ORDER,
    activate_preflop,
    can_advance_to_phase,
    count_community_cards,
    first_to_act_seat,
    get_actions_this_street,
    get_active_seat_order,
    next_seat,
    try_advance_phase,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

engine = create_engine(
    'sqlite:///:memory:',
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestSession()
    try:
        yield session
    finally:
        session.close()


def _seed_game(db: Session, *, sb=0.10, bb=0.20) -> GameSession:
    """Create a game session with default blinds."""
    from datetime import date

    game = GameSession(game_date=date(2026, 4, 13), small_blind=sb, big_blind=bb)
    db.add(game)
    db.flush()
    return game


def _add_player(db: Session, name: str) -> Player:
    player = Player(name=name)
    db.add(player)
    db.flush()
    return player


def _seat_player(db: Session, game_id: int, player_id: int, seat: int) -> GamePlayer:
    gp = GamePlayer(
        game_id=game_id, player_id=player_id, is_active=True, seat_number=seat
    )
    db.add(gp)
    db.flush()
    return gp


def _make_hand(
    db: Session,
    game_id: int,
    *,
    sb_player_id: int,
    bb_player_id: int,
    player_ids: list[int],
    flop_1=None,
    flop_2=None,
    flop_3=None,
    turn=None,
    river=None,
) -> Hand:
    hand = Hand(
        game_id=game_id,
        hand_number=1,
        sb_player_id=sb_player_id,
        bb_player_id=bb_player_id,
        flop_1=flop_1,
        flop_2=flop_2,
        flop_3=flop_3,
        turn=turn,
        river=river,
    )
    db.add(hand)
    db.flush()
    for pid in player_ids:
        db.add(PlayerHand(hand_id=hand.hand_id, player_id=pid))
    db.flush()
    db.refresh(hand)
    return hand


# ---------------------------------------------------------------------------
# count_community_cards
# ---------------------------------------------------------------------------


class TestCountCommunityCards:
    def test_no_cards(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        assert count_community_cards(hand) == 0

    def test_flop_dealt(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
            flop_1='Ah',
            flop_2='Kd',
            flop_3='Qs',
        )
        assert count_community_cards(hand) == 3

    def test_turn_dealt(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
            flop_1='Ah',
            flop_2='Kd',
            flop_3='Qs',
            turn='Jc',
        )
        assert count_community_cards(hand) == 4

    def test_river_dealt(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
            flop_1='Ah',
            flop_2='Kd',
            flop_3='Qs',
            turn='Jc',
            river='Th',
        )
        assert count_community_cards(hand) == 5


# ---------------------------------------------------------------------------
# can_advance_to_phase
# ---------------------------------------------------------------------------


class TestCanAdvanceToPhase:
    def _hand_with_cards(self, db, **kwargs):
        game = _seed_game(db)
        p1 = _add_player(db, 'X')
        p2 = _add_player(db, 'Y')
        return _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
            **kwargs,
        )

    def test_preflop_always_ok(self, db: Session):
        hand = self._hand_with_cards(db)
        assert can_advance_to_phase(hand, 'preflop') is True

    def test_flop_needs_3_cards(self, db: Session):
        hand = self._hand_with_cards(db)
        assert can_advance_to_phase(hand, 'flop') is False

    def test_flop_ok_with_3_cards(self, db: Session):
        hand = self._hand_with_cards(db, flop_1='Ah', flop_2='Kd', flop_3='Qs')
        assert can_advance_to_phase(hand, 'flop') is True

    def test_turn_needs_4_cards(self, db: Session):
        hand = self._hand_with_cards(db, flop_1='Ah', flop_2='Kd', flop_3='Qs')
        assert can_advance_to_phase(hand, 'turn') is False

    def test_turn_ok_with_4_cards(self, db: Session):
        hand = self._hand_with_cards(
            db, flop_1='Ah', flop_2='Kd', flop_3='Qs', turn='Jc'
        )
        assert can_advance_to_phase(hand, 'turn') is True

    def test_river_needs_5_cards(self, db: Session):
        hand = self._hand_with_cards(
            db, flop_1='Ah', flop_2='Kd', flop_3='Qs', turn='Jc'
        )
        assert can_advance_to_phase(hand, 'river') is False

    def test_river_ok_with_5_cards(self, db: Session):
        hand = self._hand_with_cards(
            db, flop_1='Ah', flop_2='Kd', flop_3='Qs', turn='Jc', river='Th'
        )
        assert can_advance_to_phase(hand, 'river') is True

    def test_showdown_needs_5_cards(self, db: Session):
        hand = self._hand_with_cards(
            db, flop_1='Ah', flop_2='Kd', flop_3='Qs', turn='Jc'
        )
        assert can_advance_to_phase(hand, 'showdown') is False

    def test_showdown_ok_with_5_cards(self, db: Session):
        hand = self._hand_with_cards(
            db, flop_1='Ah', flop_2='Kd', flop_3='Qs', turn='Jc', river='Th'
        )
        assert can_advance_to_phase(hand, 'showdown') is True


# ---------------------------------------------------------------------------
# get_active_seat_order
# ---------------------------------------------------------------------------


class TestGetActiveSeatOrder:
    def test_returns_active_players_sorted_by_seat(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        p3 = _add_player(db, 'C')
        _seat_player(db, game.game_id, p1.player_id, 3)
        _seat_player(db, game.game_id, p2.player_id, 1)
        _seat_player(db, game.game_id, p3.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id, p3.player_id],
        )
        seats = get_active_seat_order(db, game.game_id, hand)
        assert seats == [
            (1, p2.player_id),
            (2, p3.player_id),
            (3, p1.player_id),
        ]

    def test_excludes_folded_players(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        # Mark p1 as folded
        ph = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p1.player_id,
            )
            .first()
        )
        ph.result = 'folded'
        db.flush()
        db.refresh(hand)

        seats = get_active_seat_order(db, game.game_id, hand)
        assert len(seats) == 1
        assert seats[0][1] == p2.player_id

    def test_excludes_all_in_when_flag_set(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        ph = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p1.player_id,
            )
            .first()
        )
        ph.is_all_in = True
        db.flush()
        db.refresh(hand)

        seats_with_all_in = get_active_seat_order(db, game.game_id, hand)
        assert len(seats_with_all_in) == 2  # all-in NOT excluded by default

        seats_without_all_in = get_active_seat_order(
            db, game.game_id, hand, exclude_all_in=True
        )
        assert len(seats_without_all_in) == 1
        assert seats_without_all_in[0][1] == p2.player_id

    def test_inactive_player_excluded(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        gp1 = _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        gp1.is_active = False
        db.flush()
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        seats = get_active_seat_order(db, game.game_id, hand)
        assert len(seats) == 1
        assert seats[0][1] == p2.player_id


# ---------------------------------------------------------------------------
# first_to_act_seat
# ---------------------------------------------------------------------------


class TestFirstToActSeat:
    def _setup_3_players(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        p3 = _add_player(db, 'C')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        _seat_player(db, game.game_id, p3.player_id, 3)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id, p3.player_id],
        )
        return game, hand, p1, p2, p3

    def test_preflop_first_after_bb(self, db: Session):
        game, hand, p1, p2, p3 = self._setup_3_players(db)
        # BB is seat 2, so first-to-act is seat 3
        seat = first_to_act_seat(db, game.game_id, hand, 'preflop')
        assert seat == 3

    def test_preflop_wraps_around(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        # BB is seat 2, no seats > 2, so wraps to seat 1
        seat = first_to_act_seat(db, game.game_id, hand, 'preflop')
        assert seat == 1

    def test_postflop_starts_at_sb_seat(self, db: Session):
        game, hand, p1, p2, p3 = self._setup_3_players(db)
        # SB is seat 1
        seat = first_to_act_seat(db, game.game_id, hand, 'flop')
        assert seat == 1

    def test_no_active_players_returns_none(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        gp1 = _seat_player(db, game.game_id, p1.player_id, 1)
        gp2 = _seat_player(db, game.game_id, p2.player_id, 2)
        gp1.is_active = False
        gp2.is_active = False
        db.flush()
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        assert first_to_act_seat(db, game.game_id, hand, 'preflop') is None


# ---------------------------------------------------------------------------
# next_seat
# ---------------------------------------------------------------------------


class TestNextSeat:
    def test_advances_to_next(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        p3 = _add_player(db, 'C')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        _seat_player(db, game.game_id, p3.player_id, 3)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id, p3.player_id],
        )
        assert next_seat(db, game.game_id, hand, 1) == 2

    def test_wraps_around(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        assert next_seat(db, game.game_id, hand, 2) == 1

    def test_empty_seats_returns_none(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        gp1 = _seat_player(db, game.game_id, p1.player_id, 1)
        gp2 = _seat_player(db, game.game_id, p2.player_id, 2)
        gp1.is_active = False
        gp2.is_active = False
        db.flush()
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        assert next_seat(db, game.game_id, hand, 1) is None

    def test_uses_seats_cache(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        cache = [(1, p1.player_id), (2, p2.player_id)]
        assert next_seat(db, game.game_id, hand, 1, seats_cache=cache) == 2


# ---------------------------------------------------------------------------
# get_actions_this_street
# ---------------------------------------------------------------------------


class TestGetActionsThisStreet:
    def test_returns_actions_for_street(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        ph1 = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p1.player_id,
            )
            .first()
        )
        ph2 = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p2.player_id,
            )
            .first()
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph1.player_hand_id,
                street='preflop',
                action='blind',
                amount=0.10,
            )
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph2.player_hand_id,
                street='preflop',
                action='blind',
                amount=0.20,
            )
        )
        db.flush()

        actions = get_actions_this_street(db, hand, 'preflop')
        assert len(actions) == 2
        assert actions[0]['action'] == 'blind'
        assert actions[0]['amount'] == 0.10
        assert actions[1]['amount'] == 0.20

    def test_different_street_not_returned(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        ph1 = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p1.player_id,
            )
            .first()
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph1.player_hand_id,
                street='preflop',
                action='blind',
                amount=0.10,
            )
        )
        db.flush()

        actions = get_actions_this_street(db, hand, 'flop')
        assert actions == []


# ---------------------------------------------------------------------------
# activate_preflop
# ---------------------------------------------------------------------------


class TestActivatePreflop:
    def test_posts_blinds_and_sets_phase(self, db: Session):
        game = _seed_game(db, sb=0.50, bb=1.00)
        p1 = _add_player(db, 'SB')
        p2 = _add_player(db, 'BB')
        p3 = _add_player(db, 'UTG')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        _seat_player(db, game.game_id, p3.player_id, 3)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id, p3.player_id],
        )
        state = HandState(
            hand_id=hand.hand_id, phase='awaiting_cards', current_seat=None
        )
        db.add(state)
        db.flush()

        activate_preflop(db, game.game_id, hand, state)
        db.flush()

        assert state.phase == 'preflop'
        assert hand.pot == 1.50  # 0.50 + 1.00
        # First-to-act should be seat 3 (UTG, after BB at seat 2)
        assert state.current_seat == 3

        # Verify blind actions were created
        actions = get_actions_this_street(db, hand, 'preflop')
        assert len(actions) == 2
        blind_amounts = {a['amount'] for a in actions}
        assert blind_amounts == {0.50, 1.00}


# ---------------------------------------------------------------------------
# try_advance_phase
# ---------------------------------------------------------------------------


class TestTryAdvancePhase:
    def test_does_not_advance_with_single_player(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        gp2 = _seat_player(db, game.game_id, p2.player_id, 2)
        gp2.is_active = False
        db.flush()
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        state = HandState(hand_id=hand.hand_id, phase='preflop', current_seat=1)
        db.add(state)
        db.flush()

        result = try_advance_phase(db, game.game_id, hand, state)
        assert result is False
        assert state.phase == 'preflop'

    def test_does_not_advance_at_showdown(self, db: Session):
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
            flop_1='Ah',
            flop_2='Kd',
            flop_3='Qs',
            turn='Jc',
            river='Th',
        )
        state = HandState(hand_id=hand.hand_id, phase='showdown', current_seat=None)
        db.add(state)
        db.flush()

        result = try_advance_phase(db, game.game_id, hand, state)
        assert result is False

    def test_clears_current_seat_when_cards_missing(self, db: Session):
        """Street is complete but next phase needs community cards not yet dealt."""
        game = _seed_game(db)
        p1 = _add_player(db, 'A')
        p2 = _add_player(db, 'B')
        _seat_player(db, game.game_id, p1.player_id, 1)
        _seat_player(db, game.game_id, p2.player_id, 2)
        hand = _make_hand(
            db,
            game.game_id,
            sb_player_id=p1.player_id,
            bb_player_id=p2.player_id,
            player_ids=[p1.player_id, p2.player_id],
        )
        state = HandState(hand_id=hand.hand_id, phase='preflop', current_seat=1)
        db.add(state)
        db.flush()

        # Post blinds + SB calls + BB checks
        ph1 = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p1.player_id,
            )
            .first()
        )
        ph2 = (
            db.query(PlayerHand)
            .filter(
                PlayerHand.hand_id == hand.hand_id,
                PlayerHand.player_id == p2.player_id,
            )
            .first()
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph1.player_hand_id,
                street='preflop',
                action='blind',
                amount=0.10,
            )
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph2.player_hand_id,
                street='preflop',
                action='blind',
                amount=0.20,
            )
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph1.player_hand_id,
                street='preflop',
                action='call',
                amount=0.10,
            )
        )
        db.add(
            PlayerHandAction(
                player_hand_id=ph2.player_hand_id,
                street='preflop',
                action='check',
                amount=0,
            )
        )
        db.flush()

        # Provide actions and seats via cache to avoid stale relationship issues
        actions_data = [
            {'player_id': p1.player_id, 'action': 'blind', 'amount': 0.10},
            {'player_id': p2.player_id, 'action': 'blind', 'amount': 0.20},
            {'player_id': p1.player_id, 'action': 'call', 'amount': 0.10},
            {'player_id': p2.player_id, 'action': 'check', 'amount': 0},
        ]
        seats_data = [(1, p1.player_id), (2, p2.player_id)]

        result = try_advance_phase(
            db,
            game.game_id,
            hand,
            state,
            actions_cache=actions_data,
            seats_cache=seats_data,
        )
        assert result is True
        # Phase can't advance to flop because no community cards
        assert state.phase == 'preflop'
        assert state.current_seat is None


# ---------------------------------------------------------------------------
# PHASE_ORDER constant
# ---------------------------------------------------------------------------


class TestPhaseOrder:
    def test_has_expected_phases(self):
        assert PHASE_ORDER == [
            'awaiting_cards',
            'preflop',
            'flop',
            'turn',
            'river',
            'showdown',
        ]

    def test_preflop_before_flop(self):
        assert PHASE_ORDER.index('preflop') < PHASE_ORDER.index('flop')
