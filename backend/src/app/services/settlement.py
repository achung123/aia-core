"""Hand settlement — build pots from contributions, pay winners, record P&L.

All arithmetic is done in integer cents so payouts always sum to the pot.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database.models import (
    GamePlayer,
    Hand,
    HandState,
    Player,
    PlayerHand,
)
from app.services.evaluator import RANK_VAL, SUIT_VAL, find_best_five_card_score
from app.services.hand_state import count_community_cards

WAGER_ACTIONS = ('blind', 'call', 'bet', 'raise')


class SettlementError(ValueError):
    """The hand cannot be settled with the information given."""


class UnresolvedPotError(SettlementError):
    """A pot has several eligible players and nothing says who wins it."""

    def __init__(self, player_ids: list[int]):
        self.player_ids = player_ids
        super().__init__(f'Cannot decide a pot between players {player_ids}')


def to_cents(amount: float | None) -> int:
    return int(round((amount or 0) * 100))


def from_cents(cents: int) -> float:
    return round(cents / 100, 2)


# ---------------------------------------------------------------------------
# Pure pot maths
# ---------------------------------------------------------------------------


def build_pots(contributions: dict[int, int], folded_ids: set[int]) -> list[dict]:
    """Split total contributions (cents) into main pot + side pots.

    Folded players' money stays in the pots but they are not eligible. An
    uncalled bet shows up as a final pot with a single eligible player.

    Returns [{'amount': int, 'eligible_player_ids': list[int]}, ...] with the
    main pot first.
    """
    live = {
        player_id: amount
        for player_id, amount in contributions.items()
        if player_id not in folded_ids and amount > 0
    }
    if not live:
        return []

    pots: list[dict] = []
    previous_level = 0
    for level in sorted(set(live.values())):
        amount = sum(
            min(contribution, level) - min(contribution, previous_level)
            for contribution in contributions.values()
        )
        pots.append(
            {
                'amount': amount,
                'eligible_player_ids': sorted(
                    player_id
                    for player_id, contribution in live.items()
                    if contribution >= level
                ),
            }
        )
        previous_level = level

    # Money a folded player put in above the highest live contribution
    overflow = sum(
        max(contribution - previous_level, 0) for contribution in contributions.values()
    )
    if overflow:
        # Goes to the last pot that is actually contested, else the last pot
        contested = [pot for pot in pots if len(pot['eligible_player_ids']) > 1]
        (contested[-1] if contested else pots[-1])['amount'] += overflow
    return pots


def distribute_pots(
    pots: list[dict],
    ranking: list[list[int]],
    odd_chip_order: list[int],
) -> tuple[dict[int, int], set[int]]:
    """Pay each pot to the best-ranked eligible player(s).

    ranking is tiers of player ids, best first; players in the same tier tie.
    odd_chip_order decides who gets leftover cents on a split.

    Returns (payouts in cents, ids of players who won a contested pot).
    """
    payouts: dict[int, int] = {}
    winners: set[int] = set()
    order_index = {player_id: index for index, player_id in enumerate(odd_chip_order)}

    for pot in pots:
        eligible = pot['eligible_player_ids']
        if len(eligible) == 1:
            pot_winners = list(eligible)
        else:
            pot_winners = []
            for tier in ranking:
                pot_winners = [player_id for player_id in eligible if player_id in tier]
                if pot_winners:
                    break
            if not pot_winners:
                raise UnresolvedPotError(list(eligible))
            winners.update(pot_winners)

        pot_winners.sort(
            key=lambda player_id: order_index.get(player_id, len(order_index))
        )
        share, remainder = divmod(pot['amount'], len(pot_winners))
        for index, player_id in enumerate(pot_winners):
            payouts[player_id] = (
                payouts.get(player_id, 0) + share + (1 if index < remainder else 0)
            )
    return payouts, winners


# ---------------------------------------------------------------------------
# Database-backed settlement
# ---------------------------------------------------------------------------


def contribution_cents(player_hand: PlayerHand) -> int:
    return sum(
        to_cents(action.amount)
        for action in player_hand.actions
        if action.action in WAGER_ACTIONS
    )


def apply_chip_credit(
    game_player: GamePlayer | None, player_hand: PlayerHand, credit: float
) -> None:
    """Set the chips this hand has paid the player, replacing any earlier payout.

    Re-running with the same credit is a no-op, so results can be corrected
    without paying twice.
    """
    previous_credit = player_hand.chips_credited or 0
    player_hand.chips_credited = credit
    if game_player is None or game_player.current_chips is None:
        return
    chips_before = game_player.current_chips
    game_player.current_chips = round(chips_before + credit - previous_credit, 2)
    if game_player.current_chips <= 0:
        game_player.is_active = False
    elif chips_before <= 0:
        # A correction brought a busted player back
        game_player.is_active = True


def _card_to_internal(card: str) -> tuple[int, int]:
    return (RANK_VAL[card[:-1].upper()], SUIT_VAL[card[-1]])


def _ranking_from_cards(hand: Hand, player_hands: list[PlayerHand]) -> list[list[int]]:
    """Rank players by their best five cards. Empty if cards are incomplete."""
    if count_community_cards(hand) < 5:
        return []
    if any(ph.card_1 is None or ph.card_2 is None for ph in player_hands):
        return []
    board = [
        _card_to_internal(card)
        for card in (hand.flop_1, hand.flop_2, hand.flop_3, hand.turn, hand.river)
    ]
    by_score: dict[int, list[int]] = {}
    for ph in player_hands:
        hole = [_card_to_internal(ph.card_1), _card_to_internal(ph.card_2)]
        by_score.setdefault(find_best_five_card_score(hole + board), []).append(
            ph.player_id
        )
    return [by_score[score] for score in sorted(by_score, reverse=True)]


def _board_street(hand: Hand) -> str:
    return {5: 'river', 4: 'turn', 3: 'flop'}.get(
        count_community_cards(hand), 'preflop'
    )


def _odd_chip_order(db: Session, game_id: int, hand: Hand) -> list[int]:
    """Player ids by seat, starting from the small blind."""
    rows = (
        db.query(GamePlayer.player_id, GamePlayer.seat_number)
        .filter(GamePlayer.game_id == game_id)
        .all()
    )
    ordered = sorted(rows, key=lambda row: (row.seat_number or 999999, row.player_id))
    ids = [row.player_id for row in ordered]
    if hand.sb_player_id in ids:
        start = ids.index(hand.sb_player_id)
        ids = ids[start:] + ids[:start]
    return ids


def settle_hand(
    db: Session,
    game_id: int,
    hand: Hand,
    ranking: list[list[int]] | None = None,
) -> dict:
    """Pay out a hand and write result / profit_loss for every player.

    ranking: tiers of player ids, best first, as decided by the dealer. Pots it
    does not decide fall back to the cards when hole cards and the full board
    are recorded. Raises SettlementError when a pot still cannot be decided.

    Safe to call again: each call replaces the previous payout.
    Does not commit.
    """
    player_hands = list(hand.player_hands)
    folded_ids = {ph.player_id for ph in player_hands if ph.result == 'folded'}
    live_hands = [ph for ph in player_hands if ph.player_id not in folded_ids]
    if not live_hands:
        raise SettlementError('Every player has folded — nobody can win the pot')

    contributions = {ph.player_id: contribution_cents(ph) for ph in player_hands}
    pots = build_pots(contributions, folded_ids)

    live_ids = {ph.player_id for ph in live_hands}
    dealer_ranking = [
        [player_id for player_id in tier if player_id in live_ids]
        for tier in (ranking or [])
    ]
    contenders = (
        [ph for ph in live_hands if contributions[ph.player_id] > 0]
        if pots
        else live_hands
    )
    full_ranking = dealer_ranking + _ranking_from_cards(hand, contenders)

    if len(live_hands) == 1:
        winners = set(live_ids)
        payouts = {live_hands[0].player_id: sum(pot['amount'] for pot in pots)}
        pot_winners = [[live_hands[0].player_id] for _ in pots]
    else:
        if not full_ranking:
            raise SettlementError(
                'Winners are required: hole cards or the full board are not recorded'
            )
        try:
            payouts, winners = distribute_pots(
                pots, full_ranking, _odd_chip_order(db, game_id, hand)
            )
        except UnresolvedPotError as exc:
            names = _names_by_id(db, exc.player_ids)
            raise SettlementError(
                'Cannot decide a pot between '
                + ', '.join(names[player_id] for player_id in exc.player_ids)
                + ' — rank them or record their cards'
            ) from exc
        if not pots:
            # No betting tracked: the top tier simply wins
            winners = set(full_ranking[0])
        pot_winners = [_pot_winner_ids(pot, full_ranking) for pot in pots]

    game_players = {
        game_player.player_id: game_player
        for game_player in db.query(GamePlayer)
        .filter(GamePlayer.game_id == game_id)
        .all()
    }
    street = _board_street(hand)
    for ph in player_hands:
        if ph.player_id in folded_ids:
            ph.outcome_street = ph.outcome_street or street
        else:
            ph.result = 'won' if ph.player_id in winners else 'lost'
            if len(live_hands) > 1 or ph.outcome_street is None:
                ph.outcome_street = street
        if pots:
            payout = payouts.get(ph.player_id, 0)
            ph.profit_loss = from_cents(payout - contributions[ph.player_id])
            apply_chip_credit(game_players.get(ph.player_id), ph, from_cents(payout))

    hand.side_pots = json.dumps(
        [
            {
                'amount': from_cents(pot['amount']),
                'eligible_player_ids': pot['eligible_player_ids'],
            }
            for pot in pots[1:]
        ]
    )
    hand.pot = from_cents(sum(pot['amount'] for pot in pots)) if pots else hand.pot

    state = db.query(HandState).filter(HandState.hand_id == hand.hand_id).first()
    if state:
        state.phase = 'showdown'
        state.current_seat = None
        state.updated_at = datetime.now(timezone.utc)

    names = _names_by_id(db, [ph.player_id for ph in player_hands])
    return {
        'pot': from_cents(sum(pot['amount'] for pot in pots)),
        'pots': [
            {
                'amount': from_cents(pot['amount']),
                'eligible_players': [
                    names[player_id] for player_id in pot['eligible_player_ids']
                ],
                'winners': [names[player_id] for player_id in winner_ids],
            }
            for pot, winner_ids in zip(pots, pot_winners, strict=True)
        ],
        'players': [
            {
                'player_name': names[ph.player_id],
                'result': ph.result,
                'contribution': from_cents(contributions[ph.player_id]),
                'payout': from_cents(payouts.get(ph.player_id, 0)),
                'profit_loss': ph.profit_loss,
                'current_chips': (
                    game_players[ph.player_id].current_chips
                    if ph.player_id in game_players
                    else None
                ),
            }
            for ph in player_hands
        ],
    }


def _pot_winner_ids(pot: dict, ranking: list[list[int]]) -> list[int]:
    eligible = pot['eligible_player_ids']
    if len(eligible) == 1:
        return list(eligible)
    for tier in ranking:
        tier_winners = [player_id for player_id in eligible if player_id in tier]
        if tier_winners:
            return tier_winners
    return []


def _names_by_id(db: Session, player_ids: list[int]) -> dict[int, str]:
    players = db.query(Player).filter(Player.player_id.in_(player_ids)).all()
    return {player.player_id: player.name for player in players}
