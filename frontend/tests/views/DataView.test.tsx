/** @vitest-environment happy-dom */
import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(),
  fetchPlayers: vi.fn(),
  createSession: vi.fn(),
  createHand: vi.fn(),
  uploadCsvValidate: vi.fn(),
  uploadCsvCommit: vi.fn(),
  uploadZipValidate: vi.fn(),
  uploadZipCommit: vi.fn(),
  updateCommunityCards: vi.fn(),
  updateHolecards: vi.fn(),
  exportGameCsvUrl: vi.fn((id: number) => `/games/${id}/export/csv`),
  exportGameZipUrl: vi.fn((id: number) => `/games/${id}/export/zip`),
  deleteGame: vi.fn(),
  deleteHand: vi.fn(),
}));

import { DataView } from '../../src/../src/views/DataView.tsx';
import {
  fetchSessions,
  fetchHands,
  fetchPlayers,
  createSession,
  deleteGame,
} from '../../src/api/client.ts';
import type { GameSessionListItem, HandResponse, PlayerResponse } from '../../src/api/types';

const SESSIONS: GameSessionListItem[] = [
  { game_id: 1, game_date: '2026-04-01', status: 'active', hand_count: 3, player_count: 2, winners: [] },
  { game_id: 2, game_date: '2026-04-05', status: 'completed', hand_count: 5, player_count: 4, winners: ['Alice'] },
];

const HANDS: HandResponse[] = [
  {
    hand_id: 1, game_id: 1, hand_number: 1,
    flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc', turn: 'Js', river: 'Tc',
    source_upload_id: null, created_at: '2026-04-01T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: 'river' },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: 'flop' },
    ],
  },
];

const PLAYERS: PlayerResponse[] = [
  { player_id: 1, name: 'Alice', created_at: '2026-01-01T00:00:00Z' },
  { player_id: 2, name: 'Bob', created_at: '2026-01-01T00:00:00Z' },
];

beforeEach(() => {
  vi.mocked(fetchSessions).mockResolvedValue(SESSIONS);
  vi.mocked(fetchHands).mockResolvedValue(HANDS);
  vi.mocked(fetchPlayers).mockResolvedValue(PLAYERS);
  vi.mocked(createSession).mockResolvedValue({
    game_id: 3, game_date: '2026-04-10', status: 'active',
    created_at: '2026-04-10T00:00:00Z', player_names: ['Alice'], hand_count: 0, winners: [],
  });
  vi.mocked(deleteGame).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DataView', () => {
  it('renders the title', async () => {
    render(<DataView />);
    expect(screen.getByText('📊 Game Sessions')).toBeTruthy();
  });

  it('displays loading state initially', () => {
    vi.mocked(fetchSessions).mockReturnValue(new Promise(() => {}));
    render(<DataView />);
    expect(screen.getByText('Loading sessions…')).toBeTruthy();
  });

  it('renders session rows after loading', async () => {
    render(<DataView />);
    await waitFor(() => {
      expect(screen.getByText('2026-04-01')).toBeTruthy();
      expect(screen.getByText('2026-04-05')).toBeTruthy();
    });
  });

  it('renders toolbar buttons', () => {
    render(<DataView />);
    expect(screen.getByText('+ New Game')).toBeTruthy();
    expect(screen.getByText('Import CSV')).toBeTruthy();
    expect(screen.getByText('Import ZIP')).toBeTruthy();
  });

  it('displays hand count and player count', async () => {
    render(<DataView />);
    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  it('sorts by date column on header click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    const dateHeader = screen.getByText('Date ↑');
    fireEvent.click(dateHeader);
    // After clicking, sort direction reverses
    expect(screen.getByText('Date ↓')).toBeTruthy();
  });

  it('expands session row to show hands on click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => {
      expect(screen.getByText('+ Add Hand')).toBeTruthy();
      expect(screen.getByText('▶ Load in Visualizer')).toBeTruthy();
    });
  });

  it('shows hand details with formatted cards in expanded row', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => {
      // Flop cards: A♥ K♦ Q♣
      expect(screen.getByText('A♥ K♦ Q♣')).toBeTruthy();
      // Turn: J♠
      expect(screen.getByText('J♠')).toBeTruthy();
      // River: T♣
      expect(screen.getByText('T♣')).toBeTruthy();
    });
  });

  it('shows error state when fetchSessions fails', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'));
    render(<DataView />);
    await waitFor(() => {
      expect(screen.getByText('Error: Network error')).toBeTruthy();
    });
  });

  it('opens create game modal on + New Game click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('+ New Game'));
    expect(screen.getByText('New Game Session')).toBeTruthy();
  });

  it('opens CSV upload modal on Import CSV click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('Import CSV'));
    expect(screen.getByText('Import Game from CSV')).toBeTruthy();
  });

  it('opens ZIP upload modal on Import ZIP click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('Import ZIP'));
    expect(screen.getByText('Import Game from ZIP')).toBeTruthy();
  });

  it('shows Export ZIP button in expanded game details', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => {
      expect(screen.getByText('📦 Export ZIP')).toBeTruthy();
      expect(screen.getByText('📥 Export CSV')).toBeTruthy();
    });
  });

  it('displays status badges', async () => {
    render(<DataView />);
    await waitFor(() => {
      expect(screen.getByText('active')).toBeTruthy();
      expect(screen.getByText('completed')).toBeTruthy();
    });
  });

  it('collapses expanded row on second click', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => screen.getByText('+ Add Hand'));
    fireEvent.click(screen.getByText('2026-04-01'));
    // Hand detail row should be gone
    expect(screen.queryByText('+ Add Hand')).toBeNull();
  });

  it('shows outcome_street next to result in expanded hand details', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => {
      expect(screen.getAllByText(/\(river\)/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/\(flop\)/).length).toBeGreaterThan(0);
    });
  });

  it('data-view has mobile-responsive styling (no horizontal overflow on narrow screens)', () => {
    const cssText = fs.readFileSync(path.resolve(__dirname, '../../src/style.css'), 'utf8');
    expect(cssText).toMatch(/@media\s*\(max-width:\s*768px\)/);
    expect(cssText).toContain('.data-view');
  });

  it('hand-details-row td has overflow-x auto in CSS', () => {
    const cssText = fs.readFileSync(path.resolve(__dirname, '../../src/style.css'), 'utf8');
    expect(cssText).toMatch(/\.hand-details-row\s+td[\s\S]*?overflow-x:\s*auto/);
  });

  it('hand table is hidden on mobile and replaced with card layout', () => {
    const cssText = fs.readFileSync(path.resolve(__dirname, '../../src/style.css'), 'utf8');
    // The hand-table should be hidden on mobile via display:none
    expect(cssText).toMatch(/\.hand-table[\s\S]*?display:\s*none/);
    // A card-based .hand-card class should exist for mobile
    expect(cssText).toContain('.hand-card');
  });

  it('renders hand cards alongside the hand table for mobile layout', async () => {
    render(<DataView />);
    await waitFor(() => screen.getByText('2026-04-01'));
    fireEvent.click(screen.getByText('2026-04-01'));
    await waitFor(() => screen.getByText('+ Add Hand'));
    // Should have .hand-card elements in the DOM (shown on mobile, hidden on desktop)
    const cards = document.querySelectorAll('.hand-card');
    expect(cards.length).toBeGreaterThan(0);
  });
});
