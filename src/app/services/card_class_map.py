"""Bidirectional mapping between YOLO class indices and AIA card notation.

The YOLO class indices come from data/cards/data.yaml (Roboflow Playing Cards
dataset). Class names are alphabetically sorted, so index 0 is "10 of clubs"
and index 51 is "queen of spades".

AIA notation is Rank + Suit where:
  Rank: A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K
  Suit: S, H, D, C
"""

_RANK_MAP = {
    '10': '10',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    'ace': 'A',
    'jack': 'J',
    'king': 'K',
    'queen': 'Q',
}

_SUIT_MAP = {
    'clubs': 'C',
    'diamonds': 'D',
    'hearts': 'H',
    'spades': 'S',
}

# Class names from data.yaml in alphabetical order (indices 0–51).
_CLASS_NAMES: list[str] = [
    '10 of clubs',
    '10 of diamonds',
    '10 of hearts',
    '10 of spades',
    '2 of clubs',
    '2 of diamonds',
    '2 of hearts',
    '2 of spades',
    '3 of clubs',
    '3 of diamonds',
    '3 of hearts',
    '3 of spades',
    '4 of clubs',
    '4 of diamonds',
    '4 of hearts',
    '4 of spades',
    '5 of clubs',
    '5 of diamonds',
    '5 of hearts',
    '5 of spades',
    '6 of clubs',
    '6 of diamonds',
    '6 of hearts',
    '6 of spades',
    '7 of clubs',
    '7 of diamonds',
    '7 of hearts',
    '7 of spades',
    '8 of clubs',
    '8 of diamonds',
    '8 of hearts',
    '8 of spades',
    '9 of clubs',
    '9 of diamonds',
    '9 of hearts',
    '9 of spades',
    'ace of clubs',
    'ace of diamonds',
    'ace of hearts',
    'ace of spades',
    'jack of clubs',
    'jack of diamonds',
    'jack of hearts',
    'jack of spades',
    'king of clubs',
    'king of diamonds',
    'king of hearts',
    'king of spades',
    'queen of clubs',
    'queen of diamonds',
    'queen of hearts',
    'queen of spades',
]


def _label_to_aia(label: str) -> str:
    """Convert a dataset label like '10 of clubs' to AIA notation like '10C'."""
    rank_str, _, suit_str = label.partition(' of ')
    return _RANK_MAP[rank_str] + _SUIT_MAP[suit_str]


# Build lookup tables once at import time.
_ID_TO_CARD: dict[int, str] = {
    i: _label_to_aia(name) for i, name in enumerate(_CLASS_NAMES)
}
_CARD_TO_ID: dict[str, int] = {card: i for i, card in _ID_TO_CARD.items()}


def class_id_to_card(class_id: int) -> str:
    """Return the AIA notation string for a YOLO class index.

    Raises ValueError if class_id is not in 0–51.
    """
    try:
        return _ID_TO_CARD[class_id]
    except KeyError:
        raise ValueError(f'Invalid class_id: {class_id}. Must be 0–51.') from None


def card_to_class_id(card: str) -> int:
    """Return the YOLO class index for an AIA notation string.

    Raises ValueError if card is not a valid AIA notation.
    """
    try:
        return _CARD_TO_ID[card]
    except KeyError:
        raise ValueError(f'Unknown card notation: {card!r}') from None
