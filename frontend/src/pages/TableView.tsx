// T-032 — Player POV route, migrated from the imperative poker-scene helper
// to the declarative `<PokerTable>` composition with `viewer.policy='player'`.
//
// The viewer's seat is resolved from the `player` query param via the
// session's `players[].seat_number` lookup. Equity overlay is hard-forced
// off at the call site (layer 1 of the triple-layer equity gate —
// `<PokerTable>` also gates `useEquityQuery.enabled` and the ESLint rule
// `no-equity-in-player` blocks direct imports of `fetchEquity`).
//
// Legacy the legacy hand-to-player-card adapter and direct showdown check are gone —
// hole-card visibility now flows exclusively through `canSee()` inside
// `<Card faceUp>` driven by `viewer.policy='player'` + `viewer.seat`.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchGame } from '../api/client.ts';
import { useHandPolling } from '../hooks/useHandPolling.ts';
import { PokerCanvas } from '../scenes3d/PokerCanvas.tsx';
import { PokerTable } from '../scenes3d/PokerTable.tsx';
import { handsToTableState } from '../scenes3d/data/handsToTableState.ts';
import type { ViewerContext } from '../scenes3d/types';
import { SessionScrubber } from '../components/SessionScrubber.tsx';

export function TableView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameIdStr = searchParams.get('game');
  const playerName = searchParams.get('player');
  const gameId = gameIdStr ? Number(gameIdStr) : null;

  // `scrubIndex` is the viewer's pinned hand index. It's kept in sync
  // with the latest hand whenever the viewer is "following latest" via
  // the effect below — this is the single authoritative source of truth
  // for both the polling hook (which uses it to decide auto-advance vs.
  // new-hand-banner) and the render path.
  const [scrubIndex, setScrubIndex] = useState<number>(-1);
  // `isFollowingLatest` tracks whether the viewer has explicitly scrubbed
  // away from the latest hand. True on mount; flipped to false when the
  // user drags the scrubber; flipped back when they return to the
  // newest hand.
  const [isFollowingLatest, setIsFollowingLatest] = useState(true);

  // Game metadata — needed for the viewer-seat lookup and the seat→player
  // map that `handsToTableState` builds.
  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGame(gameId as number),
    enabled: gameId !== null,
  });

  const handleAutoAdvance = useCallback((newIndex: number) => {
    setScrubIndex(newIndex);
  }, []);

  const { hands, newHandAvailable, dismissNewHand, hasFetched } = useHandPolling({
    gameId,
    currentHandIndex: scrubIndex,
    onAutoAdvance: handleAutoAdvance,
  });

  // When the viewer is implicitly "following latest" (initial load or
  // returned to the newest hand via the scrubber), keep scrubIndex
  // pinned to the newest hand as hands arrive. This is state
  // synchronisation against an external source (the poll result), which
  // is the textbook case the set-state-in-effect rule exempts — the
  // linter can't see the equality guard, so we acknowledge it inline.
  useEffect(() => {
    if (!isFollowingLatest) return;
    const latest = hands.length - 1;
    if (latest >= 0 && latest !== scrubIndex) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScrubIndex(latest);
    }
  }, [hands, isFollowingLatest, scrubIndex]);

  const selectedHand =
    scrubIndex >= 0 && scrubIndex < hands.length ? hands[scrubIndex] : null;
  const currentHandNumber = selectedHand?.hand_number ?? 0;

  const viewerSeat = useMemo<number | null>(() => {
    if (!game || !playerName) return null;
    const p = (game.players ?? []).find((pp) => pp.name === playerName);
    return typeof p?.seat_number === 'number' ? p.seat_number : null;
  }, [game, playerName]);

  const viewer = useMemo<ViewerContext>(() => {
    return viewerSeat !== null
      ? { policy: 'player', seat: viewerSeat }
      : { policy: 'player' };
  }, [viewerSeat]);

  const tableState = useMemo(() => {
    if (!game || !selectedHand) return null;
    return handsToTableState({ game, hand: selectedHand, viewer });
  }, [game, selectedHand, viewer]);

  const handleBack = useCallback(() => {
    if (gameId && playerName) {
      navigate(`/player?game=${gameId}&player=${encodeURIComponent(playerName)}`);
    } else {
      navigate('/player');
    }
  }, [navigate, gameId, playerName]);

  const handleScrubberChange = useCallback(
    (handNumber: number) => {
      const idx = hands.findIndex((h) => h.hand_number === handNumber);
      if (idx < 0) return;
      setScrubIndex(idx);
      // Follow latest again iff the user jumped back to the newest hand;
      // otherwise pin and show the "new hand available" banner on future
      // polls.
      setIsFollowingLatest(idx === hands.length - 1);
      dismissNewHand();
    },
    [hands, dismissNewHand],
  );

  if (!gameId) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>Missing game ID in URL.</p>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
      </div>
    );
  }

  if (!playerName) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>Missing player name in URL.</p>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
      </div>
    );
  }

  const loading = !hasFetched || !game;
  const noHands = hasFetched && hands.length === 0;

  // Camera preset: explicit seat-POV when we know the viewer seat; the
  // `<PokerTable>` guard also forces this under `viewer.policy='player'`,
  // but passing it here keeps the call site self-documenting.
  const cameraPreset =
    viewerSeat !== null ? ({ kind: 'seat' as const, seat: viewerSeat }) : 'default';

  return (
    <div style={styles.viewport}>
      <div data-testid="hud-bar" style={styles.hudBar}>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
        {loading && <p style={styles.loadingText}>Loading table…</p>}
        {noHands && <p style={styles.error}>No hands found for this game.</p>}
      </div>

      <div data-testid="canvas-area" style={styles.canvasArea}>
        {tableState && (
          <PokerCanvas>
            <PokerTable
              state={tableState}
              viewer={viewer}
              equityOverlay={false}
              cameraPreset={cameraPreset}
            />
          </PokerCanvas>
        )}

        {newHandAvailable && (
          <div
            data-testid="new-hand-banner"
            style={styles.newHandBanner}
            onClick={() => {
              if (hands.length > 0) {
                handleScrubberChange(hands[hands.length - 1].hand_number);
              }
            }}
          >
            New hand available — tap to view
          </div>
        )}
      </div>

      {hands.length > 0 && (
        <div data-testid="scrubber-mount" style={styles.scrubberMount}>
          <SessionScrubber
            handCount={hands.length}
            currentHand={currentHandNumber}
            onChange={handleScrubberChange}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  viewport: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100dvh',
    overflow: 'hidden',
    background: '#1a1a2e',
  },
  hudBar: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    padding: 'max(6px, env(safe-area-inset-top)) 8px 6px',
    background: 'rgba(26, 26, 46, 0.95)',
    flexShrink: 0,
    zIndex: 5,
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  },
  backBtn: {
    padding: '0.3rem 0.6rem',
    minHeight: '36px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  loadingText: {
    color: '#c7d2fe',
    fontSize: '0.85rem',
    margin: 0,
  },
  error: {
    color: '#f87171',
    fontSize: '0.85rem',
    margin: 0,
  },
  scrubberMount: {
    flexShrink: 0,
    zIndex: 5,
  },
  newHandBanner: {
    position: 'absolute',
    bottom: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 11,
    background: 'rgba(59, 130, 246, 0.95)',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    padding: '8px 20px',
    borderRadius: '20px',
    cursor: 'pointer',
    pointerEvents: 'auto',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
};
