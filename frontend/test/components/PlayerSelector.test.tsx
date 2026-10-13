/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerSelector } from '../../src/components/PlayerSelector';

vi.mock('../../src/api/client.ts', () => ({
  fetchPlayers: vi.fn(),
}));

import { fetchPlayers } from '../../src/api/client.ts';

const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;

const PLAYERS = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00' },
  { player_id: 3, name: 'Charlie', created_at: '2026-01-01T00:00:00' },
  { player_id: 4, name: 'Alicia', created_at: '2026-01-01T00:00:00' },
];

describe('PlayerSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchPlayers.mockResolvedValue(PLAYERS);
  });

  afterEach(() => {
    cleanup();
  });

  // AC1: Fetches player names from /players endpoint
  it('fetches players on mount', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    await waitFor(() => {
      expect(mockedFetchPlayers).toHaveBeenCalledOnce();
    });
  });

  it('shows all players in dropdown when input is focused', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Alicia')).toBeInTheDocument();
    });
  });

  // AC2: Supports type-ahead filtering
  it('filters players as user types', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'ali');
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Alicia')).toBeInTheDocument();
      expect(screen.queryByText('Bob')).not.toBeInTheDocument();
      expect(screen.queryByText('Charlie')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when filter matches nothing', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'zzz');
    await waitFor(() => {
      expect(screen.getByText(/no players found/i)).toBeInTheDocument();
    });
  });

  // AC3: Calls onSelect(playerName) callback when a player is chosen
  it('calls onSelect with player name when option is clicked', async () => {
    const onSelect = vi.fn();
    render(<PlayerSelector onSelect={onSelect} />);
    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await waitFor(() => {
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Bob'));
    expect(onSelect).toHaveBeenCalledWith('Bob');
  });

  // AC4: Supports a value prop for controlled usage
  it('displays the controlled value prop', async () => {
    render(<PlayerSelector onSelect={vi.fn()} value="Alice" />);
    const input = await screen.findByRole('combobox');
    expect(input).toHaveValue('Alice');
  });

  it('updates display when value prop changes', async () => {
    const { rerender } = render(<PlayerSelector onSelect={vi.fn()} value="Alice" />);
    const input = await screen.findByRole('combobox');
    expect(input).toHaveValue('Alice');
    rerender(<PlayerSelector onSelect={vi.fn()} value="Bob" />);
    expect(input).toHaveValue('Bob');
  });

  // AC5: Mobile-friendly: full-width input, large touch targets
  it('renders a full-width input', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    const input = await screen.findByRole('combobox');
    expect(input.style.width).toBe('100%');
  });

  it('renders options with min-height for touch targets', async () => {
    render(<PlayerSelector onSelect={vi.fn()} />);
    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    const option = screen.getByText('Alice');
    expect(parseInt(option.style.minHeight || '0', 10)).toBeGreaterThanOrEqual(44);
  });

  // Edge: closes dropdown when clicking outside option
  it('closes dropdown after selecting a player', async () => {
    const onSelect = vi.fn();
    render(<PlayerSelector onSelect={onSelect} />);
    const input = await screen.findByRole('combobox');
    await userEvent.click(input);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Alice'));
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('shows placeholder text', async () => {
    render(<PlayerSelector onSelect={vi.fn()} placeholder="Pick a player" />);
    const input = await screen.findByRole('combobox');
    expect(input).toHaveAttribute('placeholder', 'Pick a player');
  });
});
