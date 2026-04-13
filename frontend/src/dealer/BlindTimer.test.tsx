/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../api/client.ts', () => ({
  fetchBlinds: vi.fn(),
  updateBlinds: vi.fn(),
}));

import { fetchBlinds, updateBlinds } from '../api/client.ts';
import { BlindTimer } from './BlindTimer.tsx';

const mockFetchBlinds = vi.mocked(fetchBlinds);
const mockUpdateBlinds = vi.mocked(updateBlinds);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function blindsData(overrides: Record<string, unknown> = {}) {
  return {
    small_blind: 0.25,
    big_blind: 0.50,
    blind_timer_minutes: 15,
    blind_timer_paused: false,
    blind_timer_started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    blind_timer_remaining_seconds: 600, // 10 min remaining
    ...overrides,
  };
}

describe('BlindTimer', () => {
  // AC1: Displays Blinds: $X.XX / $Y.YY from fetchBlinds() data
  it('displays blind level as $X.XX / $Y.YY', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData());
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-level').textContent).toContain('$0.25 / $0.50');
    });
  });

  it('shows loading state before data arrives', () => {
    mockFetchBlinds.mockReturnValue(new Promise(() => {})); // never resolves
    render(<BlindTimer gameId={1} />);
    expect(screen.getByTestId('blind-timer-container')).toBeDefined();
    expect(screen.getByTestId('blind-level').textContent).toContain('–');
  });

  // AC2: Countdown timer from blind_timer_started_at + blind_timer_minutes
  it('shows countdown timer with remaining seconds', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 600 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('10:00');
    });
  });

  it('counts down every second', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 65 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('1:05');
    });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('1:04');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('1:03');
  });

  it('does not count below 0', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 2 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('0:02');
    });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('0:00');
  });

  it('shows no timer when blind_timer_started_at is null', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-level').textContent).toContain('$0.25');
    });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('--:--');
  });

  // AC3: Pause/resume button calls updateBlinds()
  it('shows Pause button when timer is running', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_paused: false }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      const btn = screen.getByTestId('blind-pause-btn');
      expect(btn.textContent).toContain('Pause');
    });
  });

  it('shows Resume button when timer is paused', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_paused: true,
      blind_timer_remaining_seconds: 300,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      const btn = screen.getByTestId('blind-pause-btn');
      expect(btn.textContent).toContain('Resume');
    });
  });

  it('calls updateBlinds to pause when Pause is clicked', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_paused: false }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_paused: true, blind_timer_remaining_seconds: 300 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-pause-btn')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-pause-btn'));
    });
    expect(mockUpdateBlinds).toHaveBeenCalledWith(1, { blind_timer_paused: true });
  });

  it('calls updateBlinds to resume when Resume is clicked', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_paused: true,
      blind_timer_remaining_seconds: 300,
    }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_paused: false, blind_timer_remaining_seconds: 300 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-pause-btn').textContent).toContain('Resume');
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-pause-btn'));
    });
    expect(mockUpdateBlinds).toHaveBeenCalledWith(1, { blind_timer_paused: false });
  });

  it('does not tick when paused', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_paused: true,
      blind_timer_remaining_seconds: 300,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('5:00');
    });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('5:00');
  });

  // AC4: When timer hits 0, prompts dealer to advance blinds
  it('shows advance prompt when timer reaches 0', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 1 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('0:01');
    });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('blind-advance-prompt')).toBeDefined();
    expect(screen.getByTestId('blind-advance-prompt').textContent).toContain('Advance');
  });

  it('calls onAdvanceBlinds callback when advance button is clicked', async () => {
    const onAdvance = vi.fn();
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 0 }));
    render(<BlindTimer gameId={1} onAdvanceBlinds={onAdvance} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-advance-prompt')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('blind-advance-btn'));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  // AC5: Timer stops ticking after unmount (no leaked intervals)
  it('cleans up interval on unmount', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 60 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('1:00');
    });
    cleanup();
    // Advancing timers should not throw
    act(() => { vi.advanceTimersByTime(5000); });
  });

  it('hides pause button when no timer is active', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-level')).toBeDefined();
    });
    expect(screen.queryByTestId('blind-pause-btn')).toBeNull();
  });
});
