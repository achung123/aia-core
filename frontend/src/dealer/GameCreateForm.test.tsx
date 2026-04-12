/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { GameCreateForm } from './GameCreateForm.tsx';

vi.mock('../api/client.ts', () => ({
  fetchPlayers: vi.fn(),
  createPlayer: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchPlayers, createPlayer, createSession } from '../api/client.ts';

const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;
const mockedCreatePlayer = createPlayer as ReturnType<typeof vi.fn>;
const mockedCreateSession = createSession as ReturnType<typeof vi.fn>;

const PLAYERS = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00' },
  { player_id: 3, name: 'Charlie', created_at: '2026-01-01T00:00:00' },
];

describe('GameCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state while fetching players', () => {
    mockedFetchPlayers.mockReturnValue(new Promise(() => {}));
    render(<GameCreateForm onGameCreated={() => {}} />);
    expect(screen.getByText(/Loading players/)).toBeTruthy();
  });

  it('renders player chips after loading', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
      expect(screen.getByText('Charlie')).toBeTruthy();
    });
  });

  it('renders New Game heading and date input', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />);
    expect(screen.getByText('New Game')).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).toBeTruthy();
  });

  it('submit button is disabled until 2 players are selected', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const submitBtn = screen.getByText('Create Game');
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // Select one player
    fireEvent.click(screen.getByText('Alice'));
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    // Select second player
    fireEvent.click(screen.getByText('Bob'));
    expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('toggling a player chip deselects it', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    const submitBtn = screen.getByText('Create Game') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    // Deselect Alice
    fireEvent.click(screen.getByText('Alice'));
    expect(submitBtn.disabled).toBe(true);
  });

  it('calls onGameCreated after successful submit', async () => {
    mockedCreateSession.mockResolvedValue({
      game_id: 42,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-11',
    });
    const onGameCreated = vi.fn();

    render(<GameCreateForm onGameCreated={onGameCreated} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(onGameCreated).toHaveBeenCalledWith(42, ['Alice', 'Bob'], '2026-04-11', 'dealer_centric');
    });
  });

  it('shows error when session creation fails', async () => {
    mockedCreateSession.mockRejectedValue(new Error('Server error'));
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeTruthy();
    });
  });

  it('add player creates and auto-selects new player', async () => {
    mockedCreatePlayer.mockResolvedValue({ player_id: 4, name: 'Diana', created_at: '2026-04-11T00:00:00' });
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('New player name');
    fireEvent.change(input, { target: { value: 'Diana' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText('Diana')).toBeTruthy();
    });
    expect(mockedCreatePlayer).toHaveBeenCalledWith({ name: 'Diana' });
  });

  it('shows error when adding duplicate player', async () => {
    mockedCreatePlayer.mockRejectedValue(new Error('HTTP 409: conflict'));
    render(<GameCreateForm onGameCreated={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('New player name');
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText(/already exists/)).toBeTruthy();
    });
  });

  it('renders game mode selection with dealer_centric as default', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />);
    expect(screen.getByText('Game Mode')).toBeTruthy();
    expect(screen.getByText('Dealer Centric')).toBeTruthy();
    expect(screen.getByText('Player Participation')).toBeTruthy();

    const dealerRadio = document.querySelector('input[value="dealer_centric"]') as HTMLInputElement;
    expect(dealerRadio.checked).toBe(true);
  });
});
