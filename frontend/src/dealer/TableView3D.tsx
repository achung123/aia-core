// T-030 — dealer-embed 3D view, migrated from the imperative
// imperative-scene helper to the declarative `<PokerTable>` composition.
//
// The dealer sees all hole cards (spectator policy) and benefits from
// live equity badges while recording a hand, so:
//   - `viewer.policy = 'spectator'` → `canSee()` returns true for every seat,
//   - `equityOverlay = true`        → `<PokerTable>` mounts `<EquityBadges>`
//                                     and `useEquityQuery` fetches `/equity`.
//
// Live polling is delegated to `useHandPolling` (10s interval, aborts on
// unmount), identical to the player-POV route (T-032).

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchGame } from '../api/client.ts';
import { useHandPolling } from '../hooks/useHandPolling.ts';
import { PokerCanvas } from '../scenes3d/PokerCanvas.tsx';
import { PokerTable } from '../scenes3d/PokerTable.tsx';
import { handsToTableState } from '../scenes3d/data/handsToTableState.ts';
import { useTableStore } from '../scenes3d/state/tableStore.ts';
import type { ViewerContext } from '../scenes3d/types';

// Stable reference — `handsToTableState`'s memo key uses it.
const SPECTATOR_VIEWER: ViewerContext = { policy: 'spectator' };

export interface TableView3DProps {
  gameId: number;
}

export function TableView3D({ gameId }: TableView3DProps) {
  // Pinned hand index. The dealer embed always follows the latest hand —
  // there's no scrubber at this layer (the sibling `<StreetScrubber>` in
  // `ActiveHandDashboard` drives intra-hand street navigation, not
  // cross-hand navigation).
  const [scrubIndex, setScrubIndex] = useState<number>(-1);

  // Route-level store→props wiring: read the user-selected theme and
  // quality tier from the persisted `useTableStore` slice and forward them
  // to `<PokerTable>` so the dealer embed reacts to <TableSettingsPanel>
  // changes (T-030 AC-5 — theme dim: aia-core-r11d; qualityTier dim:
  // aia-core-t4dp, now that T-027 / aia-core-y39z added the slice).
  const theme = useTableStore((s) => s.theme);
  const qualityTier = useTableStore((s) => s.qualityTier);

  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGame(gameId),
    enabled: gameId !== null && gameId !== undefined,
  });

  const handleAutoAdvance = useCallback((newIndex: number) => {
    setScrubIndex(newIndex);
  }, []);

  const { hands } = useHandPolling({
    gameId,
    currentHandIndex: scrubIndex,
    onAutoAdvance: handleAutoAdvance,
  });

  // Initial-load advance: `useHandPolling`'s `onAutoAdvance` is guarded
  // by `prevCount > 0`, so it skips the first fetch. Sync scrubIndex to
  // the latest hand once data arrives. See `pages/TableView.tsx` for
  // the same pattern and rationale.
  useEffect(() => {
    const latest = hands.length - 1;
    if (latest >= 0 && latest !== scrubIndex) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrubIndex(latest);
    }
  }, [hands, scrubIndex]);

  const selectedHand =
    scrubIndex >= 0 && scrubIndex < hands.length ? hands[scrubIndex] : null;

  const tableState = useMemo(() => {
    if (!game || !selectedHand) return null;
    return handsToTableState({ game, hand: selectedHand, viewer: SPECTATOR_VIEWER });
  }, [game, selectedHand]);

  return (
    <div data-testid="table-view-3d" style={styles.container}>
      {tableState && (
        <PokerCanvas>
          <PokerTable
            state={tableState}
            viewer={SPECTATOR_VIEWER}
            theme={theme}
            qualityTier={qualityTier}
            equityOverlay={true}
            cameraPreset="topDown"
          />
        </PokerCanvas>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: '100%',
    height: 'min(400px, 50vh)',
    position: 'relative',
  },
};
