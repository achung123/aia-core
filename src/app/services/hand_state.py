"""Hand state logic — pure game-state functions extracted from routes/hands.py."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.models import (
    GamePlayer,
    GameSession,
    Hand,
    HandState,
    PlayerHand,
    PlayerHandAction,
)
from app.services.betting import is_street_complete

PHASE_ORDER = ['awaiting_cards', 'preflop', 'flop', 'turn', 'river', 'showdown']


def get_active_seat_order(
    db: Session,
    game_id: int,
    hand: Hand,
    exclude_all_in: bool = False,
) -> list[tuple[int, int]]:
    """Return list of (seat_number, player_id) for active non-folded players, sorted by seat."""
    active_gps = (
        db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id, GamePlayer.is_active.is_(True))
        .order_by(
            func.coalesce(GamePlayer.seat_number, 999999),
            GamePlayer.player_id,
        )
        .all()
    )
    folded_ids = {ph.player_id for ph in hand.player_hands if ph.result == 'folded'}
    excluded = set(folded_ids)
    if exclude_all_in:
        excluded |= {ph.player_id for ph in hand.player_hands if ph.is_all_in}
    return [
        (gp.seat_number or 0, gp.player_id)
        for gp in active_gps
        if gp.player_id not in excluded
    ]


def first_to_act_seat(
    db: Session,
    game_id: int,
    hand: Hand,
    phase: str,
) -> int | None:
    """Determine the first-to-act seat for a given phase."""
    seats = get_active_seat_order(db, game_id, hand)
    if not seats:
        return None

    if phase == 'preflop':
        # First-to-act is the player after BB
        bb_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id, GamePlayer.player_id == hand.bb_player_id
            )
            .first()
        )
        bb_seat = bb_gp.seat_number if bb_gp and bb_gp.seat_number else 0
        # Find first active non-folded seat after BB
        after_bb = [s for s in seats if s[0] > bb_seat]
        if after_bb:
            return after_bb[0][0]
        # Wrap around
        return seats[0][0]
    else:
        # Post-flop: first active non-folded player after dealer (SB seat)
        sb_gp = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id, GamePlayer.player_id == hand.sb_player_id
            )
            .first()
        )
        sb_seat = sb_gp.seat_number if sb_gp and sb_gp.seat_number else 0
        # SB acts first post-flop (seat >= sb_seat)
        at_or_after = [s for s in seats if s[0] >= sb_seat]
        if at_or_after:
            return at_or_after[0][0]
        return seats[0][0]


def next_seat(
    db: Session,
    game_id: int,
    hand: Hand,
    current_seat: int | None,
    *,
    seats_cache: list[tuple[int, int]] | None = None,
) -> int | None:
    """Advance to the next non-folded, non-all-in active player seat after current_seat."""
    seats = (
        seats_cache
        if seats_cache is not None
        else get_active_seat_order(db, game_id, hand, exclude_all_in=True)
    )
    if not seats:
        return None
    if current_seat is None:
        return seats[0][0]
    after = [s for s in seats if s[0] > current_seat]
    if after:
        return after[0][0]
    return seats[0][0]


def count_community_cards(hand: Hand) -> int:
    """Count the number of community cards dealt so far."""
    count = 0
    if hand.flop_1 is not None:
        count += 3
    if hand.turn is not None:
        count += 1
    if hand.river is not None:
        count += 1
    return count


def can_advance_to_phase(hand: Hand, target_phase: str) -> bool:
    """Check if community cards are sufficient for the target phase."""
    cc = count_community_cards(hand)
    if target_phase == 'flop':
        return cc >= 3
    if target_phase == 'turn':
        return cc >= 4
    if target_phase == 'river':
        return cc >= 5
    if target_phase == 'showdown':
        return cc >= 5
    return True  # preflop always ok


def get_actions_this_street(db: Session, hand: Hand, street: str) -> list[dict]:
    """Get all actions for a given street as dicts for the betting module."""
    actions = (
        db.query(PlayerHandAction, PlayerHand.player_id)
        .join(PlayerHand, PlayerHandAction.player_hand_id == PlayerHand.player_hand_id)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHandAction.street == street,
        )
        .order_by(PlayerHandAction.created_at)
        .all()
    )
    return [
        {'player_id': pid, 'action': a.action, 'amount': a.amount} for a, pid in actions
    ]


def try_advance_phase(
    db: Session,
    game_id: int,
    hand: Hand,
    state: HandState,
    *,
    actions_cache: list[dict] | None = None,
    seats_cache: list[tuple[int, int]] | None = None,
) -> bool:
    """If all non-folded players have acted with equalized bets, try to advance.

    Returns True if any state was modified, False otherwise.
    """
    seats = (
        seats_cache
        if seats_cache is not None
        else get_active_seat_order(db, game_id, hand)
    )
    if len(seats) <= 1:
        return False

    active_non_folded_ids = {pid for _, pid in seats}
    all_in_ids = {ph.player_id for ph in hand.player_hands if ph.is_all_in}

    actions_this_street = (
        actions_cache
        if actions_cache is not None
        else get_actions_this_street(db, hand, state.phase)
    )

    if not is_street_complete(
        actions_this_street,
        active_non_folded_ids,
        all_in_ids,
        state.phase,
        hand.bb_player_id,
    ):
        return False

    # All acted — try to advance
    phase_idx = PHASE_ORDER.index(state.phase)
    if phase_idx >= len(PHASE_ORDER) - 1:
        return False  # Already at showdown

    next_phase = PHASE_ORDER[phase_idx + 1]

    # Refresh hand to get latest community cards
    db.refresh(hand)
    if not can_advance_to_phase(hand, next_phase):
        # Street is complete but community cards aren't dealt yet.
        # Clear current_seat so no player is prompted to act.
        state.current_seat = None
        return True  # Can't advance yet — not enough community cards

    state.phase = next_phase
    state.current_seat = first_to_act_seat(db, game_id, hand, next_phase)

    # Showdown is terminal — no player should act
    if next_phase == 'showdown':
        state.current_seat = None

    return True


def activate_preflop(db: Session, game_id: int, hand: Hand, state: HandState) -> None:
    """Transition from awaiting_cards to preflop: post blinds and set first-to-act."""
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    sb = game.small_blind if game else 0.10
    bb = game.big_blind if game else 0.20

    sb_ph = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == hand.sb_player_id,
        )
        .first()
    )
    bb_ph = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == hand.bb_player_id,
        )
        .first()
    )
    db.add(
        PlayerHandAction(
            player_hand_id=sb_ph.player_hand_id,
            street='preflop',
            action='blind',
            amount=sb,
        )
    )
    db.add(
        PlayerHandAction(
            player_hand_id=bb_ph.player_hand_id,
            street='preflop',
            action='blind',
            amount=bb,
        )
    )
    hand.pot = sb + bb

    # Deduct blinds from player chip stacks
    sb_gp = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == hand.sb_player_id,
        )
        .first()
    )
    bb_gp = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == hand.bb_player_id,
        )
        .first()
    )
    if sb_gp and sb_gp.current_chips is not None:
        sb_gp.current_chips = round(sb_gp.current_chips - sb, 2)
    if bb_gp and bb_gp.current_chips is not None:
        bb_gp.current_chips = round(bb_gp.current_chips - bb, 2)

    state.phase = 'preflop'
    state.current_seat = first_to_act_seat(db, game_id, hand, 'preflop')
