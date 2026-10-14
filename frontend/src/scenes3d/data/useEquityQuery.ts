// T-020 — react-query wrapper for `fetchEquity` (layer 2 of 3 in plan.md
// § "Equity Overlay — Enforcement Model").
//
// When `enabled` is false (e.g. spectator with overlay off, player
// policy, etc.) react-query never invokes the fetcher — so the endpoint
// is never hit. Consumers compute `enabled` via
// `resolveEquityOverlay(prop, viewer)` so the player-policy guard is
// honoured at the network layer too.
//
// The query key includes `streetIndex` so equity re-fetches whenever the
// street advances (preflop → flop → turn → river → showdown) — this is
// what the spec calls "values refresh on street change" (T-020 AC 4).

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchEquity } from '../../api/client';
import { useGameEvents } from '../../hooks/useGameEvents';
import type { EquityResponse } from '../../api/types';
import type { TableState } from '../types';

export interface UseEquityQueryArgs {
  gameId: number;
  handNumber: number;
  /** Re-fetch when the street advances. */
  streetIndex: TableState['streetIndex'];
  /** Composed guard: prop AND policy AND (optionally) hole-card count. */
  enabled: boolean;
}

/** Base react-query key prefix — exported for targeted invalidation. */
export const EQUITY_QUERY_KEY = 'scenes3d:equity' as const;

export function buildEquityQueryKey(
  gameId: number,
  handNumber: number,
  streetIndex: TableState['streetIndex'],
): readonly [typeof EQUITY_QUERY_KEY, number, number, number] {
  return [EQUITY_QUERY_KEY, gameId, handNumber, streetIndex];
}

export function equityStreetFromStreetIndex(
  streetIndex: TableState['streetIndex'],
): 'preflop' | 'flop' | 'turn' | 'river' {
  switch (streetIndex) {
    case 0:
      return 'preflop';
    case 1:
      return 'flop';
    case 2:
      return 'turn';
    case 3:
    case 4:
    default:
      return 'river';
  }
}

export function useEquityQuery({
  gameId,
  handNumber,
  streetIndex,
  enabled,
}: UseEquityQueryArgs): UseQueryResult<EquityResponse, Error> {
  const query = useQuery<EquityResponse, Error>({
    queryKey: buildEquityQueryKey(gameId, handNumber, streetIndex),
    queryFn: () => fetchEquity(gameId, handNumber, equityStreetFromStreetIndex(streetIndex)),
    enabled,
    // On fetch failure the badge silently hides (AC 5) — no retries so
    // we don't repeatedly hammer a failing endpoint while the hand is
    // on-screen.
    retry: false,
    // Equity is fresh for the life of a street; don't refetch on focus.
    refetchOnWindowFocus: false,
  });
  // A fold or a newly entered card changes the numbers without changing
  // the street, so refresh on any change to the game. The server caches
  // equity, so an unchanged hand costs nothing.
  const { refetch } = query;
  useGameEvents(enabled ? gameId : null, () => {
    void refetch();
  });
  return query;
}
