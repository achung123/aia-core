import type { CSSProperties } from 'react';
import { useGameConnection } from '../hooks/useGameConnection.ts';

export interface ConnectionNoticeProps {
  gameId: number | null | undefined;
}

/**
 * A small, quiet notice while the live connection is down. It says what the
 * viewer needs to know — the picture may lag — and disappears by itself.
 */
export function ConnectionNotice({ gameId }: ConnectionNoticeProps) {
  const state = useGameConnection(gameId);
  if (state !== 'reconnecting') return null;
  return (
    <div role="status" aria-live="polite" data-testid="connection-notice" style={style}>
      <span aria-hidden style={dot} /> Reconnecting… showing the latest update
    </div>
  );
}

const style: CSSProperties = {
  position: 'absolute',
  top: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 20,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(66, 32, 6, 0.92)',
  border: '1px solid #a16207',
  color: '#fde68a',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

const dot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#f59e0b',
};
