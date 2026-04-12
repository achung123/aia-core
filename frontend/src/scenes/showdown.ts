export interface ShowdownPlayerHand {
  result?: string | null;
}

/**
 * Detect showdown: any player with result won/lost (or mapped win/loss) triggers reveal.
 */
export function isShowdown(playerHands: ShowdownPlayerHand[]): boolean {
  return playerHands.some(ph => {
    const r = ph.result;
    return r === 'won' || r === 'lost' || r === 'win' || r === 'loss';
  });
}
