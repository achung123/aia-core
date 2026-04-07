"""Seed demo poker games into the development database.

Usage (from repo root):
    uv run python scripts/seed_demo_game.py

Creates 3 game sessions with randomly dealt cards and players sampled
from the house roster.
"""

import random
from datetime import date, datetime, timedelta, timezone

from app.database.models import Base, GamePlayer, GameSession, Hand, Player, PlayerHand
from app.database.session import SessionLocal, engine

Base.metadata.create_all(engine)

ALL_PLAYERS = ["Adam", "Gil", "Michelle", "Jed", "Zain", "Matt", "Juan", "Jordan", "Bello"]

RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"]
SUITS = ["h", "d", "c", "s"]
FULL_DECK = [f"{r}{s}" for r in RANKS for s in SUITS]

NUM_GAMES = 3
HANDS_PER_GAME = 5
MIN_PLAYERS = 4
MAX_PLAYERS = 7


def deal(deck: list[str], n: int) -> list[str]:
    """Pop n cards from the shuffled deck."""
    return [deck.pop() for _ in range(n)]


def generate_hand(player_names: list[str]) -> dict:
    """Generate a single hand with random cards for the given players."""
    deck = FULL_DECK.copy()
    random.shuffle(deck)

    flop = deal(deck, 3)
    turn = deal(deck, 1)[0]
    river = deal(deck, 1)[0]

    # Decide outcomes: 1 winner, some folds, rest losses
    outcomes = []
    num_folds = random.randint(0, max(0, len(player_names) - 2))
    fold_indices = set(random.sample(range(len(player_names)), num_folds))
    remaining = [i for i in range(len(player_names)) if i not in fold_indices]
    winner_idx = random.choice(remaining)

    pot = 0.0
    entries = []
    for i, name in enumerate(player_names):
        hole = deal(deck, 2)
        if i in fold_indices:
            result = "fold"
            pl = -round(random.uniform(5, 15), 2)
        elif i == winner_idx:
            result = "win"
            pl = 0.0  # placeholder — computed after
        else:
            result = "loss"
            pl = -round(random.uniform(15, 40), 2)
        pot -= pl if result != "win" else 0
        entries.append({
            "name": name,
            "card_1": hole[0],
            "card_2": hole[1],
            "result": result,
            "profit_loss": pl,
        })

    # Winner gets the pot
    for e in entries:
        if e["result"] == "win":
            e["profit_loss"] = round(pot, 2)
            break

    return {
        "flop_1": flop[0], "flop_2": flop[1], "flop_3": flop[2],
        "turn": turn, "river": river,
        "players": entries,
    }


def seed():
    db = SessionLocal()
    try:
        # Wipe existing data so only seed records remain
        db.query(PlayerHand).delete()
        db.query(Hand).delete()
        db.query(GamePlayer).delete()
        db.query(GameSession).delete()
        db.query(Player).delete()
        db.flush()

        # Create players
        player_map: dict[str, Player] = {}
        for name in ALL_PLAYERS:
            p = Player(name=name)
            db.add(p)
            db.flush()
            player_map[name] = p

        base_date = date(2026, 4, 5)

        for game_num in range(NUM_GAMES):
            game_date = base_date + timedelta(days=game_num)

            # Sample a random subset of players for this game
            num_players = random.randint(MIN_PLAYERS, min(MAX_PLAYERS, len(ALL_PLAYERS)))
            game_player_names = sorted(random.sample(ALL_PLAYERS, num_players))

            game = GameSession(game_date=game_date, status="completed" if game_num < NUM_GAMES - 1 else "active")
            db.add(game)
            db.flush()

            for name in game_player_names:
                db.add(GamePlayer(game_id=game.game_id, player_id=player_map[name].player_id))

            for hand_number in range(1, HANDS_PER_GAME + 1):
                hand_data = generate_hand(game_player_names)
                hand = Hand(
                    game_id=game.game_id,
                    hand_number=hand_number,
                    flop_1=hand_data["flop_1"],
                    flop_2=hand_data["flop_2"],
                    flop_3=hand_data["flop_3"],
                    turn=hand_data["turn"],
                    river=hand_data["river"],
                    created_at=datetime.now(timezone.utc),
                )
                db.add(hand)
                db.flush()

                for entry in hand_data["players"]:
                    player = player_map[entry["name"]]
                    ph = PlayerHand(
                        hand_id=hand.hand_id,
                        player_id=player.player_id,
                        card_1=entry["card_1"],
                        card_2=entry["card_2"],
                        result=entry["result"],
                        profit_loss=entry["profit_loss"],
                    )
                    db.add(ph)

            db.flush()
            print(f"  Game {game.game_id}: {game_date} — {len(game_player_names)} players, {HANDS_PER_GAME} hands")

        db.commit()
        print(f"Seeded {NUM_GAMES} games with {HANDS_PER_GAME} hands each.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
