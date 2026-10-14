// The player's own-seat view of the live table, embedded in the player
// screen so the cards, pot and actions are all in view without leaving it.
// Same scene and hole-card rules as the full-screen player table
// (`viewer.policy = 'player'`, equity overlay forced off); it always follows
// the latest hand and has no scrubber.
import { useMemo, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchGame } from '../api/client.ts';
import { useHandPolling } from '../hooks/useHandPolling.ts';
import { PokerCanvas } from '../scenes3d/PokerCanvas.tsx';
import { PokerTable } from '../scenes3d/PokerTable.tsx';
import { handsToTableState, resolveSeatMap } from '../scenes3d/data/handsToTableState.ts';
import type { ViewerContext } from '../scenes3d/types';

export interface PlayerTableEmbedProps {
  gameId: number;
  playerName: string;
}

export function PlayerTableEmbed({ gameId, playerName }: PlayerTableEmbedProps) {
  const { data: game } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => fetchGame(gameId),
  });
  const { hands } = useHandPolling({ gameId, currentHandIndex: -1 });
  const hand = hands.length > 0 ? hands[hands.length - 1] : null;

  const seat = useMemo<number | null>(() => {
    if (!game || !hand) return null;
    return resolveSeatMap(game, hand).get(playerName) ?? null;
  }, [game, hand, playerName]);

  const viewer = useMemo<ViewerContext>(
    () => (seat !== null ? { policy: 'player', seat } : { policy: 'player' }),
    [seat],
  );

  const tableState = useMemo(() => {
    if (!game || !hand) return null;
    return handsToTableState({ game, hand, viewer });
  }, [game, hand, viewer]);

  if (!tableState) return null;

  return (
    <div data-testid="player-table-embed" style={styles.wrap}>
      <div style={styles.zoom}>
        <PokerCanvas>
          <PokerTable
            state={tableState}
            viewer={viewer}
            equityOverlay={false}
            cameraPreset={seat !== null ? { kind: 'seat', seat } : 'default'}
          />
        </PokerCanvas>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  // The scene frames the whole room; zoom in so the table fills the width.
  zoom: {
    position: 'absolute',
    width: '145%',
    height: '145%',
    left: '-22.5%',
    top: '-22.5%',
  },
  wrap: {
    position: 'relative',
    width: '100%',
    height: 'clamp(200px, 30dvh, 300px)',
    margin: '0 0 0.5rem',
    overflow: 'hidden',
    // Fade the canvas into the page so the table floats on the background.
    WebkitMaskImage: 'radial-gradient(ellipse 72% 70% at 50% 50%, #000 55%, transparent 100%)',
    maskImage: 'radial-gradient(ellipse 72% 70% at 50% 50%, #000 55%, transparent 100%)',
  },
};
