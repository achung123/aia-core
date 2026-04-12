import { h } from 'preact';

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    background: '#1a1a2e',
    fontFamily: 'system-ui, sans-serif',
  },
  button: {
    minWidth: '48px',
    minHeight: '48px',
    padding: '8px 14px',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  buttonDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    color: '#e0e7ff',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
  },
};

export function SessionScrubber({ current, total, onchange }) {
  const hasPrev = current > 1;
  const hasNext = current < total;

  return (
    <div data-testid="session-scrubber" style={styles.wrapper}>
      <button
        data-testid="session-prev"
        style={{ ...styles.button, ...(hasPrev ? {} : styles.buttonDisabled) }}
        disabled={!hasPrev}
        onClick={() => hasPrev && onchange(current - 1)}
      >
        ◀
      </button>
      <span data-testid="session-label" style={styles.label}>
        Hand {current} / {total}
      </span>
      <button
        data-testid="session-next"
        style={{ ...styles.button, ...(hasNext ? {} : styles.buttonDisabled) }}
        disabled={!hasNext}
        onClick={() => hasNext && onchange(current + 1)}
      >
        ▶
      </button>
    </div>
  );
}
