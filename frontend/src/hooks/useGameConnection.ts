import { useEffect, useState } from 'react';
import { watchConnection, type ConnectionState } from '../api/gameEvents.ts';

/**
 * Whether live updates for the game are flowing. Pages poll underneath, so
 * 'reconnecting' means "updates may be a few seconds behind", not "broken".
 */
export function useGameConnection(gameId: number | null | undefined): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connecting');
  useEffect(() => {
    if (gameId == null || Number.isNaN(gameId)) return;
    return watchConnection(gameId, setState);
  }, [gameId]);
  return state;
}
