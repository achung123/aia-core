/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';

vi.mock('../api/client.ts', () => ({
  fetchBlinds: vi.fn(),
}));

import { fetchBlinds } from '../api/client.ts';

const { BlindPositionDisplay } = await import('./BlindPositionDisplay.tsx');

describe('BlindPositionDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(fetchBlinds).mockResolvedValue({
      small_blind: 0.10,
      big_blind: 0.20,
      blind_timer_minutes: 15,
      blind_timer_paused: false,
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('AC1: shows Blinds: $X.XX / $Y.YY from game blind state', async () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('blind-level').textContent).toBe(
      'Blinds: $0.10 / $0.20',
    );
  });

  it('AC2: shows SB and BB player names', () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    expect(screen.getByTestId('sb-label').textContent).toContain('Bob');
    expect(screen.getByTestId('bb-label').textContent).toContain('Carol');
  });

  it('AC3: highlights label when current player is SB', () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Bob"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    const sbLabel = screen.getByTestId('sb-label');
    expect(sbLabel.getAttribute('data-highlight')).toBe('true');
    const bbLabel = screen.getByTestId('bb-label');
    expect(bbLabel.getAttribute('data-highlight')).toBe('false');
  });

  it('AC3: highlights label when current player is BB', () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Carol"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    const bbLabel = screen.getByTestId('bb-label');
    expect(bbLabel.getAttribute('data-highlight')).toBe('true');
    const sbLabel = screen.getByTestId('sb-label');
    expect(sbLabel.getAttribute('data-highlight')).toBe('false');
  });

  it('AC3: no highlight when current player is neither SB nor BB', () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    const sbLabel = screen.getByTestId('sb-label');
    expect(sbLabel.getAttribute('data-highlight')).toBe('false');
    const bbLabel = screen.getByTestId('bb-label');
    expect(bbLabel.getAttribute('data-highlight')).toBe('false');
  });

  it('AC4: polls for blind level changes', async () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    // Initial fetch — flush the promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(vi.mocked(fetchBlinds)).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('blind-level').textContent).toBe('Blinds: $0.10 / $0.20');

    // Update the mock for the next poll
    vi.mocked(fetchBlinds).mockResolvedValue({
      small_blind: 0.25,
      big_blind: 0.50,
      blind_timer_minutes: 15,
      blind_timer_paused: false,
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    });

    // Advance timer to trigger poll (10s interval)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(vi.mocked(fetchBlinds)).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('blind-level').textContent).toBe('Blinds: $0.25 / $0.50');
  });

  it('shows dash when blinds have not loaded yet', () => {
    vi.mocked(fetchBlinds).mockReturnValue(new Promise(() => {}));
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    expect(screen.getByTestId('blind-level').textContent).toBe('Blinds: –');
  });

  it('handles null SB/BB names gracefully', () => {
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName={null}
        bbPlayerName={null}
      />,
    );
    expect(screen.queryByTestId('sb-label')).toBeNull();
    expect(screen.queryByTestId('bb-label')).toBeNull();
  });

  it('handles fetchBlinds error gracefully', async () => {
    vi.mocked(fetchBlinds).mockRejectedValue(new Error('Network error'));
    render(
      <BlindPositionDisplay
        gameId={1}
        currentPlayerName="Alice"
        sbPlayerName="Bob"
        bbPlayerName="Carol"
      />,
    );
    // Flush the rejected promise
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Should show dash, not crash
    expect(screen.getByTestId('blind-level').textContent).toBe('Blinds: –');
  });
});
