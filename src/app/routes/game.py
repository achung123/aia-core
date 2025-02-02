from fastapi import APIRouter

from pydantic_models.app_models import Hand

router = APIRouter()


@router.post("/")
def create_game():
    return {"message": "New Game Created"}


@router.get("/game/{game_id}")
def get_game(game_id: int):
    # TODO: Implement this endpoint
    return {"message": f"Game {game_id}"}


@router.post("/hand/{user_id}")
def push_hand(user_id: int, hand: Hand):
    print(hand)  # noqa: T201
    return {"message": f"Hand {hand} for user {user_id} pushed"}
