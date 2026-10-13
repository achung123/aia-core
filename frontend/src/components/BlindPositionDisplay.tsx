import { useState } from 'react';
import type { CSSProperties } from 'react';
import { fetchBlinds } from '../api/client.ts';
import { usePolling } from '../hooks/usePolling.ts';

export interface BlindPositionDisplayProps {
  gameId: number;
  currentPlayerName: string;
  sbPlayerName: string | null;
  bbPlayerName: string | null;
}

const POLL_INTERVAL_MS = 10_000;

export function BlindPositionDisplay({
  gameId,
  currentPlayerName,
  sbPlayerName,
  bbPlayerName,
}: BlindPositionDisplayProps) {
  const [blinds, setBlinds] = useState<{ small_blind: number; big_blind: number } | null>(null);

  usePolling({
    intervalMs: POLL_INTERVAL_MS,
    fetchFn: (signal) =>
      fetchBlinds(gameId)
        .then(data => {
          if (!signal.aborted) {
            setBlinds({ small_blind: data.small_blind, big_blind: data.big_blind });
          }
        }),
  });

  const isSb = currentPlayerName === sbPlayerName;
  const isBb = currentPlayerName === bbPlayerName;

  return (
    <div data-testid="blind-position-display" style={styles.container}>
      <span data-testid="blind-level" style={styles.blindLevel}>
        {blinds
          ? `Blinds: $${blinds.small_blind.toFixed(2)} / $${blinds.big_blind.toFixed(2)}`
          : 'Blinds: –'}
      </span>
      <span style={styles.positions}>
        {sbPlayerName && (
          <span
            data-testid="sb-label"
            data-highlight={isSb ? 'true' : 'false'}
            style={isSb ? styles.highlightLabel : styles.posLabel}
          >
            SB: {sbPlayerName}
          </span>
        )}
        {sbPlayerName && bbPlayerName && <span style={styles.separator}> | </span>}
        {bbPlayerName && (
          <span
            data-testid="bb-label"
            data-highlight={isBb ? 'true' : 'false'}
            style={isBb ? styles.highlightLabel : styles.posLabel}
          >
            BB: {bbPlayerName}
          </span>
        )}
      </span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    padding: '6px 12px',
    background: 'rgba(0, 0, 0, 0.6)',
    borderRadius: '8px',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto',
  },
  blindLevel: {
    color: '#fbbf24',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  positions: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8rem',
  },
  posLabel: {
    color: '#d1d5db',
    fontWeight: 'normal',
  },
  highlightLabel: {
    color: '#34d399',
    fontWeight: 'bold',
    textShadow: '0 0 6px rgba(52,211,153,0.5)',
  },
  separator: {
    color: '#6b7280',
  },
};
