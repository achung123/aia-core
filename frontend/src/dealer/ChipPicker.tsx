import { useState } from 'react';
import type React from 'react';

export interface ChipPickerProps {
  onConfirm: (amount: number) => void;
  onCancel?: () => void;
  onAllIn?: () => void;
}

interface ChipDef {
  value: number;
  label: string;
  bg: string;
  color: string;
}

const CHIPS: ChipDef[] = [
  { value: 0.10, label: '$0.10', bg: '#ffffff', color: '#111827' },
  { value: 0.20, label: '$0.20', bg: '#dc2626', color: '#ffffff' },
  { value: 0.30, label: '$0.30', bg: '#16a34a', color: '#ffffff' },
  { value: 0.40, label: '$0.40', bg: '#2563eb', color: '#ffffff' },
  { value: 0.50, label: '$0.50', bg: '#1a1a2e', color: '#ffffff' },
  { value: 1.00, label: '$1.00', bg: '#f97316', color: '#ffffff' },
  { value: 2.00, label: '$2.00', bg: '#38bdf8', color: '#111827' },
  { value: 3.00, label: '$3.00', bg: '#facc15', color: '#111827' },
];

export function ChipPicker({ onConfirm, onCancel, onAllIn }: ChipPickerProps) {
  const [total, setTotal] = useState(0);

  function handleChipTap(value: number): void {
    setTotal((prev) => Math.round((prev + value) * 100) / 100);
  }

  function handleClear(): void {
    setTotal(0);
  }

  function handleConfirm(): void {
    onConfirm(total);
  }

  return (
    <div style={styles.container}>
      <div data-testid="chip-total" style={styles.total}>
        ${total.toFixed(2)}
      </div>

      <div style={styles.chipRow}>
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            data-testid={`chip-${chip.value.toFixed(2)}`}
            style={{
              ...styles.chip,
              backgroundColor: chip.bg,
              color: chip.color,
            }}
            onClick={() => handleChipTap(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div style={styles.actionRow}>
        <button
          data-testid="chip-clear"
          style={styles.clearButton}
          onClick={handleClear}
        >
          Clear
        </button>
        <button
          data-testid="chip-confirm"
          style={styles.confirmButton}
          onClick={handleConfirm}
        >
          Bet
        </button>
        {onAllIn && (
          <button
            data-testid="chip-all-in"
            style={styles.allInButton}
            onClick={onAllIn}
          >
            All In
          </button>
        )}
      </div>

      {onCancel && (
        <button
          data-testid="chip-cancel"
          style={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
    textAlign: 'center',
  },
  total: {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#e2e8f0',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  chip: {
    minWidth: '56px',
    minHeight: '56px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    border: '3px solid #a0a0a0',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  actionRow: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  clearButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    background: '#1e1f2b',
    border: '1px solid #2e303a',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#e2e8f0',
    minHeight: '48px',
  },
  confirmButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    background: '#16a34a',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#ffffff',
    minHeight: '48px',
  },
  allInButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    background: '#dc2626',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#ffffff',
    minHeight: '48px',
  },
  cancelButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#1e1f2b',
    border: '1px solid #2e303a',
    borderRadius: '12px',
    cursor: 'pointer',
    color: '#e2e8f0',
  },
};
