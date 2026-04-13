import { useEffect, useRef, useState } from 'react';

export interface UsePollingOptions {
  intervalMs: number;
  fetchFn: (signal: AbortSignal) => Promise<unknown>;
  enabled?: boolean;
}

export interface UsePollingResult {
  isReconnecting: boolean;
}

export function usePolling({ intervalMs, fetchFn, enabled = true }: UsePollingOptions): UsePollingResult {
  const [isReconnecting, setIsReconnecting] = useState(false);
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  });

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    const { signal } = controller;

    function poll() {
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
    }

    poll();
    const intervalId = setInterval(poll, intervalMs);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [intervalMs, enabled]);

  return { isReconnecting };
}
