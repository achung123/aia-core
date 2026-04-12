import type React from 'react';

export interface SessionScrubberProps {
  handCount: number;
  currentHand: number;
  onChange: (handIndex: number) => void;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '8px 12px',
    background: '#111',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  button: {
    background: 'none',
    border: '1px solid #555',
    color: '#fff',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  rangeWrapper: {
    flex: 1,
    position: 'relative',
  },
  svg: {
    display: 'block',
    marginBottom: '2px',
  },
  range: {
    width: '100%',
  },
  label: {
    color: '#ccc',
    fontSize: '13px',
    minWidth: '72px',
    textAlign: 'right',
  },
};

export function SessionScrubber({ handCount, currentHand, onChange }: SessionScrubberProps) {
  const hasPrev = currentHand > 1;
  const hasNext = currentHand < handCount;

  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < handCount; i++) {
    const pct = handCount > 1 ? (i / (handCount - 1)) * 100 : 0;
    ticks.push(
      <line
        key={i}
        x1={`${pct}%`}
        y1="0"
        x2={`${pct}%`}
        y2="10"
        stroke="#555"
        strokeWidth="1"
      />,
    );
  }

  return (
    <div data-testid="session-scrubber" style={styles.wrapper}>
      <button
        data-testid="session-prev"
        style={styles.button}
        disabled={!hasPrev}
        onClick={() => hasPrev && onChange(currentHand - 1)}
      >
        ◀
      </button>
      <div style={styles.rangeWrapper}>
        <svg width="100%" height="12" style={styles.svg}>
          {ticks}
        </svg>
        <input
          type="range"
          min={1}
          max={handCount}
          step={1}
          value={currentHand}
          style={styles.range}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
        />
      </div>
      <span data-testid="session-label" style={styles.label}>
        Hand {currentHand} / {handCount}
      </span>
      <button
        data-testid="session-next"
        style={styles.button}
        disabled={!hasNext}
        onClick={() => hasNext && onChange(currentHand + 1)}
      >
        ▶
      </button>
    </div>
  );
}
