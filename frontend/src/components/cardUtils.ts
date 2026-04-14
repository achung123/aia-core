const VALID_RANKS = new Set(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
const VALID_SUITS = new Set(['H', 'D', 'C', 'S']);

export function isValidCard(str: string): boolean {
  const upperCaseCard = str.trim().toUpperCase();
  if (!upperCaseCard) return false;
  const suit = upperCaseCard.slice(-1);
  const rank = upperCaseCard.slice(0, -1);
  return VALID_RANKS.has(rank) && VALID_SUITS.has(suit);
}

export function normalizeCard(str: string): string {
  return str.trim().toUpperCase();
}

export function findDuplicateCards(cards: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const card of cards) {
    const normalized = normalizeCard(card);
    if (!normalized) continue;
    if (seen.has(normalized)) {
      duplicates.add(normalized);
    }
    seen.add(normalized);
  }
  return duplicates;
}
