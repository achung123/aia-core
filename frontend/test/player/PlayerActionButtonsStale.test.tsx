/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

vi.mock('../../src/api/client.ts', () => ({
  recordPlayerAction: vi.fn(() => Promise.resolve({})),
}));

import { recordPlayerAction } from '../../src/api/client.ts';
import { PlayerActionButtons } from '../../src/player/PlayerActionButtons.tsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseProps = {
  gameId: 3,
  handNumber: 1,
  playerName: 'Ann',
  communityCardCount: 0,
  legalActions: ['fold', 'check', 'bet'],
};

describe('PlayerActionButtons — stale screens', () => {
  it('sends the action count it last saw', async () => {
    render(<PlayerActionButtons {...baseProps} expectedActionIndex={4} />);
    fireEvent.click(screen.getByTestId('action-check'));
    await waitFor(() => expect(recordPlayerAction).toHaveBeenCalled());
    expect(recordPlayerAction).toHaveBeenCalledWith(3, 1, 'Ann', expect.objectContaining({
      action: 'check',
      expected_action_index: 4,
    }));
  });

  it('omits the guard when the count is not known yet', async () => {
    render(<PlayerActionButtons {...baseProps} expectedActionIndex={null} />);
    fireEvent.click(screen.getByTestId('action-check'));
    await waitFor(() => expect(recordPlayerAction).toHaveBeenCalled());
    const payload = (recordPlayerAction as ReturnType<typeof vi.fn>).mock.calls[0][3];
    expect(payload).not.toHaveProperty('expected_action_index');
  });

  it('explains a rejected stale action and asks for a refresh instead of failing silently', async () => {
    (recordPlayerAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('HTTP 409: {"detail":"The hand has moved on since this screen was updated — refresh"}'),
    );
    const onActionConfirmed = vi.fn();
    render(
      <PlayerActionButtons {...baseProps} expectedActionIndex={2} onActionConfirmed={onActionConfirmed} />,
    );
    fireEvent.click(screen.getByTestId('action-check'));

    await waitFor(() => expect(screen.getByTestId('action-error')).toBeDefined());
    expect(screen.getByTestId('action-error').textContent).toMatch(/just changed/i);
    expect(screen.getByTestId('action-error').textContent).not.toMatch(/HTTP 409/);
    // The screen is told to re-read the table
    expect(onActionConfirmed).toHaveBeenCalledTimes(1);
  });

  it('still shows other errors as they are', async () => {
    (recordPlayerAction as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('HTTP 400: Minimum bet is 0.20'),
    );
    render(<PlayerActionButtons {...baseProps} expectedActionIndex={2} />);
    fireEvent.click(screen.getByTestId('action-check'));
    await waitFor(() => expect(screen.getByTestId('action-error').textContent).toContain('HTTP 400'));
  });
});
