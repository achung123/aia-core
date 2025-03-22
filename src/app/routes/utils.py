import datetime

import pytz
from dateutil.parser import parse

from app.database.database_models import Community
from pydantic_models.app_models import (
    Card,
    CommunityState,
)


def convert_community_query_to_state(community_query: Community) -> CommunityState:
    """
    Convert a Community query to a CommunityState model.

    Args:
        community_query (Community): The Community query

    Returns:
        CommunityState: The Community state model

    """
    turn_card = (
        None
        if community_query.turn_card == 'None'
        else Card(rank=community_query.turn_card[0], suit=community_query.turn_card[1])
    )
    river_card = (
        None
        if community_query.river_card == 'None'
        else Card(
            rank=community_query.river_card[0], suit=community_query.river_card[1]
        )
    )
    return CommunityState(
        game_date=community_query.game_date,
        hand_number=community_query.hand_number,
        flop_card_0=Card(
            rank=community_query.flop_card_0[0], suit=community_query.flop_card_0[1]
        ),
        flop_card_1=Card(
            rank=community_query.flop_card_1[0], suit=community_query.flop_card_1[1]
        ),
        flop_card_2=Card(
            rank=community_query.flop_card_2[0], suit=community_query.flop_card_2[1]
        ),
        turn_card=turn_card,
        river_card=river_card,
        active_players=community_query.players.split(','),
    )


def convert_community_state_to_query(
    game_date: str, hand_number: int, community_state: CommunityState
) -> Community:
    """
    Convert a CommunityState model to a Community query.

    Args:
        game_date (str): The date of the game
        hand_number (int): The hand number
        community_state (CommunityState): The Community state model

    Returns:
        Community: The Community query

    """
    turn_card = str(community_state.turn_card) if community_state.turn_card else 'None'
    river_card = (
        str(community_state.river_card) if community_state.river_card else 'None'
    )
    return Community(
        game_date=game_date,
        time_stamp=datetime.datetime.now(pytz.timezone('America/New_York')).strftime(
            '%H:%M:%S'
        ),
        hand_number=hand_number,
        flop_card_0=str(community_state.flop_card_0),
        flop_card_1=str(community_state.flop_card_1),
        flop_card_2=str(community_state.flop_card_2),
        turn_card=turn_card,
        river_card=river_card,
        players=','.join(community_state.active_players),
    )


def validate_game_date(value: str) -> str:
    """Ensure game_date follows MM-DD-YYYY format and is a valid date."""
    try:
        parse(value, dayfirst=False, yearfirst=False)  # Validate the date
    except ValueError as e:
        msg = 'game_date must be a valid date in MM-DD-YYYY format'
        raise ValueError(msg) from e
    return value
