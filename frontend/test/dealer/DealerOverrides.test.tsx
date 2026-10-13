/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../src/api/client.ts', () => ({
  recordPlayerAction: vi.fn(() => Promise.resolve({})),
  undoLastAction: vi.fn(() => Promise.resolve({})),
  setCurrentPlayer: vi.fn(() => Promise.resolve({})),
  setPlayerChips: vi.fn(() => Promise.resolve({})),
}));

import { recordPlayerAction, undoLastAction, setCurrentPlayer, setPlayerChips } from '../../src/api/client.ts';
import { DealerOverrides } from '../../src/dealer/DealerOverrides.tsx';
import type { DealerOverridesProps } from '../../src/dealer/DealerOverrides.tsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeProps(overrides: Partial<DealerOverridesProps> = {}): DealerOverridesProps {
  return {
    gameId: 7,
    handNumber: 2,
    playerNames: ['Alice', 'Bob', 'Charlie'],
    playerChips: { Alice: 99.9, Bob: 99.8, Charlie: 100 },
    currentPlayerName: 'Charlie',
    communityCardCount: 0,
    legalActions: ['fold', 'call', 'raise'],
    amountToCall: 0.2,
    minimumBet: null,
    minimumRaise: 0.4,
    pot: 0.3,
    handPhase: 'preflop',
    actionIndex: 3,
    onChanged: vi.fn(),
    ...overrides,
  };
}

function open() {
  fireEvent.click(screen.getByTestId('dealer-overrides-toggle'));
}

describe('DealerOverrides', () => {
  it('is collapsed until the dealer opens it', () => {
    render(<DealerOverrides {...makeProps()} />);
    expect(screen.queryByTestId('dealer-undo')).toBeNull();
    open();
    expect(screen.getByTestId('dealer-undo')).toBeDefined();
  });

  it('lets the dealer act for the player whose turn it is', async () => {
    const onChanged = vi.fn();
    render(<DealerOverrides {...makeProps({ onChanged })} />);
    open();
    expect(screen.getByText('Act for Charlie')).toBeDefined();

    fireEvent.click(screen.getByTestId('action-call'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(recordPlayerAction).toHaveBeenCalledWith(7, 2, 'Charlie', {
      street: 'preflop',
      action: 'call',
      amount: 0.2,
      expected_action_index: 3,
    });
  });

  it('undoes the last action and refreshes', async () => {
    const onChanged = vi.fn();
    render(<DealerOverrides {...makeProps({ onChanged })} />);
    open();
    fireEvent.click(screen.getByTestId('dealer-undo'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(undoLastAction).toHaveBeenCalledWith(7, 2);
  });

  it('cannot undo when only the blinds have been posted', () => {
    render(<DealerOverrides {...makeProps({ actionIndex: 0 })} />);
    open();
    expect((screen.getByTestId('dealer-undo') as HTMLButtonElement).disabled).toBe(true);
  });

  it('can still undo the fold that ended the hand', () => {
    render(<DealerOverrides {...makeProps({ handPhase: 'showdown', currentPlayerName: null })} />);
    open();
    expect((screen.getByTestId('dealer-undo') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('dealer-give-turn')).toBeNull();
  });

  it('hands the turn to another player', async () => {
    render(<DealerOverrides {...makeProps()} />);
    open();
    const select = screen.getByTestId('dealer-give-turn') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['', 'Alice', 'Bob']);
    fireEvent.change(select, { target: { value: 'Alice' } });
    await waitFor(() => expect(setCurrentPlayer).toHaveBeenCalledWith(7, 2, 'Alice'));
  });

  it('corrects a stack with a reason', async () => {
    render(<DealerOverrides {...makeProps()} />);
    open();
    fireEvent.change(screen.getByTestId('dealer-stack-player'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByTestId('dealer-stack-amount'), { target: { value: '80' } });
    fireEvent.change(screen.getByTestId('dealer-stack-reason'), { target: { value: 'miscount' } });
    fireEvent.click(screen.getByTestId('dealer-stack-save'));
    await waitFor(() =>
      expect(setPlayerChips).toHaveBeenCalledWith(7, 'Bob', { current_chips: 80, reason: 'miscount' }),
    );
  });

  it('does not send a stack correction without a player and amount', () => {
    render(<DealerOverrides {...makeProps()} />);
    open();
    fireEvent.click(screen.getByTestId('dealer-stack-save'));
    expect(setPlayerChips).not.toHaveBeenCalled();
    expect(screen.getByTestId('dealer-overrides-error').textContent).toMatch(/Pick a player/);
  });

  it('shows the server message when an override is refused', async () => {
    (undoLastAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('There is no action to undo'));
    render(<DealerOverrides {...makeProps()} />);
    open();
    fireEvent.click(screen.getByTestId('dealer-undo'));
    await waitFor(() => expect(screen.getByTestId('dealer-overrides-error').textContent).toBe('There is no action to undo'));
  });
});
