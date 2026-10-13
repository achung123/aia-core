export interface ShowdownPlayerHand {
  result?: string | null;
}

/**
 * Detect showdown: any player with result won/lost (or mapped win/loss) triggers reveal.
 */
export function isShowdown(playerHands: ShowdownPlayerHand[]): boolean {
  return playerHands.some(playerHand => {
    const result = playerHand.result;
    return result === 'won' || result === 'lost' || result === 'win' || result === 'loss';
  });
}
