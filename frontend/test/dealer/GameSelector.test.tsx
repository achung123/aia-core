/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { GameSelector } from '../../src/../src/dealer/GameSelector.tsx';

// Mock fetchSessions
vi.mock('../../src/api/client.ts', () => ({
  fetchSessions: vi.fn(),
}));

import { fetchSessions } from '../../src/api/client.ts';

const mockedFetchSessions = fetchSessions as ReturnType<typeof vi.fn>;

const SESSIONS = [
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3, winners: [] },
  { game_id: 3, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8, winners: ['Bob', 'Carol'] },
];

describe('GameSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state initially', () => {
    mockedFetchSessions.mockReturnValue(new Promise(() => {})); // never resolves
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    expect(screen.getByText(/Loading/)).toBeTruthy();
  });

  it('renders games sorted by game_id descending', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/2026-04-05/)).toBeTruthy();
    });

    const cards = screen.getAllByTestId('game-card');
    expect(cards.length).toBe(3);
    // Sorted by game_id descending: 3, 2, 1
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    expect(cards[2].textContent).toContain('#1');
  });

  it('displays game details (status, player count, hand count)', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const cards = screen.getAllByTestId('game-card');
    // Cards sorted by game_id desc: 3, 2, 1
    expect(cards[0].textContent).toContain('3');
    expect(cards[0].textContent).toContain('8');
    expect(cards[1].textContent).toContain('6');
    expect(cards[1].textContent).toContain('3');
  });

  it('active games have indigo accent style', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const cards = screen.getAllByTestId('game-card');
    // Sorted by game_id desc: 3 (complete), 2 (active), 1 (complete)
    expect((cards[0] as HTMLElement).style.borderColor).not.toContain('#6366f1');
    expect((cards[1] as HTMLElement).style.borderColor).toContain('#6366f1');
    expect((cards[2] as HTMLElement).style.borderColor).not.toContain('#6366f1');
  });

  it('calls onSelectGame when a game card is tapped', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    const onSelectGame = vi.fn();
    render(<GameSelector onSelectGame={onSelectGame} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const cards = screen.getAllByTestId('game-card');
    // Sorted by game_id desc: 3, 2, 1 — tap game 2 (index 1)
    cards[1].click();
    expect(onSelectGame).toHaveBeenCalledWith(2);
  });

  it('renders a New Game button that calls onNewGame', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    const onNewGame = vi.fn();
    render(<GameSelector onSelectGame={() => {}} onNewGame={onNewGame} />);
    await waitFor(() => {
      expect(screen.getByText(/2026-04-05/)).toBeTruthy();
    });

    const newGameBtn = screen.getByTestId('new-game-btn');
    expect(newGameBtn).toBeTruthy();
    expect(newGameBtn.textContent).toContain('New Game');
    newGameBtn.click();
    expect(onNewGame).toHaveBeenCalled();
  });

  it('shows error state when fetch fails', async () => {
    mockedFetchSessions.mockRejectedValue(new Error('Network error'));
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });

  it('shows New Game button even during loading', () => {
    mockedFetchSessions.mockReturnValue(new Promise(() => {}));
    const onNewGame = vi.fn();
    render(<GameSelector onSelectGame={() => {}} onNewGame={onNewGame} />);
    const newGameBtn = screen.getByTestId('new-game-btn');
    expect(newGameBtn).toBeTruthy();
    newGameBtn.click();
    expect(onNewGame).toHaveBeenCalled();
  });

  it('displays game_id on each game card', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const cards = screen.getAllByTestId('game-card');
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    expect(cards[2].textContent).toContain('#1');
  });

  it('shows winners on completed game cards', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const cards = screen.getAllByTestId('game-card');
    expect(cards[0].textContent).toContain('Bob');
    expect(cards[0].textContent).toContain('Carol');
    expect(cards[2].textContent).toContain('Alice');
  });

  it('game card details wrap on narrow screens', async () => {
    mockedFetchSessions.mockResolvedValue(SESSIONS);
    render(<GameSelector onSelectGame={() => {}} onNewGame={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('game-card').length).toBe(3);
    });

    const details = screen.getAllByTestId('card-details')[0] as HTMLElement;
    expect(details).toBeTruthy();
    expect(details.style.flexWrap).toBe('wrap');
  });
});
