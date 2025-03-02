from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pydantic_models.app_models import Hand
import time

router = APIRouter()

# Pydantic models for data validation
class Game(BaseModel):
    game_id: str
    game_date: int
    winner: str
    losers: str

class Hand(BaseModel):
    game_id: str
    player_id: str
    hand_number: int
    hole_cards: str
    on_cheese: bool

class Community(BaseModel):
    game_id: str
    hand_number: int
    board_cards: str
    active_players: str

class Game_Statistics(BaseModel):
    game_id: str
    player_id: str
    best_hands: str # possibly a list?
    hole_cards: str



@router.post("/")
def create_game():
    return {"message": "New Game Created"}


@router.get("/{game_id}")
def get_game(game_id: int):
    # TODO: Implement this endpoint
    return {"message": f"Game {game_id}"}


@router.post("/hand/{user_id}")
def push_hand(user_id: int, hand: Hand):
    print(hand)  # noqa: T201
    return {"message": f"Hand {hand} for user {user_id} pushed"}


# Endpoint to create a new game
@router.post("/game", response_model=Game)
async def create_game(game: Game):
    """
    Create a new game table
    """
    if game.game_id in Game:
        raise HTTPException(status_code=400, detail="Game ID already exists")
    
    # If game_date is 0 or invalid, set to current timestamp
    if game.game_date <= 0:
        game.game_date = int(time.time()) #Change to int
    
    Game[game.game_id] = game
    Hand[game.game_id] = {}  # Initialize hands storage for this game
    return game


# Endpoint to update a hand in a given game
@router.put("/game/hand", response_model=Hand)
async def update_hand(hand: Hand):
    """
    Update the hand in given game
    Parametrized by player_id and game_id
    """
    if hand.game_id not in Game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Initialize player hands dictionary if not exists
    if hand.player_id not in Hand[hand.game_id]:
        Hand[hand.game_id][hand.player_id] = []
    
    # Check if hand already exists
    existing_hands = Hand[hand.game_id][hand.player_id]
    for i, existing_hand in enumerate(existing_hands):
        if existing_hand.hand_number == hand.hand_number:
            # Update existing hand
            existing_hands[i] = hand
            return hand
    
    # If hand doesn't exist, append new hand
    Hand[hand.game_id][hand.player_id].append(hand)
    return hand


# Endpoint to get hand contents
@router.get("/game/hand", response_model=Hand)
async def get_hand(game_id: str, player_id: str, hand_number: int):
    """
    Get the contents of a given hand
    Parametrized by player_id, game_id, and hand_number
    """
    if game_id not in Game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if player_id not in Hand[game_id]:
        raise HTTPException(status_code=404, detail="Player has no hands in this game")
    
    for hand in Hand[game_id][player_id]:
        if hand.hand_number == hand_number:
            return hand
    
    raise HTTPException(status_code=404, detail="Hand not found")
