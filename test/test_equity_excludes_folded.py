"""Tests for Bug Fix: Equity calculation should exclude folded players."""

from conftest import activate_hand


def _create_three_player_game(client, buy_in=100.0):
    """Create a game with three players."""
    resp = client.post(
        '/games',
        json={
            'game_date': '2026-04-13',
            'player_names': ['Alice', 'Bob', 'Charlie'],
            'default_buy_in': buy_in,
        },
    )
    assert resp.status_code == 201
    return resp.json()


class TestEquityExcludesFoldedPlayers:
    def test_folded_player_excluded_from_equity_calculation(self, client):
        """When a player folds, they should NOT be included in equity calculations.

        Scenario: Three players, Alice folds. Equity should only compare Bob vs Charlie.
        If Alice's folded hand is included and happens to be the best,
        both Bob and Charlie may show 0% equity — which is the bug.
        """
        game = _create_three_player_game(client)
        game_id = game['game_id']

        # Start hand
        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']

        # Manually set specific hole cards:
        # Alice gets AA (the best preflop hand)
        # Bob gets KK
        # Charlie gets QQ
        alice_cards = {'card_1': 'AS', 'card_2': 'AH'}
        bob_cards = {'card_1': 'KS', 'card_2': 'KH'}
        charlie_cards = {'card_1': 'QS', 'card_2': 'QH'}

        client.patch(f'/games/{game_id}/hands/{hn}/players/Alice', json=alice_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Bob', json=bob_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Charlie', json=charlie_cards)

        # Set community cards where AA is clearly the best hand
        client.patch(
            f'/games/{game_id}/hands/{hn}',
            json={
                'flop_1': '2D',
                'flop_2': '3D',
                'flop_3': '7C',
                'turn': '8D',
                'river': '9C',
            },
        )

        # Mark Alice as folded
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/players/Alice/result',
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

        # Get equity — should only compare Bob vs Charlie (NOT Alice)
        resp = client.get(f'/games/{game_id}/hands/{hn}/equity')
        assert resp.status_code == 200
        data = resp.json()

        # Alice should NOT appear in equity results
        player_names_in_equity = [e['player_name'] for e in data['equities']]
        assert 'Alice' not in player_names_in_equity, (
            'Folded player Alice should not be included in equity calculation'
        )

        # Bob (KK) should beat Charlie (QQ) on this board
        assert len(data['equities']) == 2
        bob_eq = [e for e in data['equities'] if e['player_name'] == 'Bob']
        charlie_eq = [e for e in data['equities'] if e['player_name'] == 'Charlie']
        assert len(bob_eq) == 1
        assert len(charlie_eq) == 1
        assert bob_eq[0]['equity'] == 1.0, 'Bob (KK) should be the winner vs Charlie (QQ)'
        assert charlie_eq[0]['equity'] == 0.0

    def test_two_player_heads_up_after_fold_correct_winner(self, client):
        """Head-to-head after a fold: the better hand wins, not the folded hand."""
        game = _create_three_player_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']

        # Alice gets a royal flush draw (best hand), Bob mid pair, Charlie low pair
        alice_cards = {'card_1': 'AS', 'card_2': 'KS'}
        bob_cards = {'card_1': '8H', 'card_2': '8D'}
        charlie_cards = {'card_1': '2C', 'card_2': '3C'}

        client.patch(f'/games/{game_id}/hands/{hn}/players/Alice', json=alice_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Bob', json=bob_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Charlie', json=charlie_cards)

        # Board gives Alice a flush (which she folded away)
        client.patch(
            f'/games/{game_id}/hands/{hn}',
            json={
                'flop_1': 'QS',
                'flop_2': 'JS',
                'flop_3': '10S',
                'turn': '4D',
                'river': '5H',
            },
        )

        # Alice folds (even though she would have won with a royal flush!)
        resp = client.patch(
            f'/games/{game_id}/hands/{hn}/players/Alice/result',
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        assert resp.status_code == 200

        # Get equity — only Bob vs Charlie
        resp = client.get(f'/games/{game_id}/hands/{hn}/equity')
        assert resp.status_code == 200
        data = resp.json()

        player_names = [e['player_name'] for e in data['equities']]
        assert 'Alice' not in player_names

        # Bob (pair of 8s) should beat Charlie (2-3 with no pair on this board)
        assert len(data['equities']) == 2
        bob_eq = next(e for e in data['equities'] if e['player_name'] == 'Bob')
        assert bob_eq['equity'] == 1.0, f"Bob should win but got equity {bob_eq['equity']}"

    def test_player_perspective_equity_excludes_folded(self, client):
        """Player-specific equity (via ?player=) should not count folded opponents."""
        game = _create_three_player_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']

        alice_cards = {'card_1': 'AS', 'card_2': 'AH'}
        bob_cards = {'card_1': 'KS', 'card_2': 'KH'}
        charlie_cards = {'card_1': 'QS', 'card_2': 'QH'}

        client.patch(f'/games/{game_id}/hands/{hn}/players/Alice', json=alice_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Bob', json=bob_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Charlie', json=charlie_cards)

        # Alice folds
        client.patch(
            f'/games/{game_id}/hands/{hn}/players/Alice/result',
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )

        # Bob requests his own equity — should compare against 1 opponent (Charlie), not 2
        resp = client.get(f'/games/{game_id}/hands/{hn}/equity?player=Bob')
        assert resp.status_code == 200
        data = resp.json()

        # Should get a result (not empty, which would happen if num_opponents counted folded)
        assert len(data['equities']) == 1
        assert data['equities'][0]['player_name'] == 'Bob'
        assert data['equities'][0]['equity'] > 0

    def test_all_folded_except_one_returns_empty_equity(self, client):
        """If only one non-folded player remains, equity should return empty (no comparison needed)."""
        game = _create_three_player_game(client)
        game_id = game['game_id']

        resp = client.post(f'/games/{game_id}/hands/start')
        assert resp.status_code == 201
        hand = resp.json()
        hn = hand['hand_number']

        alice_cards = {'card_1': 'AS', 'card_2': 'AH'}
        bob_cards = {'card_1': 'KS', 'card_2': 'KH'}
        charlie_cards = {'card_1': 'QS', 'card_2': 'QH'}

        client.patch(f'/games/{game_id}/hands/{hn}/players/Alice', json=alice_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Bob', json=bob_cards)
        client.patch(f'/games/{game_id}/hands/{hn}/players/Charlie', json=charlie_cards)

        # Alice and Bob fold
        client.patch(
            f'/games/{game_id}/hands/{hn}/players/Alice/result',
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )
        client.patch(
            f'/games/{game_id}/hands/{hn}/players/Bob/result',
            json={'result': 'folded', 'outcome_street': 'preflop'},
        )

        # Only Charlie left — equity should be empty (< 2 non-folded players)
        resp = client.get(f'/games/{game_id}/hands/{hn}/equity')
        assert resp.status_code == 200
        data = resp.json()
        assert data['equities'] == []
