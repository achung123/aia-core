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
    folded_ids = {
        player_hand.player_id
        for player_hand in hand.player_hands
        if player_hand.result == 'folded'
    }
    excluded = set(folded_ids)
    if exclude_all_in:
        excluded |= {
            player_hand.player_id
            for player_hand in hand.player_hands
            if player_hand.is_all_in
        }
    return [
        (game_player.seat_number or 0, game_player.player_id)
        for game_player in active_gps
        if game_player.player_id not in excluded
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
        big_blind_game_player = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.player_id == hand.bb_player_id,
            )
            .first()
        )
        big_blind_seat = (
            big_blind_game_player.seat_number
            if big_blind_game_player and big_blind_game_player.seat_number
            else 0
        )
        # Find first active non-folded seat after BB
        after_big_blind = [
            seat_pair for seat_pair in seats if seat_pair[0] > big_blind_seat
        ]
        if after_big_blind:
            return after_big_blind[0][0]
        # Wrap around
        return seats[0][0]
    else:
        # Post-flop: first active non-folded player after dealer (SB seat)
        small_blind_game_player = (
            db.query(GamePlayer)
            .filter(
                GamePlayer.game_id == game_id,
                GamePlayer.player_id == hand.sb_player_id,
            )
            .first()
        )
        small_blind_seat = (
            small_blind_game_player.seat_number
            if small_blind_game_player and small_blind_game_player.seat_number
            else 0
        )
        # SB acts first post-flop (seat >= sb_seat)
        at_or_after = [
            seat_pair for seat_pair in seats if seat_pair[0] >= small_blind_seat
        ]
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
    community_card_count = count_community_cards(hand)
    if target_phase == 'flop':
        return community_card_count >= 3
    if target_phase == 'turn':
        return community_card_count >= 4
    if target_phase == 'river':
        return community_card_count >= 5
    if target_phase == 'showdown':
        return community_card_count >= 5
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
        {
            'player_id': player_id,
            'action': action_record.action,
            'amount': action_record.amount,
        }
        for action_record, player_id in actions
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

    When all remaining players are all-in, cascades through phases until
    community cards are missing or showdown is reached.

    Returns True if any state was modified, False otherwise.
    """
    seats = (
        seats_cache
        if seats_cache is not None
        else get_active_seat_order(db, game_id, hand)
    )
    if len(seats) <= 1:
        return False

    active_non_folded_ids = {player_id for _, player_id in seats}
    all_in_ids = {
        player_hand.player_id
        for player_hand in hand.player_hands
        if player_hand.is_all_in
    }

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

    # Street is complete — advance, cascading when no meaningful betting
    # can occur (0 or 1 non-all-in players).
    no_contest = len(get_active_seat_order(db, game_id, hand, exclude_all_in=True)) <= 1
    modified = False

    while True:
        phase_idx = PHASE_ORDER.index(state.phase)
        if phase_idx >= len(PHASE_ORDER) - 1:
            break  # Already at showdown

        next_phase = PHASE_ORDER[phase_idx + 1]

        # Refresh hand to get latest community cards
        db.refresh(hand)
        if not can_advance_to_phase(hand, next_phase):
            # Street is complete but community cards aren't dealt yet.
            # Clear current_seat so no player is prompted to act.
            state.current_seat = None
            modified = True
            break

        state.phase = next_phase
        modified = True

        # Showdown is terminal — no player should act
        if next_phase == 'showdown':
            state.current_seat = None
            break

        if no_contest:
            # No one can act (or lone player has no opponent) — cascade
            state.current_seat = None
            continue
        else:
            state.current_seat = first_to_act_seat(db, game_id, hand, next_phase)
            break

    return modified


def activate_preflop(db: Session, game_id: int, hand: Hand, state: HandState) -> None:
    """Transition from awaiting_cards to preflop: post blinds and set first-to-act."""
    game = db.query(GameSession).filter(GameSession.game_id == game_id).first()
    small_blind_amount = game.small_blind if game else 0.10
    big_blind_amount = game.big_blind if game else 0.20

    small_blind_player_hand = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == hand.sb_player_id,
        )
        .first()
    )
    big_blind_player_hand = (
        db.query(PlayerHand)
        .filter(
            PlayerHand.hand_id == hand.hand_id,
            PlayerHand.player_id == hand.bb_player_id,
        )
        .first()
    )
    db.add(
        PlayerHandAction(
            player_hand_id=small_blind_player_hand.player_hand_id,
            street='preflop',
            action='blind',
            amount=small_blind_amount,
        )
    )
    db.add(
        PlayerHandAction(
            player_hand_id=big_blind_player_hand.player_hand_id,
            street='preflop',
            action='blind',
            amount=big_blind_amount,
        )
    )
    hand.pot = small_blind_amount + big_blind_amount

    # Deduct blinds from player chip stacks
    small_blind_game_player = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == hand.sb_player_id,
        )
        .first()
    )
    big_blind_game_player = (
        db.query(GamePlayer)
        .filter(
            GamePlayer.game_id == game_id,
            GamePlayer.player_id == hand.bb_player_id,
        )
        .first()
    )
    if small_blind_game_player and small_blind_game_player.current_chips is not None:
        small_blind_game_player.current_chips = round(
            small_blind_game_player.current_chips - small_blind_amount, 2
        )
    if big_blind_game_player and big_blind_game_player.current_chips is not None:
        big_blind_game_player.current_chips = round(
            big_blind_game_player.current_chips - big_blind_amount, 2
        )

    state.phase = 'preflop'
    state.current_seat = first_to_act_seat(db, game_id, hand, 'preflop')
