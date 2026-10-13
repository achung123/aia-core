/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { PlayerManagement } from '../../src/../src/components/PlayerManagement.tsx';

vi.mock('../../src/api/client.ts', () => ({
  fetchPlayers: vi.fn(),
  createPlayer: vi.fn(),
}));

import { fetchPlayers, createPlayer } from '../../src/api/client.ts';

const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;
const mockedCreatePlayer = createPlayer as ReturnType<typeof vi.fn>;

const PLAYERS = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00' },
];

describe('PlayerManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading', () => {
    render(<PlayerManagement />);
    expect(screen.getByText('Players')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedFetchPlayers.mockReturnValue(new Promise(() => {}));
    render(<PlayerManagement />);
    expect(screen.getByText(/Loading players/)).toBeInTheDocument();
  });

  it('renders player names after loading', async () => {
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows empty message when no players', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText(/No players yet/)).toBeInTheDocument();
    });
  });

  it('shows fetch error', async () => {
    mockedFetchPlayers.mockRejectedValue(new Error('Network error'));
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load players/)).toBeInTheDocument();
    });
  });

  it('adds a new player on submit', async () => {
    mockedCreatePlayer.mockResolvedValue({ player_id: 3, name: 'Charlie', created_at: '2026-04-12T00:00:00' });
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Player name');
    fireEvent.change(input, { target: { value: 'Charlie' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });
    expect(mockedCreatePlayer).toHaveBeenCalledWith({ name: 'Charlie' });
  });

  it('shows error for empty name', async () => {
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Player name cannot be empty.')).toBeInTheDocument();
    });
  });

  it('shows 409 duplicate error', async () => {
    mockedCreatePlayer.mockRejectedValue(new Error('HTTP 409: conflict'));
    render(<PlayerManagement />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Player name');
    fireEvent.change(input, { target: { value: 'Alice' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/)).toBeInTheDocument();
    });
  });
});
