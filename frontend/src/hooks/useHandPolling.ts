import { useState, useRef, useCallback, useEffect } from 'react';
import { usePolling } from './usePolling.ts';
import { fetchHands } from '../api/client.ts';
import type { HandResponse } from '../api/types.ts';

export interface UseHandPollingOptions {
  gameId: number | null;
  currentHandIndex: number;
  onAutoAdvance?: (newIndex: number) => void;
}

export interface UseHandPollingResult {
  hands: HandResponse[];
  newHandAvailable: boolean;
  dismissNewHand: () => void;
  isReconnecting: boolean;
  hasFetched: boolean;
}

export function useHandPolling({
  gameId,
  currentHandIndex,
  onAutoAdvance,
}: UseHandPollingOptions): UseHandPollingResult {
  const [hands, setHands] = useState<HandResponse[]>([]);
  const [newHandAvailable, setNewHandAvailable] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const prevCountRef = useRef(0);
  const currentHandIndexRef = useRef(currentHandIndex);
  const onAutoAdvanceRef = useRef(onAutoAdvance);
  useEffect(() => {
    currentHandIndexRef.current = currentHandIndex;
    onAutoAdvanceRef.current = onAutoAdvance;
  });

  const fetchFn = useCallback(
    async (signal: AbortSignal) => {
      if (gameId === null) return;
      const fetched = await fetchHands(gameId, { signal });
      const sorted = [...fetched].sort((a, b) => a.hand_number - b.hand_number);
      const prevCount = prevCountRef.current;
      const hasNewHand = prevCount > 0 && sorted.length > prevCount;

      setHands(sorted);
      setHasFetched(true);
      prevCountRef.current = sorted.length;

      if (hasNewHand) {
        const wasOnLatest = currentHandIndexRef.current === prevCount - 1;
        if (wasOnLatest && onAutoAdvanceRef.current) {
          onAutoAdvanceRef.current(sorted.length - 1);
        } else if (!wasOnLatest) {
          setNewHandAvailable(true);
        }
      }
    },
    [gameId],
  );

  const { isReconnecting } = usePolling({
    intervalMs: 10000,
    fetchFn,
    enabled: gameId !== null,
  });

  const dismissNewHand = useCallback(() => {
    setNewHandAvailable(false);
  }, []);

  return { hands, newHandAvailable, dismissNewHand, isReconnecting, hasFetched };
}
