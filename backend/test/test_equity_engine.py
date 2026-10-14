"""The equity engine: exact where possible, repeatable where simulated."""

import time

import pytest

from app.services.equity import (
    METHOD_EXACT,
    METHOD_SIMULATED,
    analyze_equity,
    calculate_player_equity,
    clear_equity_cache,
)


def cards(*texts: str) -> list[tuple[str, str]]:
    return [(text[:-1], text[-1]) for text in texts]


AA = cards('Ah', 'Ad')
KK = cards('Kh', 'Kd')
SEVEN_DEUCE = cards('7c', '2s')


@pytest.fixture(autouse=True)
def fresh_cache():
    clear_equity_cache()
    yield
    clear_equity_cache()


class TestExactFromTheFlop:
    def test_flop_is_enumerated_exactly(self):
        result = analyze_equity([AA, KK], cards('3c', '8d', '9s'))
        assert result.method == METHOD_EXACT
        # 45 unseen cards, two to come
        assert result.samples == 990
        # KK needs a king with no ace: 2 kings x 41 non-ace, non-king cards
        # plus both kings, out of 990 runouts
        assert result.wins[1] == pytest.approx((2 * 41 + 1) / 990)

    def test_turn_is_enumerated_exactly(self):
        result = analyze_equity([AA, KK], cards('3c', '8d', '9s', '4h'))
        assert result.method == METHOD_EXACT
        assert result.samples == 44
        assert result.wins[1] == pytest.approx(2 / 44)

    def test_river_is_a_single_board(self):
        result = analyze_equity([AA, KK], cards('3c', '8d', '9s', '4h', 'Jc'))
        assert (result.method, result.samples) == (METHOD_EXACT, 1)
        assert result.equities == (1.0, 0.0)

    def test_split_pot_is_reported_as_a_tie_not_a_win(self):
        board = cards('Ts', 'Js', 'Qs', 'Ks', 'As')
        result = analyze_equity([AA, KK], board)
        assert result.equities == (0.5, 0.5)
        assert result.wins == (0.0, 0.0)
        assert result.ties == (1.0, 1.0)

    def test_equity_is_wins_plus_tie_share(self):
        result = analyze_equity(
            [cards('Ah', 'Kd'), cards('As', 'Kc')], cards('2c', '7d', '9s')
        )
        for equity, win, tie in zip(
            result.equities, result.wins, result.ties, strict=True
        ):
            assert equity == pytest.approx(win + tie / 2)
        assert sum(result.equities) == pytest.approx(1.0)


class TestPreflopIsRepeatable:
    def test_same_hand_gives_the_same_number_every_time(self):
        first = analyze_equity([AA, KK], [])
        clear_equity_cache()
        second = analyze_equity([AA, KK], [])
        assert first.method == METHOD_SIMULATED
        assert first.equities == second.equities

    def test_close_to_the_true_value(self):
        # AA vs KK preflop is 81.9% / 17.8% with ties
        result = analyze_equity([AA, KK], [])
        assert result.equities[0] == pytest.approx(0.82, abs=0.01)

    def test_equities_sum_to_one_nine_handed(self):
        hands = [
            cards('Ah', 'Ad'),
            cards('Kh', 'Kd'),
            cards('Qs', 'Js'),
            cards('7c', '2d'),
            cards('9h', '8h'),
            cards('5c', '5d'),
            cards('Tc', '9c'),
            cards('4s', '3s'),
            cards('Kc', 'Qc'),
        ]
        result = analyze_equity(hands, [])
        assert sum(result.equities) == pytest.approx(1.0)

    def test_player_versus_random_hands_is_repeatable(self):
        first = calculate_player_equity(AA, 3, [])
        clear_equity_cache()
        assert calculate_player_equity(AA, 3, []) == first
        assert 0.55 < first < 0.75


class TestDeadCards:
    def test_folded_cards_are_removed_from_the_deck(self):
        board = cards('3c', '8d', '9s')
        live = analyze_equity([AA, KK], board)
        # Someone folded the other two kings: KK can no longer improve
        dead = analyze_equity([AA, KK], board, dead_cards=cards('Kc', 'Ks'))
        assert live.wins[1] > 0
        assert dead.wins[1] == 0
        assert dead.samples == 43 * 42 // 2

    def test_dead_card_order_does_not_matter(self):
        board = cards('3c', '8d', '9s')
        one = analyze_equity([AA, KK], board, dead_cards=cards('Kc', 'Ks'))
        other = analyze_equity([AA, KK], board, dead_cards=cards('Ks', 'Kc'))
        assert one is other  # same cache entry


class TestSpeed:
    def test_nine_handed_preflop_is_fast_and_then_free(self):
        hands = [
            cards('Ah', 'Ad'),
            cards('Kh', 'Kd'),
            cards('Qs', 'Js'),
            cards('7c', '2d'),
            cards('9h', '8h'),
            cards('5c', '5d'),
            cards('Tc', '9c'),
            cards('4s', '3s'),
            cards('Kc', 'Qc'),
        ]
        start = time.perf_counter()
        analyze_equity(hands, [])
        first = time.perf_counter() - start
        start = time.perf_counter()
        analyze_equity(hands, [])
        cached = time.perf_counter() - start
        # Was ~2.5s before the rewrite; generous bound for slow CI machines
        assert first < 2.0
        assert cached < 0.01
