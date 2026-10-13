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

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchSessions, fetchGame, fetchHands, fetchHandActions } from '../api/client.ts';
import type { GameSessionListItem, HandResponse } from '../api/types/game.ts';
import { PokerCanvas } from '../scenes3d/PokerCanvas.tsx';
import { PokerTable } from '../scenes3d/PokerTable.tsx';
import { SessionReplayShell } from '../scenes3d/SessionReplayShell.tsx';
import { QualityToast } from '../scenes3d/components/QualityToast.tsx';
import { SceneErrorOverlay } from '../scenes3d/components/SceneErrorBoundary.tsx';
import { useTableStore } from '../scenes3d/state/tableStore.ts';
import { useSessionReplayContext } from '../scenes3d/SessionReplayShell.tsx';
import type { ViewerContext } from '../scenes3d/types';
import { playbackLayoutStyles as mobileStyles, gameSelectorStyles as selectorStyles } from '../styles/playbackStyles';

// Stable reference — `<PokerTable>` memoizes on `viewer` identity.
const SPECTATOR_VIEWER: ViewerContext = { policy: 'spectator' };

const ACTIVE_POLL_INTERVAL_MS = 10_000;
const EMPTY_HANDS: HandResponse[] = [];

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function sortedPlaybackSessions(
  sessions: GameSessionListItem[],
): GameSessionListItem[] {
  return [...sessions].sort((left, right) => {
    const playableDiff = Number(right.hand_count > 0) - Number(left.hand_count > 0);
    if (playableDiff !== 0) return playableDiff;
    return right.game_date.localeCompare(left.game_date) || right.game_id - left.game_id;
  });
}

