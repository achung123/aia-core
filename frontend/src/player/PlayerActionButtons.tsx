import { useState } from 'react';
import type React from 'react';
import { recordPlayerAction } from '../api/client.ts';
import { ChipPicker } from '../dealer/ChipPicker.tsx';
import type { StreetEnum, ActionEnum } from '../api/types';

export interface PlayerActionButtonsProps {
  gameId: number;
  handNumber: number;
  playerName: string;
  communityCardCount: number;
  legalActions?: string[];
  amountToCall?: number;
  minimumBet?: number | null;
  minimumRaise?: number | null;
  pot?: number;
  currentStack?: number | null;
  onActionConfirmed?: () => void;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
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
  legalActions = [], amountToCall = 0, minimumBet = null, minimumRaise = null, pot = 0,
  currentStack = null,
  onActionConfirmed,
}: PlayerActionButtonsProps) {
  const [actedOnCount, setActedOnCount] = useState(-1);
  const hasActed = actedOnCount === communityCardCount;
  const [chipAction, setChipAction] = useState<'bet' | 'raise' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const street = getStreet(communityCardCount);
  const actions = legalActions.length > 0 ? legalActions : ['fold', 'check', 'call', 'bet', 'raise'];

  async function handleAction(action: ActionEnum, amount?: number, isAllIn?: boolean) {
    setError(null);
    if (
      !isAllIn
      && action === 'bet'
      && minimumBet !== null
      && amount !== undefined
      && amount < minimumBet
    ) {
      setError(`Minimum bet is ${formatCurrency(minimumBet)}`);
      setChipAction(null);
      return;
    }
    if (
      !isAllIn
      && action === 'raise'
      && minimumRaise !== null
      && amount !== undefined
      && amount < minimumRaise
    ) {
      setError(`Minimum raise is ${formatCurrency(minimumRaise)}`);
      setChipAction(null);
      return;
    }
    try {
      await recordPlayerAction(gameId, handNumber, playerName, {
        street,
        action,
        amount: amount ?? null,
        ...(isAllIn ? { is_all_in: true } : {}),
      });
      setActedOnCount(communityCardCount);
      setChipAction(null);
      onActionConfirmed?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setError(message);
      setChipAction(null);
    }
  }

  const callIsAllIn = currentStack != null && currentStack > 0 && amountToCall > currentStack;

  if (chipAction) {
    return (
      <div data-testid="action-buttons">
        <ChipPicker
          onConfirm={(amount) => handleAction(chipAction, amount)}
          onCancel={() => setChipAction(null)}
          onAllIn={() => handleAction(chipAction, undefined, true)}
          maxAmount={currentStack != null && currentStack > 0 ? currentStack : undefined}
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
        {actions.includes('bet') && minimumBet !== null && (
          <span data-testid="minimum-bet" style={styles.minimumLabel}>
            Min bet {formatCurrency(minimumBet)}
          </span>
        )}
        {actions.includes('raise') && minimumRaise !== null && (
          <span data-testid="minimum-raise" style={styles.minimumLabel}>
            Min raise {formatCurrency(minimumRaise)}
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
            onClick={() => callIsAllIn
              ? handleAction('call', currentStack!, true)
              : handleAction('call', amountToCall || undefined)
            }
            style={styles.button}
          >
            {callIsAllIn
              ? `Call All-In $${currentStack!.toFixed(2)}`
              : `Call${amountToCall > 0 ? ` $${amountToCall.toFixed(2)}` : ''}`
            }
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
  minimumLabel: {
    fontWeight: 'bold',
    color: '#93c5fd',
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
