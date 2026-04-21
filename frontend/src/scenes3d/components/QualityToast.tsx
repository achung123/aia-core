// T-028 — Quality-change toast surface.
//
// DOM-side companion to `useFPSMonitor`. Reads the `tierToast` slice from
// `tableStore` (populated only on real tier changes by the auto-degrade
// hook) and renders a minimal, dismissible inline notice. Renders nothing
// when `tierToast === null`, so consumers can mount it unconditionally next
// to `<PokerCanvas>` without layout impact during normal playback.
//
// Copy is the canonical "Quality adjusted for smoother playback" string
// (T-028 AC-3) sourced from the store, not hard-coded here — keeps the
// hook as single source of truth for the message.

import type { CSSProperties } from 'react';

import { useTableStore } from '../state/tableStore';

const toastStyle: CSSProperties = {
  position: 'fixed',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderRadius: 8,
  background: 'rgba(30, 30, 34, 0.92)',
  color: '#fff',
  font: '14px system-ui, -apple-system, sans-serif',
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
  pointerEvents: 'auto',
};

// T-029 AC-2 — 44×44pt minimum tap target (iOS HIG / Material).
const MIN_TAP_TARGET_PX = 44;

const buttonStyle: CSSProperties = {
  all: 'unset',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  padding: '0 12px',
  borderRadius: 4,
  color: '#9ecbff',
  fontWeight: 600,
};

export interface QualityToastProps {
  /** Optional className forwarded to the root div. */
  className?: string;
}

/**
 * Displays the auto-degrade notification emitted by `useFPSMonitor`. The
 * toast is dismissible via a button that calls `dismissTierToast()`.
 */
export function QualityToast({ className }: QualityToastProps = {}) {
  const tierToast = useTableStore((s) => s.tierToast);
  const dismiss = useTableStore((s) => s.dismissTierToast);

  if (tierToast === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={className}
      style={toastStyle}
    >
      <span>{tierToast}</span>
      <button
        type="button"
        aria-label="Dismiss quality notification"
        style={buttonStyle}
        onClick={dismiss}
      >
        Dismiss
      </button>
    </div>
  );
}

export default QualityToast;
