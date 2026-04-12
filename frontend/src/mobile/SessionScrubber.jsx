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
  rangeWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  range: {
    width: '100%',
  },
  label: {
    color: '#e0e7ff',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
  },
};

const thumbCss = `
  .session-range-mobile::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #4f46e5;
    cursor: pointer;
  }
  .session-range-mobile::-moz-range-thumb {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #4f46e5;
    cursor: pointer;
    border: none;
  }
`;

export function SessionScrubber({ current, total, onchange }) {
  const hasPrev = current > 1;
  const hasNext = current < total;

  return (
    <div data-testid="session-scrubber" style={styles.wrapper}>
      <style>{thumbCss}</style>
      <button
        data-testid="session-prev"
        style={{ ...styles.button, ...(hasPrev ? {} : styles.buttonDisabled) }}
        disabled={!hasPrev}
        onClick={() => hasPrev && onchange(current - 1)}
      >
        ◀
      </button>
      <div style={styles.rangeWrapper}>
        <input
          data-testid="session-slider"
          className="session-range-mobile"
          type="range"
          min={1}
          max={total}
          step={1}
          value={current}
          style={styles.range}
          onInput={(e) => onchange(parseInt(e.target.value, 10))}
        />
        <span data-testid="session-label" style={styles.label}>
          Hand {current} / {total}
        </span>
      </div>
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
