/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { act } from 'react';
import { PlayerActionButtons, getStreet } from './PlayerActionButtons.tsx';

vi.mock('../api/client.ts', () => ({
  recordPlayerAction: vi.fn(),
}));

import { recordPlayerAction } from '../api/client.ts';

const mockRecordPlayerAction = recordPlayerAction as ReturnType<typeof vi.fn>;

const defaultProps = {
  gameId: 1,
  handNumber: 2,
  playerName: 'Alice',
  communityCardCount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRecordPlayerAction.mockResolvedValue({
    action_id: 1,
    player_hand_id: 1,
    street: 'preflop',
    action: 'fold',
    amount: null,
    created_at: '2026-04-12T00:00:00Z',
  });
});

afterEach(cleanup);

describe('getStreet', () => {
  it('returns preflop for 0 community cards', () => {
    expect(getStreet(0)).toBe('preflop');
  });

  it('returns flop for 3 community cards', () => {
    expect(getStreet(3)).toBe('flop');
  });

  it('returns turn for 4 community cards', () => {
    expect(getStreet(4)).toBe('turn');
  });

  it('returns river for 5 community cards', () => {
    expect(getStreet(5)).toBe('river');
  });

  it('returns preflop for unexpected counts (1, 2)', () => {
    expect(getStreet(1)).toBe('preflop');
    expect(getStreet(2)).toBe('preflop');
  });
});

describe('PlayerActionButtons', () => {
  it('renders all 5 action buttons', () => {
    render(<PlayerActionButtons {...defaultProps} />);
    expect(screen.getByTestId('action-fold')).toBeDefined();
    expect(screen.getByTestId('action-check')).toBeDefined();
    expect(screen.getByTestId('action-call')).toBeDefined();
    expect(screen.getByTestId('action-bet')).toBeDefined();
    expect(screen.getByTestId('action-raise')).toBeDefined();
  });

  it('buttons display correct labels', () => {
    render(<PlayerActionButtons {...defaultProps} />);
    expect(screen.getByTestId('action-fold').textContent).toBe('Fold');
    expect(screen.getByTestId('action-check').textContent).toBe('Check');
    expect(screen.getByTestId('action-call').textContent).toBe('Call');
    expect(screen.getByTestId('action-bet').textContent).toBe('Bet');
    expect(screen.getByTestId('action-raise').textContent).toBe('Raise');
  });

  it('Fold calls recordPlayerAction with action:fold and street:preflop', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-fold'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'preflop',
      action: 'fold',
      amount: null,
    });
  });

  it('Check calls recordPlayerAction with action:check', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-check'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'preflop',
      action: 'check',
      amount: null,
    });
  });

  it('Call calls recordPlayerAction with action:call', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-call'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'preflop',
      action: 'call',
      amount: null,
    });
  });

  it('Bet opens ChipPicker; confirm calls with action:bet and amount', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-bet'));
    });
    // ChipPicker should now be visible
    expect(screen.getByTestId('chip-confirm')).toBeDefined();

    // Tap a chip to set amount
    fireEvent.click(screen.getByTestId('chip-0.50'));
    fireEvent.click(screen.getByTestId('chip-0.50'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$1.00');

    // Confirm the bet
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-confirm'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'preflop',
      action: 'bet',
      amount: 1.0,
    });
  });

  it('Raise opens ChipPicker; confirm calls with action:raise and amount', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-raise'));
    });
    // ChipPicker should now be visible
    expect(screen.getByTestId('chip-confirm')).toBeDefined();

    fireEvent.click(screen.getByTestId('chip-0.30'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-confirm'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'preflop',
      action: 'raise',
      amount: 0.3,
    });
  });

  it('ChipPicker cancel returns to action buttons', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-bet'));
    });
    expect(screen.getByTestId('chip-cancel')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-cancel'));
    });
    // Action buttons should be visible again
    expect(screen.getByTestId('action-fold')).toBeDefined();
  });

  it('buttons are disabled after acting', async () => {
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-check'));
    });
    expect(screen.getByTestId('action-fold')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('action-check')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('action-call')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('action-bet')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('action-raise')).toHaveProperty('disabled', true);
  });

  it('buttons re-enable when communityCardCount changes', async () => {
    const { rerender } = render(<PlayerActionButtons {...defaultProps} communityCardCount={0} />);

    // Act — check
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-check'));
    });
    expect(screen.getByTestId('action-fold')).toHaveProperty('disabled', true);

    // Rerender with new community card count (flop dealt)
    await act(async () => {
      rerender(<PlayerActionButtons {...defaultProps} communityCardCount={3} />);
    });

    expect(screen.getByTestId('action-fold')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('action-check')).toHaveProperty('disabled', false);
    expect(screen.getByTestId('action-bet')).toHaveProperty('disabled', false);
  });

  it('uses flop street when communityCardCount is 3', async () => {
    render(<PlayerActionButtons {...defaultProps} communityCardCount={3} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-fold'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'flop',
      action: 'fold',
      amount: null,
    });
  });

  it('uses turn street when communityCardCount is 4', async () => {
    render(<PlayerActionButtons {...defaultProps} communityCardCount={4} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-check'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'turn',
      action: 'check',
      amount: null,
    });
  });

  it('uses river street when communityCardCount is 5', async () => {
    render(<PlayerActionButtons {...defaultProps} communityCardCount={5} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-call'));
    });
    expect(mockRecordPlayerAction).toHaveBeenCalledWith(1, 2, 'Alice', {
      street: 'river',
      action: 'call',
      amount: null,
    });
  });

  it('shows error when API call fails', async () => {
    mockRecordPlayerAction.mockRejectedValue(new Error('Network failure'));
    render(<PlayerActionButtons {...defaultProps} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-fold'));
    });
    expect(screen.getByTestId('action-error').textContent).toBe('Network failure');
    // Buttons should remain enabled on error so user can retry
    expect(screen.getByTestId('action-fold')).toHaveProperty('disabled', false);
  });

  it('Bet API failure dismisses ChipPicker and shows error', async () => {
    mockRecordPlayerAction.mockRejectedValue(new Error('Bet failed'));
    render(<PlayerActionButtons {...defaultProps} />);

    // Open ChipPicker via Bet
    await act(async () => {
      fireEvent.click(screen.getByTestId('action-bet'));
    });
    expect(screen.getByTestId('chip-confirm')).toBeDefined();

    // Select a chip and confirm
    fireEvent.click(screen.getByTestId('chip-0.50'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('chip-confirm'));
    });

    // ChipPicker should be dismissed — action buttons visible again
    expect(screen.getByTestId('action-fold')).toBeDefined();
    // Error message should be shown
    expect(screen.getByTestId('action-error').textContent).toBe('Bet failed');
  });

  it('Fold button has red styling', () => {
    render(<PlayerActionButtons {...defaultProps} />);
    const foldBtn = screen.getByTestId('action-fold');
    expect(foldBtn.style.backgroundColor).toBe('#dc2626');
  });
});
