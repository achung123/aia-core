import type React from 'react';

export const STREETS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'] as const;
export type Street = (typeof STREETS)[number];

export interface StreetHandData {
  turn?: string | null;
  river?: string | null;
  [key: string]: unknown;
}

export interface StreetScrubberProps {
  currentStreet: string;
  handData: StreetHandData;
  onStreetChange: (street: string) => void;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '6px 12px',
    background: '#0d0d1a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  button: {
    padding: '4px 10px',
    border: '1px solid #444',
    background: '#222',
    color: '#aaa',
    cursor: 'pointer',
    flex: 1,
  },
  buttonActive: {
    background: '#3a3a6e',
    color: '#fff',
    borderColor: '#6666cc',
  },
  buttonDisabled: {
    opacity: 0.35,
    cursor: 'default',
  },
};

function isDisabled(index: number, handData: StreetHandData): boolean {
  if (index === 2) return !handData.turn;
  if (index === 3) return !handData.river;
  return false;
}

export function StreetScrubber({ currentStreet, handData, onStreetChange }: StreetScrubberProps) {
  return (
    <div data-testid="street-scrubber" style={styles.wrapper}>
      {STREETS.map((name, i) => {
        const disabled = isDisabled(i, handData);
        const active = name === currentStreet;
        return (
          <button
            key={name}
            data-testid={`street-${name.toLowerCase().replace('-', '')}`}
            style={{
              ...styles.button,
              ...(active ? styles.buttonActive : {}),
              ...(disabled ? styles.buttonDisabled : {}),
            }}
            disabled={disabled}
            onClick={() => !disabled && onStreetChange(name)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
