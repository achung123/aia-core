/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { GamePlayerManagement } from './GamePlayerManagement.tsx';

vi.mock('../api/client.ts', () => ({
  fetchGame: vi.fn(),
  togglePlayerStatus: vi.fn(),
  addPlayerToGame: vi.fn(),
  assignPlayerSeat: vi.fn(),
}));

import { fetchGame, togglePlayerStatus, addPlayerToGame, assignPlayerSeat } from '../api/client.ts';

const mockedFetchGame = fetchGame as ReturnType<typeof vi.fn>;
const mockedTogglePlayerStatus = togglePlayerStatus as ReturnType<typeof vi.fn>;
const mockedAddPlayerToGame = addPlayerToGame as ReturnType<typeof vi.fn>;
const mockedAssignPlayerSeat = assignPlayerSeat as ReturnType<typeof vi.fn>;

const GAME_RESPONSE = {
  game_id: 42,
  game_date: '2026-04-12',
  status: 'active',
  created_at: '2026-04-12T10:00:00Z',
  player_names: ['Alice', 'Bob', 'Charlie'],
  players: [
    { name: 'Alice', is_active: true, seat_number: 1, buy_in: null },
    { name: 'Bob', is_active: true, seat_number: 2, buy_in: null },
    { name: 'Charlie', is_active: false, seat_number: 3, buy_in: null },
  ],
  hand_count: 5,
  winners: [],
};

