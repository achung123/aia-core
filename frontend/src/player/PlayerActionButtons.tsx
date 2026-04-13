import { useState } from 'react';
import type React from 'react';
import { recordPlayerAction } from '../api/client.ts';
import { ChipPicker } from '../dealer/ChipPicker.tsx';
import type { StreetEnum, ActionEnum } from '../api/types.ts';

export interface PlayerActionButtonsProps {
  gameId: number;
  handNumber: number;
  playerName: string;
  communityCardCount: number;
  legalActions?: string[];
  amountToCall?: number;
  pot?: number;
}

export function getStreet(communityCardCount: number): StreetEnum {
  switch (communityCardCount) {
    case 3: return 'flop';
    case 4: return 'turn';
    case 5: return 'river';
    default: return 'preflop';
  }
}

export function PlayerActionButtons({
  gameId, handNumber, playerName, communityCardCount,
  legalActions = [], amountToCall = 0, pot = 0,
}: PlayerActionButtonsProps) {
  const [actedOnCount, setActedOnCount] = useState(-1);
  const hasActed = actedOnCount === communityCardCount;
  const [chipAction, setChipAction] = useState<'bet' | 'raise' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const street = getStreet(communityCardCount);
  const actions = legalActions.length > 0 ? legalActions : ['fold', 'check', 'call', 'bet', 'raise'];

  async function handleAction(action: ActionEnum, amount?: number) {
    setError(null);
    try {
      await recordPlayerAction(gameId, handNumber, playerName, {
        street,
        action,
        amount: amount ?? null,
      });
      setActedOnCount(communityCardCount);
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
      <div data-testid="betting-info" style={styles.bettingInfo}>
        <span style={styles.potLabel}>Pot: ${pot.toFixed(2)}</span>
        {amountToCall > 0 && (
          <span style={styles.callLabel}>${amountToCall.toFixed(2)} to call</span>
        )}
        {amountToCall > 0 && (
          <span data-testid="pot-odds" style={styles.oddsLabel}>
            Odds: {((pot / amountToCall) + 1).toFixed(1)}:1
          </span>
        )}
      </div>
      <div style={styles.buttonRow}>
        {actions.includes('fold') && (
          <button
            data-testid="action-fold"
            disabled={hasActed}
            onClick={() => handleAction('fold')}
            style={{ ...styles.button, ...styles.foldBtn }}
          >
            Fold
          </button>
        )}
        {actions.includes('check') && (
          <button
            data-testid="action-check"
            disabled={hasActed}
            onClick={() => handleAction('check')}
            style={styles.button}
          >
            Check
          </button>
        )}
        {actions.includes('call') && (
          <button
            data-testid="action-call"
            disabled={hasActed}
            onClick={() => handleAction('call', amountToCall || undefined)}
            style={styles.button}
          >
            Call{amountToCall > 0 ? ` $${amountToCall.toFixed(2)}` : ''}
          </button>
        )}
        {actions.includes('bet') && (
          <button
            data-testid="action-bet"
            disabled={hasActed}
            onClick={() => setChipAction('bet')}
            style={{ ...styles.button, ...styles.betBtn }}
          >
            Bet
          </button>
        )}
        {actions.includes('raise') && (
          <button
            data-testid="action-raise"
            disabled={hasActed}
            onClick={() => setChipAction('raise')}
            style={{ ...styles.button, ...styles.raiseBtn }}
          >
            Raise
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bettingInfo: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '0.5rem',
    fontSize: '0.95rem',
    color: '#e2e8f0',
  },
  potLabel: {
    fontWeight: 'bold',
    color: '#4ade80',
  },
  callLabel: {
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  oddsLabel: {
    fontWeight: 'bold',
    color: '#60a5fa',
  },
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
