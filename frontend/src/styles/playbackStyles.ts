import type { CSSProperties } from 'react';

export const gameSelectorStyles: Record<string, CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.75rem',
    color: '#e2e8f0',
  },
  loading: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#dc2626',
    padding: '1rem 0',
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '2rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '1rem',
    borderRadius: 12,
    border: '2px solid',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'none',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  cardActive: {
    borderColor: '#6366f1',
    background: 'rgba(99, 102, 241, 0.12)',
    color: '#c7d2fe',
  },
  cardComplete: {
    borderColor: '#2e303a',
    background: '#1e1f2b',
    color: '#94a3b8',
  },
  cardDate: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  gameId: {
    fontWeight: 'normal',
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  cardDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  winnersRow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#4ade80',
  },
};

export const playbackLayoutStyles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  canvas: { display: 'block', width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 15,
    minWidth: 48,
    minHeight: 48,
    padding: '8px 14px',
    border: 'none',
    borderRadius: 8,
    background: '#4f46e5',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  scrubberMount: { zIndex: 5, flexShrink: 0 },
};

export const equityRowStyles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    background: '#1a1a2e',
    overflowX: 'auto',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    minWidth: 80,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#1e1b4b',
    border: '1px solid #312e81',
    textAlign: 'center',
    flexShrink: 0,
  },
  name: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  equity: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
  },
};