describe('GamePlayerManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchGame.mockResolvedValue(GAME_RESPONSE);
  });

  afterEach(() => {
    cleanup();
  });

  // AC1: Lists all game players with active/inactive status
  it('renders all players with active/inactive status', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
      expect(screen.getByText('Charlie')).toBeTruthy();
    });
    // Active players have their toggles checked
    const aliceToggle = screen.getByTestId('toggle-Alice') as HTMLInputElement;
    const bobToggle = screen.getByTestId('toggle-Bob') as HTMLInputElement;
    const charlieToggle = screen.getByTestId('toggle-Charlie') as HTMLInputElement;
    expect(aliceToggle.checked).toBe(true);
    expect(bobToggle.checked).toBe(true);
    expect(charlieToggle.checked).toBe(false);
  });

  it('shows loading state while fetching', () => {
    mockedFetchGame.mockReturnValue(new Promise(() => {}));
    render(<GamePlayerManagement gameId={42} />);
    expect(screen.getByText(/Loading/)).toBeTruthy();
  });

  it('shows fetch error', async () => {
    mockedFetchGame.mockRejectedValue(new Error('Network error'));
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeTruthy();
    });
  });

  // AC2: Toggle switches call togglePlayerStatus() and update immediately
  it('calls togglePlayerStatus when toggle is clicked', async () => {
    mockedTogglePlayerStatus.mockResolvedValue({ player_name: 'Alice', is_active: false });
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const aliceToggle = screen.getByTestId('toggle-Alice');
    fireEvent.click(aliceToggle);

    await waitFor(() => {
      expect(mockedTogglePlayerStatus).toHaveBeenCalledWith(42, 'Alice', false);
    });
    // Toggle should now be unchecked
    expect((screen.getByTestId('toggle-Alice') as HTMLInputElement).checked).toBe(false);
  });

  it('reactivates an inactive player via toggle', async () => {
    mockedTogglePlayerStatus.mockResolvedValue({ player_name: 'Charlie', is_active: true });
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeTruthy();
    });

    const charlieToggle = screen.getByTestId('toggle-Charlie');
    fireEvent.click(charlieToggle);

    await waitFor(() => {
      expect(mockedTogglePlayerStatus).toHaveBeenCalledWith(42, 'Charlie', true);
    });
    expect((screen.getByTestId('toggle-Charlie') as HTMLInputElement).checked).toBe(true);
  });

  // AC4: Error states shown inline (toggle error)
  it('shows inline error when toggle fails', async () => {
    mockedTogglePlayerStatus.mockRejectedValue(new Error('Server error'));
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('toggle-Alice'));

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeTruthy();
    });
    // Toggle should revert to original value on error
    expect((screen.getByTestId('toggle-Alice') as HTMLInputElement).checked).toBe(true);
  });

  // AC3: Add Player input + button calls addPlayerToGame()
  it('renders add player input and button', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByPlaceholderText('Player name')).toBeTruthy();
    expect(screen.getByTestId('add-player-btn')).toBeTruthy();
  });

  it('calls addPlayerToGame when add button is clicked', async () => {
    mockedAddPlayerToGame.mockResolvedValue({ player_name: 'Dave', is_active: true, seat_number: 4 });
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Player name');
    fireEvent.change(input, { target: { value: 'Dave' } });
    fireEvent.click(screen.getByTestId('add-player-btn'));

    await waitFor(() => {
      expect(mockedAddPlayerToGame).toHaveBeenCalledWith(42, 'Dave');
    });
    // New player should appear in the list
    await waitFor(() => {
      expect(screen.getByText('Dave')).toBeTruthy();
    });
    // Input should be cleared
    expect((screen.getByPlaceholderText('Player name') as HTMLInputElement).value).toBe('');
  });

  // AC4: Error states shown inline (add error)
  it('shows inline error when add fails', async () => {
    mockedAddPlayerToGame.mockRejectedValue(new Error('HTTP 409: Player already exists'));
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Player name');
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByTestId('add-player-btn'));

    await waitFor(() => {
      expect(screen.getByText(/Player already exists/)).toBeTruthy();
    });
  });

  it('shows error for empty name', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('add-player-btn'));

    await waitFor(() => {
      expect(screen.getByText(/name cannot be empty/i)).toBeTruthy();
    });
    expect(mockedAddPlayerToGame).not.toHaveBeenCalled();
  });

  it('renders heading', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Players')).toBeTruthy();
    });
  });

  // AC4: player list shows seat numbers
  it('displays seat number for each player', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByTestId('seat-number-Alice').textContent).toContain('Seat 1');
    expect(screen.getByTestId('seat-number-Bob').textContent).toContain('Seat 2');
    expect(screen.getByTestId('seat-number-Charlie').textContent).toContain('Seat 3');
  });

  // AC4: "Reassign" opens seat picker
  it('shows seat picker when Reassign Seat is clicked', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reassign-btn-Alice'));
    await waitFor(() => {
      expect(screen.getByTestId('seat-reassign-panel')).toBeTruthy();
      expect(screen.getByTestId('seat-picker')).toBeTruthy();
      expect(screen.getByText(/Reassign seat for Alice/)).toBeTruthy();
    });
  });

  it('closes seat picker when Reassign Seat is toggled off', async () => {
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reassign-btn-Alice'));
    await waitFor(() => {
      expect(screen.getByTestId('seat-reassign-panel')).toBeTruthy();
    });
    // Click again to toggle off
    fireEvent.click(screen.getByTestId('reassign-btn-Alice'));
    await waitFor(() => {
      expect(screen.queryByTestId('seat-reassign-panel')).toBeNull();
    });
  });

  // AC4: Reassignment calls PATCH .../seat
  it('calls assignPlayerSeat when a seat is selected in reassignment', async () => {
    mockedAssignPlayerSeat.mockResolvedValue({ name: 'Alice', is_active: true, seat_number: 5, buy_in: null });
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reassign-btn-Alice'));
    await waitFor(() => {
      expect(screen.getByTestId('seat-picker')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('seat-5'));
    await waitFor(() => {
      expect(mockedAssignPlayerSeat).toHaveBeenCalledWith(42, 'Alice', { seat_number: 5 });
    });
    // Seat should update in the player list
    await waitFor(() => {
      expect(screen.getByTestId('seat-number-Alice').textContent).toContain('Seat 5');
    });
    // Reassign panel should close
    expect(screen.queryByTestId('seat-reassign-panel')).toBeNull();
  });

  // AC4: conflict error displayed on 409
  it('shows error on 409 conflict during seat reassignment', async () => {
    mockedAssignPlayerSeat.mockRejectedValue(new Error('HTTP 409: Seat 2 is already occupied by Bob'));
    render(<GamePlayerManagement gameId={42} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('reassign-btn-Alice'));
    await waitFor(() => {
      expect(screen.getByTestId('seat-picker')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('seat-5'));
    await waitFor(() => {
      expect(screen.getByTestId('action-error')).toBeTruthy();
      expect(screen.getByTestId('action-error').textContent).toContain('Seat 2 is already occupied');
    });
  });
});
