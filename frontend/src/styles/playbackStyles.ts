import type { CSSProperties } from 'react';
import { theme } from '../theme';

export const gameSelectorStyles: Record<string, CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.75rem',
    color: theme.text,
  },
  loading: {
    textAlign: 'center',
    color: theme.faint,
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#dc2626',
    padding: '1rem 0',
  },
  empty: {
    textAlign: 'center',
    color: theme.muted,
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
    borderRadius: 8,
    border: '2px solid',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'none',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  cardActive: {
    borderColor: theme.accent,
    background: theme.accentTint,
    color: theme.accentSoft,
  },
  cardComplete: {
    borderColor: theme.border,
    background: theme.surface,
    color: theme.muted,
  },
  cardDisabled: {
    cursor: 'not-allowed',
    opacity: 0.58,
  },
  cardDate: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  gameId: {
    fontWeight: 'normal',
    fontSize: '0.85rem',
    color: theme.faint,
  },
  cardDetails: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  cardAction: {
    fontSize: '0.9rem',
    fontWeight: 700,
  },
  winnersRow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#4ade80',
  },
};

export const playbackLayoutStyles: Record<string, CSSProperties> = {
  // `100dvh` (dynamic viewport) is the iOS Safari fix for `100vh`
  // mis-reporting when the URL bar is shown. We keep `100vh` as a
  // fallback for older browsers via the `minHeight` shorthand.
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: '100%',
    height: '100vh',
    minHeight: '100dvh',
    overflow: 'hidden',
  },
  // `minHeight: 0` is required so the flex child can actually shrink
  // below its content's intrinsic height — without it, R3F's `<Canvas>`
  // measures its parent at 0×0 on iOS Safari and the WebGL drawing
  // buffer never gets a paintable area (mounted-but-blank symptom).
  canvasArea: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' },
  canvas: { display: 'block', width: '100%', height: '100%' },
  statusShell: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '72px 24px 24px',
    textAlign: 'center',
    background: theme.bg,
    color: theme.text,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.text,
  },
  statusDetail: {
    maxWidth: 360,
    color: theme.muted,
    fontSize: 14,
    lineHeight: 1.4,
  },
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
    background: theme.accent,
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
    background: theme.surface,
    overflowX: 'auto',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    minWidth: 80,
    padding: '8px 12px',
    borderRadius: 8,
    background: theme.accentSurface,
    border: `1px solid ${theme.accentSurfaceStrong}`,
    textAlign: 'center',
    flexShrink: 0,
  },
  name: {
    color: theme.accentSoft,
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
