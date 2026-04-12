import { h } from 'preact';

const STREETS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'];

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 8px',
    background: '#0d0d1a',
    fontFamily: 'system-ui, sans-serif',
    overflowX: 'auto',
  },
  button: {
    minWidth: '48px',
    minHeight: '48px',
    padding: '6px 10px',
    border: '2px solid transparent',
    borderRadius: '8px',
    background: '#1e1b4b',
    color: '#c7d2fe',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    flex: 1,
    whiteSpace: 'nowrap',
    fontFamily: 'system-ui, sans-serif',
  },
  buttonActive: {
    background: '#4f46e5',
    color: '#fff',
    borderColor: '#818cf8',
  },
  buttonDisabled: {
    opacity: 0.3,
    cursor: 'default',
  },
};

function isStreetAvailable(streetIndex, handData) {
  if (streetIndex === 0) return true; // Pre-Flop always available
  if (streetIndex === 1) return !!(handData.flop && handData.flop.some(Boolean)); // Flop
  if (streetIndex === 2) return !!handData.turn; // Turn
  if (streetIndex === 3) return !!handData.river; // River
  if (streetIndex === 4) return true; // Showdown always available
  return false;
}

export { STREETS };

export function StreetScrubber({ currentStreet, handData, onStreetChange }) {
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
