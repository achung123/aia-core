// T-031 — Full-page playback route, migrated from the imperative scene to
// `<PokerCanvas>` + `<PokerTable>` wrapped by `<SessionReplayShell>` which
// owns cross-hand auto-advance and speed controls.
//
// Viewer policy is `spectator` and `equityOverlay={true}` — playback runs
// the equity overlay against the server `/equity` endpoint; the legacy
// legacy client-side equity evaluator path is gone (see tasks.md T-031 AC-5).
//
// Entry point: [DataView.tsx](../views/DataView.tsx) "▶ Playback" button
// navigates to `#/playback?gameId=<id>`.

import { useCallback, type CSSProperties } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchGame, fetchHands } from '../api/client.ts';
import { PokerCanvas } from '../scenes3d/PokerCanvas.tsx';
import { PokerTable } from '../scenes3d/PokerTable.tsx';
import { SessionReplayShell } from '../scenes3d/SessionReplayShell.tsx';
import { QualityToast } from '../scenes3d/components/QualityToast.tsx';
import { useTableStore } from '../scenes3d/state/tableStore.ts';
import { useSessionReplayContext } from '../scenes3d/SessionReplayShell.tsx';
import type { ViewerContext } from '../scenes3d/types';
import { playbackLayoutStyles as mobileStyles, gameSelectorStyles as selectorStyles } from '../styles/playbackStyles';

// Stable reference — `<PokerTable>` memoizes on `viewer` identity.
const SPECTATOR_VIEWER: ViewerContext = { policy: 'spectator' };

const ACTIVE_POLL_INTERVAL_MS = 10_000;

/** Bridge from the replay context into `<PokerTable>`. The shell publishes
 * a derived `TableState` whose `phase`/`streetIndex` tracks the replay
 * slice, so we simply forward it into the canvas.
 */
function ReplayCanvas() {
  const theme = useTableStore((s) => s.theme);
  const qualityTier = useTableStore((s) => s.qualityTier);
  const { tableState, viewer } = useSessionReplayContext();
  if (!tableState) return null;
  return (
    <PokerCanvas>
      <PokerTable
        state={tableState}
        viewer={viewer}
        theme={theme}
        qualityTier={qualityTier}
        equityOverlay={true}
        cameraPreset="topDown"
      />
    </PokerCanvas>
  );
}

export function PlaybackView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameIdParam = searchParams.get('gameId');
  const gameId = gameIdParam ? Number(gameIdParam) : null;

  const gameQuery = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGame(gameId as number),
    enabled: gameId !== null && !Number.isNaN(gameId),
  });

  const isActive = gameQuery.data?.status === 'active';
  const handsQuery = useQuery({
    queryKey: ['hands', gameId],
    queryFn: () => fetchHands(gameId as number),
    enabled: gameId !== null && !Number.isNaN(gameId),
    refetchInterval: isActive ? ACTIVE_POLL_INTERVAL_MS : false,
  });

  const handleBack = useCallback(() => navigate('/data'), [navigate]);

  if (gameId === null || Number.isNaN(gameId)) {
    return (
      <div data-testid="playback-game-selector" style={selectorStyles.container}>
        <h2 style={selectorStyles.heading}>Playback</h2>
        <p style={{ color: '#94a3b8', textAlign: 'center' as const, marginTop: '2rem' }}>
          Select a game from{' '}
          <a href="#/data" style={{ color: '#c084fc' }}>Game Sessions</a>
          {' '}and click <strong>▶ Playback</strong> to watch it here.
        </p>
      </div>
    );
  }

  const game = gameQuery.data;
  const hands = handsQuery.data ?? [];

  return (
    <div data-testid="mobile-canvas" style={mobileStyles.wrapper}>
      <button
        data-testid="back-button"
        onClick={handleBack}
        style={mobileStyles.backButton}
      >
        ← Back
      </button>
      <QualityToast />
      {game && (
        <SessionReplayShell
          gameId={gameId}
          game={game}
          hands={hands}
          initialHandIndex={0}
          initialSpeed={1}
          viewer={SPECTATOR_VIEWER}
          style={shellStyle}
        >
          <div data-testid="canvas-area" style={mobileStyles.canvasArea}>
            <ReplayCanvas />
          </div>
        </SessionReplayShell>
      )}
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
};
