/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { GameCreateForm } from '../../src/../src/dealer/GameCreateForm.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchPlayers: vi.fn(),
  createPlayer: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchPlayers, createPlayer, createSession } from '../../src/api/client.ts';

const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;
const mockedCreatePlayer = createPlayer as ReturnType<typeof vi.fn>;
const mockedCreateSession = createSession as ReturnType<typeof vi.fn>;

const PLAYERS = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00' },
  { player_id: 3, name: 'Charlie', created_at: '2026-01-01T00:00:00' },
];

function createTestWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

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
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    expect(screen.getByText(/Loading players/)).toBeTruthy();
  });

  it('renders player chips after loading', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
      expect(screen.getByText('Bob')).toBeTruthy();
      expect(screen.getByText('Charlie')).toBeTruthy();
    });
  });

  it('renders New Game heading and date input', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    expect(screen.getByText('New Game')).toBeTruthy();
    expect(document.querySelector('input[type="date"]')).toBeTruthy();
  });

  it('submit button is disabled until 2 players are selected', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
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
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
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

    render(<GameCreateForm onGameCreated={onGameCreated} />, { wrapper: createTestWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(onGameCreated).toHaveBeenCalledWith(42, ['Alice', 'Bob'], '2026-04-11');
    });
  });

  it('shows error when session creation fails', async () => {
    mockedCreateSession.mockRejectedValue(new Error('Server error'));
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
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
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
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
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
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

  it('does not render game mode selection', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    expect(screen.queryByText('Game Mode')).toBeNull();
    expect(screen.queryByText('Dealer Centric')).toBeNull();
  });

  it('renders buy-in input field', async () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });
    expect(screen.getByTestId('buy-in-input')).toBeTruthy();
    expect(screen.getByText('Buy-in Amount')).toBeTruthy();
  });

  it('sends default_buy_in when buy-in amount is provided', async () => {
    mockedCreateSession.mockResolvedValue({
      game_id: 42,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-11',
      default_buy_in: 20.0,
    });
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.change(screen.getByTestId('buy-in-input'), { target: { value: '20' } });
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      expect(mockedCreateSession).toHaveBeenCalledWith(
        expect.objectContaining({ default_buy_in: 20 }),
      );
    });
  });

  it('omits default_buy_in when buy-in input is cleared', async () => {
    mockedCreateSession.mockResolvedValue({
      game_id: 42,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-11',
    });
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeTruthy();
    });

    // Clear the default buy-in value
    fireEvent.change(screen.getByTestId('buy-in-input'), { target: { value: '' } });

    fireEvent.click(screen.getByText('Alice'));
    fireEvent.click(screen.getByText('Bob'));
    fireEvent.submit(document.querySelector('form')!);

    await waitFor(() => {
      const call = mockedCreateSession.mock.calls[0][0];
      expect(call.default_buy_in).toBeUndefined();
    });
  });

  it('defaults buy-in input to 25', () => {
    render(<GameCreateForm onGameCreated={() => {}} />, { wrapper: createTestWrapper() });
    const input = screen.getByTestId('buy-in-input') as HTMLInputElement;
    expect(input.value).toBe('25');
  });
});
