"""Card validation utilities for poker card handling."""


def validate_no_duplicate_cards(cards: list[str]) -> None:
    """
    Validate that a list of cards contains no duplicates.

    Args:
        cards: List of card strings (e.g., ['AS', 'KH', '2D'])

    Raises:
        ValueError: If duplicate cards are found in the list

    Example:
        >>> validate_no_duplicate_cards(['AS', 'KH', '2D'])  # OK
        >>> validate_no_duplicate_cards(['AS', 'KH', 'AS'])  # Raises ValueError
    """
    if not cards:
        return

    seen = set()
    duplicates = set()

    for card in cards:
        if card in seen:
            duplicates.add(card)
        seen.add(card)

    if duplicates:
        duplicate_list = ', '.join(sorted(duplicates))
        raise ValueError(f'Duplicate cards found: {duplicate_list}')
