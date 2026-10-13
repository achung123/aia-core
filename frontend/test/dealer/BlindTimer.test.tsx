/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

vi.mock('../../src/api/client.ts', () => ({
  fetchBlinds: vi.fn(),
  updateBlinds: vi.fn(),
}));

import { fetchBlinds, updateBlinds } from '../../src/api/client.ts';
import { BlindTimer } from '../../src/../src/dealer/BlindTimer.tsx';

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

  // AC4: When timer hits 0, shows notification text (no button)
  it('shows time-up notification when timer reaches 0', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 1 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('0:01');
    });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('blind-advance-prompt')).toBeDefined();
    expect(screen.getByTestId('blind-advance-prompt').textContent).toContain('advance');
    // Should NOT have a button
    expect(screen.queryByTestId('blind-advance-btn')).toBeNull();
  });

  it('centers the time-up notification', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 0 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-advance-prompt')).toBeDefined();
    });
    const prompt = screen.getByTestId('blind-advance-prompt');
    expect(prompt.style.justifyContent).toBe('center');
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

  // Reset button
  it('shows Reset button when timer is active', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 600 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-reset-btn')).toBeDefined();
    });
    expect(screen.getByTestId('blind-reset-btn').textContent).toContain('Reset');
  });

  it('hides Reset button when no timer is active', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-level')).toBeDefined();
    });
    expect(screen.queryByTestId('blind-reset-btn')).toBeNull();
  });

  it('calls updateBlinds with same blind values to reset timer', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 300 }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 900, blind_timer_paused: false }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-reset-btn')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-reset-btn'));
    });
    expect(mockUpdateBlinds).toHaveBeenCalledWith(1, { small_blind: 0.25, big_blind: 0.50 });
  });

  it('updates local state after reset', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 300 }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 900, blind_timer_paused: false }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('5:00');
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-reset-btn'));
    });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('15:00');
  });

  // Start Timer button — shown when timer has not been started yet
  it('shows Start Timer button when timer is not active', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-start-btn')).toBeDefined();
    });
    expect(screen.getByTestId('blind-start-btn').textContent).toContain('Start');
  });

  it('does not show Start Timer button when timer is already active', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 600 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-pause-btn')).toBeDefined();
    });
    expect(screen.queryByTestId('blind-start-btn')).toBeNull();
  });

  it('calls updateBlinds with current blind values when Start Timer is clicked', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 900, blind_timer_paused: false }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-start-btn')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-start-btn'));
    });
    expect(mockUpdateBlinds).toHaveBeenCalledWith(1, { small_blind: 0.25, big_blind: 0.50 });
  });

  it('transitions to active timer after Start is clicked', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    mockUpdateBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 900, blind_timer_paused: false }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-start-btn')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-start-btn'));
    });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('15:00');
    expect(screen.queryByTestId('blind-start-btn')).toBeNull();
  });

  // 60-second warning
  it('shows warning style when remaining <= 60 seconds', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 60 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('1:00');
    });
    const countdown = screen.getByTestId('blind-countdown');
    expect(countdown.style.color).toBe('#f59e0b');
  });

  it('does not show warning style when remaining > 60 seconds', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 61 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('1:01');
    });
    const countdown = screen.getByTestId('blind-countdown');
    expect(countdown.style.color).not.toBe('#f59e0b');
  });

  it('transitions to warning style as countdown crosses 60s threshold', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({ blind_timer_remaining_seconds: 62 }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('1:02');
    });
    const countdown = screen.getByTestId('blind-countdown');
    expect(countdown.style.color).not.toBe('#f59e0b');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByTestId('blind-countdown').textContent).toBe('1:00');
    expect(countdown.style.color).toBe('#f59e0b');
  });

  // Bug fix: Start Timer with realistic backend response (remaining_seconds=null)
  it('starts timer when backend returns null remaining_seconds but valid started_at', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    const now = new Date().toISOString();
    mockUpdateBlinds.mockResolvedValue(blindsData({
      blind_timer_remaining_seconds: null,
      blind_timer_started_at: now,
      blind_timer_paused: false,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-start-btn')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('blind-start-btn'));
    });
    // Timer should show 15:00 (computed from blind_timer_minutes * 60)
    expect(screen.getByTestId('blind-countdown').textContent).toBe('15:00');
    // Start button should disappear
    expect(screen.queryByTestId('blind-start-btn')).toBeNull();
  });

  // Bug fix: Running timer shows correct remaining on page load
  it('computes remaining from started_at when remaining_seconds is null', async () => {
    // Timer started 5 minutes ago, 15-minute timer -> 10 min remaining
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: fiveMinAgo,
      blind_timer_remaining_seconds: null,
      blind_timer_paused: false,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-countdown').textContent).toBe('10:00');
    });
  });

  // Bug fix: naive UTC timestamp (no Z suffix) must be treated as UTC
  it('handles naive UTC timestamp from backend without timezone offset', async () => {
    // Simulate backend returning a naive UTC datetime (no Z suffix) — just started
    const nowUtc = new Date();
    const naive = nowUtc.getUTCFullYear() + '-'
      + String(nowUtc.getUTCMonth() + 1).padStart(2, '0') + '-'
      + String(nowUtc.getUTCDate()).padStart(2, '0') + 'T'
      + String(nowUtc.getUTCHours()).padStart(2, '0') + ':'
      + String(nowUtc.getUTCMinutes()).padStart(2, '0') + ':'
      + String(nowUtc.getUTCSeconds()).padStart(2, '0');
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: naive,
      blind_timer_remaining_seconds: null,
      blind_timer_paused: false,
      blind_timer_minutes: 1,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      // Should be ~1:00 (just started, 1-minute timer), NOT offset by hours
      const text = screen.getByTestId('blind-countdown').textContent!;
      const [m] = text.split(':').map(Number);
      expect(m).toBeLessThanOrEqual(1);
    });
  });

  // Bug fix: Start Timer button should be centered
  it('renders Start Timer button centered and full width', async () => {
    mockFetchBlinds.mockResolvedValue(blindsData({
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }));
    render(<BlindTimer gameId={1} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId('blind-start-btn')).toBeDefined();
    });
    const container = screen.getByTestId('blind-start-btn').parentElement!;
    expect(container.style.justifyContent).toBe('center');
  });
});
