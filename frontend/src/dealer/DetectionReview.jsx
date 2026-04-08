import { useState } from 'preact/hooks';
import { CardPicker } from './CardPicker.jsx';

const SUIT_MAP = { h: '♥', s: '♠', d: '♦', c: '♣' };
const SUIT_COLORS = { '♥': '#dc2626', '♠': '#1e293b', '♦': '#dc2626', '♣': '#1e293b' };

function formatCard(detectedValue) {
  const suit = detectedValue.slice(-1).toLowerCase();
  const rank = detectedValue.slice(0, -1).toUpperCase();
  const symbol = SUIT_MAP[suit] || suit;
  return { rank, suit: symbol };
}

export function DetectionReview({ detections, imageUrl, mode, targetName, onConfirm, onRetake }) {
  const cards = detections || [];
  const expectedMin = mode === 'community' ? 3 : 2;
  const expectedMax = mode === 'community' ? 5 : 2;
  const countOk = cards.length >= expectedMin && cards.length <= expectedMax;

  const [corrections, setCorrections] = useState({});
  const [pickerIndex, setPickerIndex] = useState(null);

  function getCorrectedValue(index) {
    return corrections[index] || cards[index]?.detected_value;
  }

  function handlePickerSelect(cardCode) {
    setCorrections((prev) => ({ ...prev, [pickerIndex]: cardCode }));
    setPickerIndex(null);
  }

  function handleConfirm() {
    const cardValues = cards.map((d, i) => corrections[i] || d.detected_value);
    onConfirm(targetName, cardValues);
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Review Detection</h2>
      <p style={styles.target}>{mode === 'community' ? 'Community Cards' : targetName}</p>

      {imageUrl && <img src={imageUrl} alt="Captured" style={styles.image} />}

      {!countOk && (
        <p style={styles.warning}>
          Expected {mode === 'community' ? '3–5' : '2'} cards, detected {cards.length}
        </p>
      )}

      <div style={styles.cardRow}>
        {cards.map((d, i) => {
          const value = getCorrectedValue(i);
          const { rank, suit } = formatCard(value);
          const conf = Math.round(d.confidence * 100);
          const color = SUIT_COLORS[suit] || '#1e293b';
          const isCorrected = i in corrections;
          const labelStyle = isCorrected
            ? { ...styles.cardLabel, borderColor: '#ea580c' }
            : styles.cardLabel;
          return (
            <div key={i} style={labelStyle} onClick={() => setPickerIndex(i)}>
              <span style={{ ...styles.cardText, color }}>{rank}{suit}</span>
              <span style={styles.confidence}>{isCorrected ? 'corrected' : `${conf}%`}</span>
            </div>
          );
        })}
      </div>

      {pickerIndex !== null && (
        <CardPicker
          onSelect={handlePickerSelect}
          onClose={() => setPickerIndex(null)}
        />
      )}

      <div style={styles.buttonRow}>
        <button style={styles.retakeButton} onClick={onRetake}>Retake</button>
        <button
          style={cards.length === 0 ? { ...styles.confirmButton, opacity: 0.5 } : styles.confirmButton}
          onClick={handleConfirm}
          disabled={cards.length === 0}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.25rem',
  },
  target: {
    fontSize: '1rem',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  image: {
    width: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    marginBottom: '1rem',
  },
  warning: {
    color: '#d97706',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    marginBottom: '0.75rem',
  },
  cardRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    justifyContent: 'center',
    marginBottom: '1.5rem',
  },
  cardLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    border: '2px solid #c7d2fe',
    borderRadius: '10px',
    background: '#f8fafc',
    minWidth: '64px',
    minHeight: '48px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  cardText: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  confidence: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  retakeButton: {
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
  confirmButton: {
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
};
