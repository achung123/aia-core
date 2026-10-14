import { useEffect, useRef } from 'react';
import { subscribeToGame } from '../api/gameEvents.ts';

/**
 * Run `onChange` whenever anything about the game changes on the server.
 * Pass `null` to stay disconnected (no game selected, or nothing to refresh).
 */
export function useGameEvents(gameId: number | null | undefined, onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (gameId == null || Number.isNaN(gameId)) return;
    return subscribeToGame(gameId, () => onChangeRef.current());
  }, [gameId]);
}
