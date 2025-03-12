from sqlalchemy.orm import Session

from .database_models import Community, Game


def query_community_with_date_and_hand(db: Session, date: str, hand: int):
    """
    Query the database for a specific date and hand number.

    Args:
        db (Session): The database session
        date (str): The date of the game
        hand (int): The hand number

    Returns:
        list[Community]: The query results

    """
    return (
        db.query(Community)
        .filter(
            Community.game_date == date,
            Community.hand_number == hand,
        )
        .order_by(Community.id)
        .all()
    )


def query_game_with_date(db: Session, date: str):
    """
    Query the database for a specific date.

    Args:
        db (Session): The database session
        date (str): The date of the game

    Returns:
        list[Game]: The query results

    """
    return db.query(Game).filter(Game.game_date == date).all()
