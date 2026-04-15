"""Stats router - handles statistics endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.database.models import GameSession, Hand, Player, PlayerHand
from app.database.queries import (
    get_game_or_404,
    get_player_by_name_or_404,
    get_shared_hands,
)
from app.database.session import get_db
from pydantic_models.common import ResultEnum
from pydantic_models.stats_schemas import (
    AwardEntry,
    GameHighlight,
    GameStatsPlayerEntry,
    GameStatsResponse,
    HeadToHeadResponse,
    LeaderboardEntry,
    LeaderboardMetric,
    PlayerSessionTrend,
    PlayerStatsResponse,
    StreetBreakdown,
)

router = APIRouter(prefix='/stats', tags=['stats'])


@router.get(
    '/players/{player_name}/trends',
    response_model=list[PlayerSessionTrend],
)
def get_player_trends(
    player_name: str,
    db: Annotated[Session, Depends(get_db)],
):
    player = get_player_by_name_or_404(db, player_name)

    player_hands = (
        db.query(PlayerHand)
        .join(Hand, PlayerHand.hand_id == Hand.hand_id)
        .join(GameSession, Hand.game_id == GameSession.game_id)
        .filter(
            PlayerHand.player_id == player.player_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != ResultEnum.HANDED_BACK,
        )
        .all()
    )

    sessions: dict[int, dict] = {}
    for ph in player_hands:
        gid = ph.hand.game_id
        if gid not in sessions:
            sessions[gid] = {
                'game_id': gid,
                'game_date': ph.hand.game_session.game_date,
                'hands_played': 0,
                'hands_won': 0,
                'profit_loss': 0.0,
            }
        sessions[gid]['hands_played'] += 1
        if ph.result == ResultEnum.WON:
            sessions[gid]['hands_won'] += 1
        sessions[gid]['profit_loss'] += ph.profit_loss or 0.0

    trends = []
    for s in sessions.values():
        total = s['hands_played']
        win_rate = round(s['hands_won'] / total * 100, 2) if total > 0 else 0.0
        trends.append(
            PlayerSessionTrend(
                game_id=s['game_id'],
                game_date=s['game_date'],
                hands_played=total,
                hands_won=s['hands_won'],
                win_rate=win_rate,
                profit_loss=round(s['profit_loss'], 2),
            )
        )

    trends.sort(key=lambda t: t.game_date)
    return trends


@router.get('/players/{player_name}', response_model=PlayerStatsResponse)
def get_player_stats(
    player_name: str,
    db: Annotated[Session, Depends(get_db)],
):
    player = get_player_by_name_or_404(db, player_name)

    player_hands = (
        db.query(PlayerHand)
        .options(joinedload(PlayerHand.hand))
        .filter(
            PlayerHand.player_id == player.player_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != ResultEnum.HANDED_BACK,
        )
        .all()
    )

    total = len(player_hands)

    if total == 0:
        return PlayerStatsResponse(
            player_name=player.name,
            total_hands_played=0,
            hands_won=0,
            hands_lost=0,
            hands_folded=0,
            win_rate=0.0,
            total_profit_loss=0.0,
            avg_profit_loss_per_hand=0.0,
            avg_profit_loss_per_session=0.0,
            flop_pct=0.0,
            turn_pct=0.0,
            river_pct=0.0,
        )

    hands_won = sum(
        1 for player_hand in player_hands if player_hand.result == ResultEnum.WON
    )
    hands_lost = sum(
        1 for player_hand in player_hands if player_hand.result == ResultEnum.LOST
    )
    hands_folded = sum(
        1 for player_hand in player_hands if player_hand.result == ResultEnum.FOLDED
    )
    win_rate = round(hands_won / total * 100, 2)

    total_profit_loss = sum(
        player_hand.profit_loss or 0.0 for player_hand in player_hands
    )
    average_profit_loss_per_hand = round(total_profit_loss / total, 2)

    profit_loss_by_session: dict[int, float] = {}
    for player_hand in player_hands:
        game_id = player_hand.hand.game_id
        profit_loss_by_session[game_id] = profit_loss_by_session.get(game_id, 0.0) + (
            player_hand.profit_loss or 0.0
        )
    average_profit_loss_per_session = round(
        sum(profit_loss_by_session.values()) / len(profit_loss_by_session), 2
    )

    hands_with_turn = sum(
        1 for player_hand in player_hands if player_hand.hand.turn is not None
    )
    hands_with_river = sum(
        1 for player_hand in player_hands if player_hand.hand.river is not None
    )

    return PlayerStatsResponse(
        player_name=player.name,
        total_hands_played=total,
        hands_won=hands_won,
        hands_lost=hands_lost,
        hands_folded=hands_folded,
        win_rate=win_rate,
        total_profit_loss=round(total_profit_loss, 2),
        avg_profit_loss_per_hand=average_profit_loss_per_hand,
        avg_profit_loss_per_session=average_profit_loss_per_session,
        flop_pct=100.0,
        turn_pct=round(hands_with_turn / total * 100, 2),
        river_pct=round(hands_with_river / total * 100, 2),
    )


@router.get('/leaderboard', response_model=list[LeaderboardEntry])
def get_leaderboard(
    db: Annotated[Session, Depends(get_db)],
    metric: LeaderboardMetric = LeaderboardMetric.total_profit_loss,
):
    rows = (
        db.query(
            Player.name,
            func.count(PlayerHand.player_hand_id).label('hands_played'),
            func.coalesce(func.sum(PlayerHand.profit_loss), 0.0).label('total_pl'),
            func.sum(case((PlayerHand.result == ResultEnum.WON, 1), else_=0)).label(
                'wins'
            ),
        )
        .join(PlayerHand, Player.player_id == PlayerHand.player_id)
        .filter(
            PlayerHand.result.isnot(None), PlayerHand.result != ResultEnum.HANDED_BACK
        )
        .group_by(Player.player_id, Player.name)
        .all()
    )

    entries = []
    for row in rows:
        hands = row.hands_played
        wins = row.wins or 0
        win_rate = round(wins / hands * 100, 2) if hands > 0 else 0.0
        entries.append(
            LeaderboardEntry(
                rank=0,
                player_name=row.name,
                total_profit_loss=round(float(row.total_pl), 2),
                win_rate=win_rate,
                hands_played=hands,
            )
        )

    if metric == LeaderboardMetric.win_rate:
        entries.sort(key=lambda e: e.win_rate, reverse=True)
    elif metric == LeaderboardMetric.hands_played:
        entries.sort(key=lambda e: e.hands_played, reverse=True)
    else:
        entries.sort(key=lambda e: e.total_profit_loss, reverse=True)

    for i, entry in enumerate(entries, start=1):
        entry.rank = i

    return entries


@router.get('/games/{game_id}', response_model=GameStatsResponse)
def get_game_stats(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    game = get_game_or_404(db, game_id)

    total_hands = (
        db.query(func.count(Hand.hand_id)).filter(Hand.game_id == game_id).scalar()
    )

    player_hands = (
        db.query(PlayerHand)
        .join(Hand, PlayerHand.hand_id == Hand.hand_id)
        .join(Player, PlayerHand.player_id == Player.player_id)
        .filter(
            Hand.game_id == game_id,
            PlayerHand.result.isnot(None),
            PlayerHand.result != ResultEnum.HANDED_BACK,
        )
        .all()
    )

    # Aggregate per-player
    stats: dict[int, dict] = {}
    for player_hand in player_hands:
        player_id = player_hand.player_id
        if player_id not in stats:
            stats[player_id] = {
                'player_name': player_hand.player.name,
                'hands_played': 0,
                'hands_won': 0,
                'hands_lost': 0,
                'hands_folded': 0,
                'profit_loss': 0.0,
            }
        player_stats_entry = stats[player_id]
        player_stats_entry['hands_played'] += 1
        if player_hand.result == ResultEnum.WON:
            player_stats_entry['hands_won'] += 1
        elif player_hand.result == ResultEnum.LOST:
            player_stats_entry['hands_lost'] += 1
        elif player_hand.result == ResultEnum.FOLDED:
            player_stats_entry['hands_folded'] += 1
        player_stats_entry['profit_loss'] += player_hand.profit_loss or 0.0

    # Include players registered in the session but with no results
    for player in game.players:
        if player.player_id not in stats:
            stats[player.player_id] = {
                'player_name': player.name,
                'hands_played': 0,
                'hands_won': 0,
                'hands_lost': 0,
                'hands_folded': 0,
                'profit_loss': 0.0,
            }

    player_stats = []
    for player_stats_entry in stats.values():
        total = player_stats_entry['hands_played']
        win_rate = (
            round(player_stats_entry['hands_won'] / total * 100, 2)
            if total > 0
            else 0.0
        )
        player_stats.append(
            GameStatsPlayerEntry(
                player_name=player_stats_entry['player_name'],
                hands_played=total,
                hands_won=player_stats_entry['hands_won'],
                hands_lost=player_stats_entry['hands_lost'],
                hands_folded=player_stats_entry['hands_folded'],
                win_rate=win_rate,
                profit_loss=round(player_stats_entry['profit_loss'], 2),
            )
        )

    player_stats.sort(key=lambda e: e.player_name)

    return GameStatsResponse(
        game_id=game.game_id,
        game_date=game.game_date,
        total_hands=total_hands,
        player_stats=player_stats,
    )


def _determine_street(hand: Hand) -> str:
    """Determine the final street a hand reached based on community cards."""
    if hand.river is not None:
        return 'river'
    if hand.turn is not None:
        return 'turn'
    if hand.flop_1 is not None:
        return 'flop'
    return 'preflop'


_SHOWDOWN_RESULTS = {ResultEnum.WON, ResultEnum.LOST}
_STREET_ORDER = ['preflop', 'flop', 'turn', 'river']


@router.get('/head-to-head', response_model=HeadToHeadResponse)
def get_head_to_head(
    player1: str,
    player2: str,
    db: Annotated[Session, Depends(get_db)],
):
    p1 = get_player_by_name_or_404(db, player1)
    p2 = get_player_by_name_or_404(db, player2)

    shared = get_shared_hands(db, p1.player_id, p2.player_id)
    total = len(shared)

    showdown_count = 0
    p1_showdown_wins = 0
    p2_showdown_wins = 0
    p1_fold_count = 0
    p2_fold_count = 0
    street_data: dict[str, dict[str, int]] = {}

    for hand, ph1, ph2 in shared:
        if ph1.result == ResultEnum.FOLDED:
            p1_fold_count += 1
        if ph2.result == ResultEnum.FOLDED:
            p2_fold_count += 1

        if ph1.result in _SHOWDOWN_RESULTS and ph2.result in _SHOWDOWN_RESULTS:
            showdown_count += 1
            if ph1.result == ResultEnum.WON:
                p1_showdown_wins += 1
            if ph2.result == ResultEnum.WON:
                p2_showdown_wins += 1

        street = _determine_street(hand)
        if street not in street_data:
            street_data[street] = {'hands_ended': 0, 'p1_wins': 0, 'p2_wins': 0}
        street_data[street]['hands_ended'] += 1
        if ph1.result == ResultEnum.WON:
            street_data[street]['p1_wins'] += 1
        if ph2.result == ResultEnum.WON:
            street_data[street]['p2_wins'] += 1

    street_breakdown = [
        StreetBreakdown(
            street=s,
            hands_ended=street_data[s]['hands_ended'],
            player1_wins=street_data[s]['p1_wins'],
            player2_wins=street_data[s]['p2_wins'],
        )
        for s in _STREET_ORDER
        if s in street_data
    ]

    return HeadToHeadResponse(
        player1_name=p1.name,
        player2_name=p2.name,
        shared_hands_count=total,
        showdown_count=showdown_count,
        player1_showdown_wins=p1_showdown_wins,
        player2_showdown_wins=p2_showdown_wins,
        player1_fold_count=p1_fold_count,
        player2_fold_count=p2_fold_count,
        player1_fold_rate=round(p1_fold_count / total * 100, 2) if total > 0 else 0.0,
        player2_fold_rate=round(p2_fold_count / total * 100, 2) if total > 0 else 0.0,
        street_breakdown=street_breakdown,
    )


# ── Thresholds ───────────────────────────────────────────────────────────
_SNIPER_MIN_HANDS = 20
_DIAMOND_HANDS_MIN = 10
_STREAK_MIN = 2
_ONE_AND_DONE_MIN_PLAYERS = 2


def _compute_awards(player_hands: list[PlayerHand]) -> list[AwardEntry]:
    """Compute superlative awards from a batch of PlayerHand records."""
    if not player_hands:
        return []

    # ── Aggregate per-player stats ───────────────────────────────────────
    players: dict[int, dict] = {}
    for ph in player_hands:
        pid = ph.player_id
        if pid not in players:
            players[pid] = {
                'name': ph.player.name,
                'hands_played': 0,
                'wins': 0,
                'folds': 0,
                'losses': 0,
                'river_hands': 0,
                'showdowns': 0,
                'total_pl': 0.0,
                'has_pl': False,
                'results_seq': [],
            }
        d = players[pid]
        d['hands_played'] += 1

        if ph.result == ResultEnum.WON:
            d['wins'] += 1
        elif ph.result == ResultEnum.FOLDED:
            d['folds'] += 1
        elif ph.result == ResultEnum.LOST:
            d['losses'] += 1

        if ph.hand.river is not None and ph.result != ResultEnum.FOLDED:
            d['river_hands'] += 1

        if ph.result in (ResultEnum.WON, ResultEnum.LOST):
            d['showdowns'] += 1

        if ph.profit_loss is not None:
            d['total_pl'] += ph.profit_loss
            d['has_pl'] = True

        d['results_seq'].append((ph.hand.game_id, ph.hand.hand_number, ph.result))

    # ── Compute winning streaks ──────────────────────────────────────────
    for d in players.values():
        d['results_seq'].sort()
        max_streak = 0
        cur = 0
        for _, _, result in d['results_seq']:
            if result == ResultEnum.WON:
                cur += 1
                if cur > max_streak:
                    max_streak = cur
            else:
                cur = 0
        d['winning_streak'] = max_streak

    plist = list(players.values())
    awards: list[AwardEntry] = []

    # ── Iron Man: most hands played ──────────────────────────────────────
    best = max(plist, key=lambda p: p['hands_played'])
    awards.append(
        AwardEntry(
            award_name='Iron Man',
            emoji='🦾',
            description='Most hands played',
            winner_name=best['name'],
            stat_value=best['hands_played'],
            stat_label='hands',
        )
    )

    # ── Sniper: highest win rate (min threshold) ─────────────────────────
    eligible = [p for p in plist if p['hands_played'] >= _SNIPER_MIN_HANDS]
    if eligible:
        best = max(eligible, key=lambda p: p['wins'] / p['hands_played'])
        wr = round(best['wins'] / best['hands_played'] * 100, 2)
        awards.append(
            AwardEntry(
                award_name='Sniper',
                emoji='🎯',
                description=f'Highest win rate (min {_SNIPER_MIN_HANDS} hands)',
                winner_name=best['name'],
                stat_value=wr,
                stat_label='win %',
            )
        )

    # ── Paper Hands: highest fold rate ───────────────────────────────────
    best = max(plist, key=lambda p: p['folds'] / p['hands_played'])
    fr = round(best['folds'] / best['hands_played'] * 100, 2)
    awards.append(
        AwardEntry(
            award_name='Paper Hands',
            emoji='🧻',
            description='Highest fold rate',
            winner_name=best['name'],
            stat_value=fr,
            stat_label='fold %',
        )
    )

    # ── Diamond Hands: lowest fold rate (min threshold) ──────────────────
    eligible = [p for p in plist if p['hands_played'] >= _DIAMOND_HANDS_MIN]
    if eligible:
        best = min(eligible, key=lambda p: p['folds'] / p['hands_played'])
        fr = round(best['folds'] / best['hands_played'] * 100, 2)
        awards.append(
            AwardEntry(
                award_name='Diamond Hands',
                emoji='💎',
                description='Lowest fold rate (never gives up)',
                winner_name=best['name'],
                stat_value=fr,
                stat_label='fold %',
            )
        )

    # ── River Rat: most hands reaching the river ─────────────────────────
    best = max(plist, key=lambda p: p['river_hands'])
    if best['river_hands'] > 0:
        awards.append(
            AwardEntry(
                award_name='River Rat',
                emoji='🐀',
                description='Most hands reaching the river',
                winner_name=best['name'],
                stat_value=best['river_hands'],
                stat_label='river hands',
            )
        )

    # ── One and Done: fewest hands played (min 2 players) ────────────────
    if len(plist) >= _ONE_AND_DONE_MIN_PLAYERS:
        best = min(plist, key=lambda p: p['hands_played'])
        awards.append(
            AwardEntry(
                award_name='One and Done',
                emoji='☝️',
                description='Fewest hands played',
                winner_name=best['name'],
                stat_value=best['hands_played'],
                stat_label='hands',
            )
        )

    # ── Streak King: longest winning streak ──────────────────────────────
    best = max(plist, key=lambda p: p['winning_streak'])
    if best['winning_streak'] >= _STREAK_MIN:
        awards.append(
            AwardEntry(
                award_name='Streak King',
                emoji='🔥',
                description='Longest winning streak',
                winner_name=best['name'],
                stat_value=best['winning_streak'],
                stat_label='wins in a row',
            )
        )

    # ── Showdown Magnet: most showdowns ──────────────────────────────────
    best = max(plist, key=lambda p: p['showdowns'])
    if best['showdowns'] > 0:
        awards.append(
            AwardEntry(
                award_name='Showdown Magnet',
                emoji='🧲',
                description='Most showdowns',
                winner_name=best['name'],
                stat_value=best['showdowns'],
                stat_label='showdowns',
            )
        )

    # ── P&L awards (only if data available) ──────────────────────────────
    has_any_pl = any(p['has_pl'] for p in plist)
    if has_any_pl:
        best = max(plist, key=lambda p: p['total_pl'])
        if best['total_pl'] > 0:
            awards.append(
                AwardEntry(
                    award_name='Big Stack',
                    emoji='💰',
                    description='Highest profit',
                    winner_name=best['name'],
                    stat_value=round(best['total_pl'], 2),
                    stat_label='profit',
                )
            )

        worst = min(plist, key=lambda p: p['total_pl'])
        if worst['total_pl'] < 0:
            awards.append(
                AwardEntry(
                    award_name='Degen',
                    emoji='🎰',
                    description='Biggest loss',
                    winner_name=worst['name'],
                    stat_value=round(worst['total_pl'], 2),
                    stat_label='loss',
                )
            )

    return awards


@router.get('/awards', response_model=list[AwardEntry])
def get_awards(
    db: Annotated[Session, Depends(get_db)],
    game_id: int | None = None,
):
    """Compute and return auto-generated superlative awards."""
    query = (
        db.query(PlayerHand)
        .join(Hand, PlayerHand.hand_id == Hand.hand_id)
        .join(Player, PlayerHand.player_id == Player.player_id)
        .options(joinedload(PlayerHand.hand), joinedload(PlayerHand.player))
        .filter(
            PlayerHand.result.isnot(None),
            PlayerHand.result != ResultEnum.HANDED_BACK,
        )
    )
    if game_id is not None:
        query = query.filter(Hand.game_id == game_id)

    player_hands = query.all()
    return _compute_awards(player_hands)


@router.get('/games/{game_id}/highlights', response_model=list[GameHighlight])
def get_game_highlights(
    game_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Return notable highlights from a game session."""
    get_game_or_404(db, game_id)

    hands = (
        db.query(Hand)
        .filter(Hand.game_id == game_id)
        .options(joinedload(Hand.player_hands).joinedload(PlayerHand.player))
        .order_by(Hand.hand_number)
        .all()
    )

    if len(hands) < 3:
        return []

    highlights: list[GameHighlight] = []

    # ── most_action: hand with the most non-fold players ─────────────────
    best_action_hand = None
    best_action_count = 0
    for hand in hands:
        non_fold = sum(
            1
            for ph in hand.player_hands
            if ph.result is not None
            and ph.result != ResultEnum.FOLDED
            and ph.result != ResultEnum.HANDED_BACK
        )
        if non_fold > best_action_count:
            best_action_count = non_fold
            best_action_hand = hand

    if best_action_hand is not None and best_action_count > 0:
        highlights.append(
            GameHighlight(
                hand_number=best_action_hand.hand_number,
                highlight_type='most_action',
                description=(
                    f'Hand {best_action_hand.hand_number}: '
                    f'{best_action_count} players saw action'
                ),
            )
        )

    # ── river_showdown: hands reaching river with 3+ active ──────────────
    for hand in hands:
        if len(highlights) >= 5:
            break
        if hand.river is None:
            continue
        active = sum(
            1
            for ph in hand.player_hands
            if ph.result is not None
            and ph.result != ResultEnum.FOLDED
            and ph.result != ResultEnum.HANDED_BACK
        )
        if active >= 3:
            highlights.append(
                GameHighlight(
                    hand_number=hand.hand_number,
                    highlight_type='river_showdown',
                    description=(
                        f'Hand {hand.hand_number}: '
                        f'{active} players reached the river showdown'
                    ),
                )
            )

    # ── streak_start: first hand in longest winning streak ───────────────
    best_streak_len = 0
    best_streak_start = None
    best_streak_player = None

    player_results: dict[int, list[tuple[int, str, str]]] = {}
    for hand in hands:
        for ph in hand.player_hands:
            if ph.result is None or ph.result == ResultEnum.HANDED_BACK:
                continue
            pid = ph.player_id
            if pid not in player_results:
                player_results[pid] = []
            player_results[pid].append((hand.hand_number, ph.result, ph.player.name))

    for results in player_results.values():
        results.sort()
        cur_streak = 0
        cur_start = None
        for hand_num, result, pname in results:
            if result == ResultEnum.WON:
                if cur_streak == 0:
                    cur_start = hand_num
                cur_streak += 1
                if cur_streak > best_streak_len:
                    best_streak_len = cur_streak
                    best_streak_start = cur_start
                    best_streak_player = pname
            else:
                cur_streak = 0
                cur_start = None

    if best_streak_len >= 2 and best_streak_start is not None and len(highlights) < 5:
        highlights.append(
            GameHighlight(
                hand_number=best_streak_start,
                highlight_type='streak_start',
                description=(
                    f'Hand {best_streak_start}: Start of '
                    f"{best_streak_player}'s {best_streak_len}-hand win streak"
                ),
            )
        )

    return highlights[:5]
