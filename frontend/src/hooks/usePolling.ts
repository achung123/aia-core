import { useCallback, useEffect, useRef, useState } from 'react';

export interface UsePollingOptions {
  intervalMs: number;
  fetchFn: (signal: AbortSignal) => Promise<unknown>;
  enabled?: boolean;
}

export interface UsePollingResult {
  isReconnecting: boolean;
  triggerNow: () => void;
}

export function usePolling({ intervalMs, fetchFn, enabled = true }: UsePollingOptions): UsePollingResult {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  const signalRef = useRef<AbortSignal | null>(null);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

  const doPoll = useCallback(() => {
    const signal = signalRef.current;
    if (!signal || signal.aborted) return;
    fetchFnRef.current(signal)
      .then(() => {
        if (!signal.aborted) setIsReconnecting(false);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsReconnecting(true);
      });
  }, []);

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
      clearInterval(intervalId);
    };
  }, [intervalMs, enabled, doPoll]);

  const triggerNow = useCallback(() => {
    if (enabled && signalRef.current && !signalRef.current.aborted) {
      doPoll();
    }
  }, [enabled, doPoll]);

  return { isReconnecting, triggerNow };
}
