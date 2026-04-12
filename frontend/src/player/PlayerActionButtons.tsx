import { useState, useEffect } from 'react';
import type React from 'react';
import { recordPlayerAction } from '../api/client.ts';
import { ChipPicker } from '../dealer/ChipPicker.tsx';
import type { StreetEnum, ActionEnum } from '../api/types.ts';

export interface PlayerActionButtonsProps {
  gameId: number;
  handNumber: number;
  playerName: string;
  communityCardCount: number;
}

export function getStreet(communityCardCount: number): StreetEnum {
  switch (communityCardCount) {
    case 3: return 'flop';
    case 4: return 'turn';
    case 5: return 'river';
    default: return 'preflop';
  }
}

export function PlayerActionButtons({ gameId, handNumber, playerName, communityCardCount }: PlayerActionButtonsProps) {
  const [hasActed, setHasActed] = useState(false);
  const [chipAction, setChipAction] = useState<'bet' | 'raise' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasActed(false);
  }, [communityCardCount]);

  const street = getStreet(communityCardCount);

  async function handleAction(action: ActionEnum, amount?: number) {
    setError(null);
    try {
      await recordPlayerAction(gameId, handNumber, playerName, {
        street,
        action,
        amount: amount ?? null,
      });
      setHasActed(true);
      setChipAction(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      setChipAction(null);
    }
  }

  if (chipAction) {
    return (
      <div data-testid="action-buttons">
        <ChipPicker
          onConfirm={(amount) => handleAction(chipAction, amount)}
          onCancel={() => setChipAction(null)}
        />
      </div>
    );
  }

  return (
    <div data-testid="action-buttons">
      {error && <p data-testid="action-error" style={{ color: '#dc2626' }}>{error}</p>}
      <div style={styles.buttonRow}>
        <button
          data-testid="action-fold"
          disabled={hasActed}
          onClick={() => handleAction('fold')}
          style={{ ...styles.button, ...styles.foldBtn }}
        >
          Fold
        </button>
        <button
          data-testid="action-check"
          disabled={hasActed}
          onClick={() => handleAction('check')}
          style={styles.button}
        >
          Check
        </button>
        <button
          data-testid="action-call"
          disabled={hasActed}
          onClick={() => handleAction('call')}
          style={styles.button}
        >
          Call
        </button>
        <button
          data-testid="action-bet"
          disabled={hasActed}
          onClick={() => setChipAction('bet')}
          style={{ ...styles.button, ...styles.betBtn }}
        >
          Bet
        </button>
        <button
          data-testid="action-raise"
          disabled={hasActed}
          onClick={() => setChipAction('raise')}
          style={{ ...styles.button, ...styles.raiseBtn }}
        >
          Raise
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  buttonRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    justifyContent: 'center',
    marginTop: '0.75rem',
  },
  button: {
    minHeight: '48px',
    minWidth: '48px',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: '#ffffff',
    backgroundColor: '#4b5563',
    WebkitTapHighlightColor: 'transparent',
  },
  foldBtn: {
    backgroundColor: '#dc2626',
  },
  betBtn: {
    backgroundColor: '#2563eb',
  },
  raiseBtn: {
    backgroundColor: '#7c3aed',
  },
};
