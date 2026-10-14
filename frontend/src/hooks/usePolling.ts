import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameEvents } from './useGameEvents.ts';

export interface UsePollingOptions {
  intervalMs: number;
  fetchFn: (signal: AbortSignal) => Promise<unknown>;
  enabled?: boolean;
  /**
   * Game whose changes should trigger an immediate fetch. The interval then
   * only serves as a safety net for a dropped connection.
   */
  gameId?: number | null;
}

export interface UsePollingResult {
  isReconnecting: boolean;
  triggerNow: () => void;
}

export function usePolling({ intervalMs, fetchFn, enabled = true, gameId = null }: UsePollingOptions): UsePollingResult {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  const signalRef = useRef<AbortSignal | null>(null);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

  // One fetch at a time. A change that arrives while a fetch is running
  // queues exactly one more, so the screen always ends on the latest state
  // without requests piling up behind a slow connection.
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const doPollRef = useRef<() => void>(() => {});

  const doPoll = useCallback(() => {
    const signal = signalRef.current;
    if (!signal || signal.aborted) return;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    const finish = () => {
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        doPollRef.current();
      }
    };
    fetchFnRef.current(signal)
      .then(() => {
        if (!signal.aborted) setIsReconnecting(false);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsReconnecting(true);
      })
      .finally(finish);
  }, []);
  useEffect(() => {
    doPollRef.current = doPoll;
  }, [doPoll]);

  useEffect(() => {
    if (!enabled) {
      signalRef.current = null;
      return;
    }

    const controller = new AbortController();
    signalRef.current = controller.signal;

    doPoll();
    const intervalId = setInterval(doPoll, intervalMs);

    return () => {
      controller.abort();
      signalRef.current = null;
      inFlightRef.current = false;
      queuedRef.current = false;
      clearInterval(intervalId);
    };
  }, [intervalMs, enabled, doPoll]);

  const triggerNow = useCallback(() => {
    if (enabled && signalRef.current && !signalRef.current.aborted) {
      doPoll();
    }
  }, [enabled, doPoll]);

  useGameEvents(enabled ? gameId : null, triggerNow);

  return { isReconnecting, triggerNow };
}
