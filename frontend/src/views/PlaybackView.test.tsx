/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';

// Mock modules before importing component
vi.mock('../api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(),
}));

vi.mock('../poker/evaluator.ts', () => ({
  calculateEquity: vi.fn(() => []),
}));

vi.mock('../scenes/pokerScene.js', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {},
    renderer: { domElement: document.createElement('canvas') },
    controls: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    seatPositions: [],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), dispose: vi.fn() },
    dispose: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('../scenes/tableGeometry.js', () => ({
  createSeatLabels: vi.fn(() => []),
  loadSession: vi.fn(),
  updateSeatLabelPositions: vi.fn(),
}));

import { fetchSessions, fetchHands } from '../api/client.ts';
import { calculateEquity } from '../poker/evaluator.ts';
import type { GameSessionListItem, HandResponse } from '../api/types.ts';
import { PlaybackView } from './PlaybackView.tsx';

const SESSIONS: GameSessionListItem[] = [
  { game_id: 1, game_date: '2026-02-15', status: 'completed', hand_count: 8, player_count: 3, winners: [] },
  { game_id: 2, game_date: '2026-04-05', status: 'completed', hand_count: 3, player_count: 6, winners: [] },
];

const HANDS: HandResponse[] = [
  {
    hand_id: 1,
    game_id: 1,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: 'Qc',
    turn: 'Js',
    river: 'Tc',
    source_upload_id: null,
    created_at: '2026-02-15T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null },
    ],
  },
];

describe('PlaybackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(fetchSessions).mockResolvedValue(SESSIONS);
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(calculateEquity).mockReturnValue([
      { equity: 0.6 },
      { equity: 0.4 },
    ]);
  });

  it('renders layout with sidebar and canvas', () => {
    const { container } = render(<PlaybackView />);
    expect(container.querySelector('[data-testid="playback-layout"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="session-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="three-canvas"]')).toBeTruthy();
  });

  it('shows loading state initially', () => {
    vi.mocked(fetchSessions).mockReturnValue(new Promise(() => {}));
    const { container } = render(<PlaybackView />);
    expect(container.querySelector('[data-testid="session-list"]')!.textContent).toContain('Loading');
  });

  it('renders session list after fetch', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      const rows = container.querySelectorAll('[data-testid="session-row"]');
      expect(rows.length).toBe(2);
    });
  });

  it('renders empty state when no sessions', async () => {
    vi.mocked(fetchSessions).mockResolvedValue([]);
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.textContent).toContain('No sessions found');
    });
  });

  it('shows error when fetchSessions fails', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'));
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('clicking session loads hands', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(1);
    });
  });

  it('shows session scrubber after loading hands', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeTruthy();
    });
  });

  it('shows street scrubber after loading hands', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="street-scrubber"]')).toBeTruthy();
    });
  });

  it('computes equity for 2+ players', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });
  });

  it('shows error banner when session load fails', async () => {
    vi.mocked(fetchHands).mockRejectedValue(new Error('Server error'));
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="error-banner"]')).toBeTruthy();
    });
  });

  it('shows session label with correct hand count', async () => {
    const { container } = render(<PlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="session-row"]').length).toBe(2);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="session-row"]')[0]);
    await waitFor(() => {
      const label = container.querySelector('[data-testid="session-label"]');
      expect(label).toBeTruthy();
      expect(label!.textContent).toBe('Hand 1 / 1');
    });
  });
});
