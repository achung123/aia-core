import type React from 'react';

interface Suit {
  code: string;
  symbol: string;
  color: string;
}

const SUITS: Suit[] = [
  { code: 's', symbol: '♠', color: '#1e293b' },
  { code: 'h', symbol: '♥', color: '#dc2626' },
  { code: 'd', symbol: '♦', color: '#dc2626' },
  { code: 'c', symbol: '♣', color: '#1e293b' },
];

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export interface CardPickerProps {
  onSelect: (cardCode: string) => void;
  onClose: () => void;
}

export function CardPicker({ onSelect, onClose }: CardPickerProps) {
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        <h3 style={styles.title}>Select Card</h3>
        {SUITS.map((suit) => (
          <div key={suit.code} style={styles.suitRow}>
            {RANKS.map((rank) => {
              const code = rank + suit.code;
              return (
                <button
                  key={code}
                  style={{ ...styles.cardButton, color: suit.color }}
                  onClick={() => onSelect(code)}
                >
                  {rank}{suit.symbol}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1rem',
    maxWidth: '95vw',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  title: {
    fontSize: '1.1rem',
    marginBottom: '0.75rem',
    textAlign: 'center',
  },
  suitRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    marginBottom: '0.5rem',
    justifyContent: 'center',
  },
  cardButton: {
    minWidth: '48px',
    minHeight: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#f8fafc',
    cursor: 'pointer',
    padding: '0.35rem 0.5rem',
    WebkitTapHighlightColor: 'transparent',
  },
};