function PlaybackGameSelector({
  sessions,
  isLoading,
  error,
  onSelect,
}: {
  sessions: GameSessionListItem[];
  isLoading: boolean;
  error: unknown;
  onSelect: (gameId: number) => void;
}) {
  return (
    <div data-testid="playback-game-selector" style={selectorStyles.container}>
      <h2 style={selectorStyles.heading}>Playback Visualizer</h2>
      {isLoading && <div style={selectorStyles.loading}>Loading sessions...</div>}
      {error && (
        <div style={selectorStyles.error}>{errorMessage(error)}</div>
      )}
      {!isLoading && !error && sessions.length === 0 && (
        <div style={selectorStyles.empty}>No sessions available.</div>
      )}
      {!isLoading && !error && sessions.length > 0 && (
        <div style={selectorStyles.list}>
          {sessions.map((session) => {
            const canReplay = session.hand_count > 0;
            return (
              <button
                key={session.game_id}
                type="button"
                data-testid={`playback-session-${session.game_id}`}
                disabled={!canReplay}
                onClick={() => onSelect(session.game_id)}
                style={{
                  ...selectorStyles.card,
                  ...(canReplay ? selectorStyles.cardActive : selectorStyles.cardComplete),
                  ...(!canReplay ? selectorStyles.cardDisabled : undefined),
                }}
              >
                <span style={selectorStyles.cardDate}>
                  {session.game_date || `Game ${session.game_id}`}
                  <span style={selectorStyles.gameId}> Game {session.game_id}</span>
                </span>
                <span style={selectorStyles.cardDetails}>
                  <span>{session.status || 'active'}</span>
                  <span>{countLabel(session.hand_count, 'hand')}</span>
                  <span>{countLabel(session.player_count, 'player')}</span>
                </span>
                <span style={selectorStyles.cardAction}>
                  {canReplay ? 'Open Visualizer' : 'No hands to replay'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Bridge from the replay context into `<PokerTable>`. The shell publishes
 * a derived `TableState` whose `phase`/`streetIndex` tracks the replay
 * slice, so we simply forward it into the canvas.
 */
function ReplayCanvas() {
  const theme = useTableStore((s) => s.theme);
  const qualityTier = useTableStore((s) => s.qualityTier);
  const { tableState, viewer } = useSessionReplayContext();

  // DIAGNOSTIC: bypass React state so remounts don't reset what we
  // see. We bump a module-level mount counter and a render counter
  // and write live values into a DOM node via ref. If "mounts" climbs
  // every second, the canvas tree is throwing and being remounted.
  PROBE_MOUNTS.value += 1;
  PROBE_RENDERS.value += 1;
  const probeRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;
      const el = wrapRef.current?.querySelector('canvas');
      const size = el ? `${el.clientWidth}x${el.clientHeight}` : 'no-canvas';
      if (probeRef.current) {
        probeRef.current.textContent =
          `mounts:${PROBE_MOUNTS.value} renders:${PROBE_RENDERS.value} ` +
          `ts:${tableState ? 'yes' : 'NO'} seats:${tableState?.seats.length ?? 0} ` +
          `tier:${qualityTier} canvas:${size} dt:${Math.round(dt)}ms`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tableState, qualityTier]);

  const probe = (
    <div
      data-testid="replay-canvas-probe"
      ref={probeRef}
      style={{
        position: 'absolute',
        top: 60,
        left: 8,
        right: 8,
        zIndex: 1500,
        padding: '6px 10px',
        background: 'rgba(0, 80, 0, 0.9)',
        color: '#fff',
        font: '11px ui-monospace, monospace',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      booting…
    </div>
  );
  if (!tableState) {
    return (
      <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
        {probe}
        <PokerCanvas />
      </div>
    );
  }
  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0 }}>
      {probe}
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
    </div>
  );
}

// Module-level counters so React-driven remounts don't reset them.
const PROBE_MOUNTS = { value: 0 };
const PROBE_RENDERS = { value: 0 };

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unable to load replay data.';
}

function PlaybackStatus({ title, detail }: { title: string; detail?: string }) {
  return (
    <div data-testid="playback-status" style={mobileStyles.statusShell}>
      <div style={mobileStyles.statusTitle}>{title}</div>
      {detail && <div style={mobileStyles.statusDetail}>{detail}</div>}
    </div>
  );
}

export function PlaybackView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameIdParam = searchParams.get('gameId');
  const gameId = gameIdParam ? Number(gameIdParam) : null;
  const needsSessionMenu = gameId === null || Number.isNaN(gameId);

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    enabled: needsSessionMenu,
  });

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

  const hands = handsQuery.data ?? EMPTY_HANDS;
  const selectedActionHand = hands.at(-1) ?? null;
  const selectedActionQuery = useQuery({
    queryKey: ['hand-actions', gameId, selectedActionHand?.hand_number ?? null],
    queryFn: () => fetchHandActions(gameId as number, selectedActionHand!.hand_number),
    enabled:
      gameId !== null &&
      !Number.isNaN(gameId) &&
      selectedActionHand !== null,
    staleTime: isActive ? 0 : Infinity,
    retry: 1,
  });
  const actionsByHandId = useMemo(() => {
    if (!selectedActionHand || !selectedActionQuery.data) return {};
    return { [selectedActionHand.hand_id]: selectedActionQuery.data };
  }, [selectedActionHand, selectedActionQuery.data]);

  const handleBack = useCallback(() => navigate('/data'), [navigate]);
  const handleSelectGame = useCallback(
    (selectedGameId: number) => navigate(`/playback?gameId=${selectedGameId}`),
    [navigate],
  );

  if (needsSessionMenu) {
    const sessions = sortedPlaybackSessions(sessionsQuery.data ?? []);
    return (
      <PlaybackGameSelector
        sessions={sessions}
        isLoading={sessionsQuery.status === 'pending'}
        error={sessionsQuery.error}
        onSelect={handleSelectGame}
      />
    );
  }

  const game = gameQuery.data;
  const hasHands = hands.length > 0;
  const replayError = gameQuery.error ?? handsQuery.error;
  const isReplayLoading =
    gameQuery.status === 'pending' || handsQuery.status === 'pending';

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
      <SceneErrorOverlay />
      {replayError && (
        <PlaybackStatus
          title="Playback unavailable"
          detail={errorMessage(replayError)}
        />
      )}
      {!replayError && isReplayLoading && (
        <PlaybackStatus title="Loading replay" />
      )}
      {!replayError && !isReplayLoading && game && !hasHands && (
        <PlaybackStatus
          title="No recorded hands yet"
          detail={`Game ${game.game_id} has no hands to replay.`}
        />
      )}
      {game && hasHands && (
        <SessionReplayShell
          gameId={gameId}
          game={game}
          hands={hands}
          actionsByHandId={actionsByHandId}
          initialHandIndex={hands.length - 1}
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
