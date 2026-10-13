import type React from 'react';

export const STREETS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'] as const;
export type Street = (typeof STREETS)[number];

export interface StreetHandData {
  flop?: unknown[] | null;
  turn?: unknown;
  river?: unknown;
  [key: string]: unknown;
}

export interface StreetScrubberProps {
  currentStreet: string;
  handData: StreetHandData;
  onStreetChange: (street: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 8px',
    background: '#0d0d1a',
    fontFamily: 'system-ui, sans-serif',
    overflowX: 'auto',
    // Never wider than the screen: let the buttons share the row instead
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  button: {
    minWidth: '48px',
    minHeight: '48px',
    padding: '6px 2px',
    border: '2px solid transparent',
    borderRadius: '8px',
    background: '#1e1b4b',
    color: '#c7d2fe',
    fontSize: 'clamp(9px, 2.5vw, 13px)',
    fontWeight: 600,
    cursor: 'pointer',
    flex: '1 1 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  buttonActive: {
    background: '#4f46e5',
    color: '#fff',
    border: '2px solid #818cf8',
  },
  buttonDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
};

function isStreetAvailable(streetIndex: number, handData: StreetHandData): boolean {
  if (streetIndex === 0) return true; // Pre-Flop always available
  if (streetIndex === 1) return !!(handData.flop && handData.flop.some(Boolean)); // Flop
  if (streetIndex === 2) return !!handData.turn; // Turn
  if (streetIndex === 3) return !!handData.river; // River
  if (streetIndex === 4) return true; // Showdown always available
  return false;
}

export function StreetScrubber({ currentStreet, handData, onStreetChange }: StreetScrubberProps): React.ReactElement {
  return (
    <div data-testid="street-scrubber" style={styles.wrapper}>
      {STREETS.map((name, i) => {
        const available = isStreetAvailable(i, handData || {});
        const active = name === currentStreet;
        return (
          <button
            key={name}
            data-testid={`street-${name.toLowerCase().replace('-', '')}`}
            style={{
              ...styles.button,
              ...(active ? styles.buttonActive : {}),
              ...(!available ? styles.buttonDisabled : {}),
            }}
            disabled={!available}
            onClick={() => available && onStreetChange(name)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
