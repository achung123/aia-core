/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { SessionForm } from './SessionForm.tsx';

vi.mock('../api/client.ts', () => ({
  fetchPlayers: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchPlayers, createSession } from '../api/client.ts';

const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;
const mockedCreateSession = createSession as ReturnType<typeof vi.fn>;

const PLAYERS = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00' },
];

describe('SessionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading and date input', async () => {
    render(<SessionForm onSessionCreated={() => {}} />);
    expect(screen.getByText('New Session')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
  });

  it('shows loading state while fetching players', () => {
    mockedFetchPlayers.mockReturnValue(new Promise(() => {}));
    render(<SessionForm onSessionCreated={() => {}} />);
    expect(screen.getByText(/Loading players/)).toBeInTheDocument();
  });

  it('renders player options after loading', async () => {
    render(<SessionForm onSessionCreated={() => {}} />);
    await waitFor(() => {
      const select = screen.getByLabelText('Players') as HTMLSelectElement;
      const options = Array.from(select.options);
      expect(options.some(o => o.textContent === 'Alice')).toBe(true);
      expect(options.some(o => o.textContent === 'Bob')).toBe(true);
    });
  });

  it('shows error when player fetch fails', async () => {
    mockedFetchPlayers.mockRejectedValue(new Error('Network error'));
    render(<SessionForm onSessionCreated={() => {}} />);
    await waitFor(() => {
      const select = screen.getByLabelText('Players') as HTMLSelectElement;
      const options = Array.from(select.options);
      expect(options.some(o => o.textContent?.includes('Failed to load'))).toBe(true);
    });
  });

  it('shows empty message when no players returned', async () => {
    mockedFetchPlayers.mockResolvedValue([]);
    render(<SessionForm onSessionCreated={() => {}} />);
    await waitFor(() => {
      const select = screen.getByLabelText('Players') as HTMLSelectElement;
      const options = Array.from(select.options);
      expect(options.some(o => o.textContent === 'No players found')).toBe(true);
    });
  });

  it('calls onSessionCreated after successful submit', async () => {
    const session = { game_id: 1, game_date: '2026-04-12', player_names: ['Alice'] };
    mockedCreateSession.mockResolvedValue(session);
    const onSessionCreated = vi.fn();

    render(<SessionForm onSessionCreated={onSessionCreated} />);
    await waitFor(() => {
      expect(screen.getByLabelText('Players')).toBeInTheDocument();
    });

    // Wait for players to load before selecting
    await waitFor(() => {
      const select = screen.getByLabelText('Players') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(0);
    });

    const select = screen.getByLabelText('Players') as HTMLSelectElement;
    // Select Alice
    const aliceOption = Array.from(select.options).find(o => o.value === 'Alice')!;
    aliceOption.selected = true;
    fireEvent.change(select);

    fireEvent.submit(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onSessionCreated).toHaveBeenCalledWith(session);
    });
  });

  it('shows 409 conflict error', async () => {
    mockedCreateSession.mockRejectedValue(new Error('HTTP 409: conflict'));
    const onSessionCreated = vi.fn();

    render(<SessionForm onSessionCreated={onSessionCreated} />);
    await waitFor(() => {
      const select = screen.getByLabelText('Players') as HTMLSelectElement;
      expect(select.options.length).toBeGreaterThan(0);
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('A session for this date already exists')).toBeInTheDocument();
    });
  });
});
