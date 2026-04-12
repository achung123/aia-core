/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useDealerStore } from '../stores/dealerStore.ts';

vi.mock('../api/client.js', () => ({
  createHand: vi.fn(),
  addPlayerToHand: vi.fn(),
  updateHolecards: vi.fn(),
  updateCommunityCards: vi.fn(),
  patchPlayerResult: vi.fn(),
  uploadImage: vi.fn(),
  getDetectionResults: vi.fn(),
  createSession: vi.fn(),
  createPlayer: vi.fn(),
  fetchPlayers: vi.fn(),
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(() => Promise.resolve([])),
  fetchEquity: vi.fn(() => Promise.resolve({ equities: [] })),
  fetchGame: vi.fn(),
  fetchHand: vi.fn(),
  fetchHandStatus: vi.fn(() => Promise.resolve({ hand_number: 1, community_recorded: false, players: [] })),
}));

vi.mock('./CameraCapture.tsx', () => ({
  CameraCapture: () => <div data-testid="camera-capture" />,
}));

vi.mock('./DetectionReview.tsx', () => ({
  DetectionReview: () => <div data-testid="detection-review" />,
}));

vi.mock('../scenes/pokerScene.js', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: { aspect: 1, updateProjectionMatrix: vi.fn() },
    renderer: { setSize: vi.fn() },
    seatPositions: [],
    dispose: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock('../mobile/StreetScrubber.jsx', () => ({
  StreetScrubber: () => null,
  STREETS: ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'],
}));

vi.mock('../poker/evaluator.js', () => ({
  calculateEquity: vi.fn(() => []),
}));

// Use real dealerState (no mock override) — initialState.currentStep should be 'gameSelector'

import {
  createSession,
  fetchPlayers,
  fetchSessions,
  fetchHands,
  fetchGame,
  fetchHand,
} from '../api/client.ts';
import { DealerApp } from './DealerApp.tsx';

let activeRoot = null;

function renderToContainer(vnode) {
  const container = document.createElement('div');
  act(() => {
    activeRoot = createRoot(container);
    activeRoot.render(vnode);
  });
  return container;
}

describe('GameSelector integration in DealerApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    useDealerStore.setState({
      gameId: null,
      currentHandId: null,
      players: [],
      community: { flop1: null, flop2: null, flop3: null, flopRecorded: false, turn: null, turnRecorded: false, river: null, riverRecorded: false },
      currentStep: 'gameSelector',
      handCount: 0,
      gameDate: null,
      gameMode: 'dealer_centric',
    });
    fetchSessions.mockResolvedValue([]);
    fetchPlayers.mockResolvedValue([
      { player_id: 1, name: 'Alice' },
      { player_id: 2, name: 'Bob' },
    ]);
    fetchHands.mockResolvedValue([]);
    fetchHand.mockResolvedValue({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
  });

  afterEach(() => {
    if (activeRoot) {
      act(() => {
        activeRoot?.unmount();
        activeRoot = null;
      });
    }
    sessionStorage.clear();
  });

  it('initialState starts at gameSelector step', () => {
    expect(useDealerStore.getState().currentStep).toBe('gameSelector');
  });

  it('renders GameSelector on initial load', async () => {
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });
    expect(container.textContent).toContain('Games');
  });

  it('tapping New Game transitions to GameCreateForm', async () => {
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="new-game-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('New Game');
      // GameCreateForm has a date input and player fieldset
      expect(container.querySelector('input[type="date"]')).not.toBeNull();
    });
  });

  it('after game creation, transitions to HandDashboard', async () => {
    createSession.mockResolvedValue({
      game_id: 99,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-09',
    });

    const container = renderToContainer(<DealerApp />);

    // Start at GameSelector
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });

    // Go to GameCreateForm
    container.querySelector('[data-testid="new-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('input[type="date"]')).not.toBeNull();
    });

    // Wait for players to load
    await vi.waitFor(() => {
      const chips = container.querySelectorAll('button[type="button"]');
      const aliceChip = Array.from(chips).find(b => b.textContent === 'Alice');
      expect(aliceChip).not.toBeUndefined();
    });

    // Select 2 players
    Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Alice').click();
    Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Bob').click();

    // Wait for submit button to become enabled
    await vi.waitFor(() => {
      const btn = Array.from(container.querySelectorAll('button[type="submit"]'))
        .find(b => b.textContent.includes('Create Game'));
      expect(btn).not.toBeUndefined();
      expect(btn.disabled).toBe(false);
    });

    // Submit the form (happy-dom doesn't trigger form submit from button.click)
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    // Should transition to dashboard (HandDashboard has new-hand-btn)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
  });

  it('clicking an existing game card transitions to HandDashboard', async () => {
    fetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 3, hand_count: 5 },
    ]);
    fetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob', 'Charlie'],
      hand_count: 5,
    });

    const container = renderToContainer(<DealerApp />);

    // Wait for game card to appear
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });

    // Click the game card
    container.querySelector('[data-testid="game-card"]').click();

    // Should transition to HandDashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
  });

  it('selecting existing game fetches players and shows them on playerGrid', async () => {
    fetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 3, hand_count: 1 },
    ]);
    fetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob', 'Charlie'],
      hand_count: 1,
    });
    fetchHands.mockResolvedValue([
      { hand_number: 1, hand_id: 1, player_hands: [] },
    ]);

    const container = renderToContainer(<DealerApp />);

    // Select the game
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });
    container.querySelector('[data-testid="game-card"]').click();

    // Wait for dashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-row"]')).not.toBeNull();
    });

    // Click the hand to go to playerGrid
    container.querySelector('[data-testid="hand-row"]').click();

    // Player tiles should be visible
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-tile-Alice"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="player-tile-Bob"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="player-tile-Charlie"]')).not.toBeNull();
    });
  });

  it('selecting existing hand hydrates player tiles with terminal state', async () => {
    fetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 2, hand_count: 1 },
    ]);
    fetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob'],
      hand_count: 1,
    });
    fetchHands.mockResolvedValue([
      { hand_number: 1, hand_id: 1, player_hands: [
        { player_hand_id: 1, player_name: 'Alice', result: 'won' },
        { player_hand_id: 2, player_name: 'Bob', result: 'lost' },
      ]},
    ]);
    fetchHand.mockResolvedValue({
      hand_number: 1,
      flop_1: '2H', flop_2: '3C', flop_3: '5D',
      turn: 'JS', river: null,
      player_hands: [
        { player_name: 'Alice', card_1: 'AH', card_2: 'KD', result: 'won', profit_loss: 50 },
        { player_name: 'Bob', card_1: '9S', card_2: 'TC', result: 'lost', profit_loss: -50 },
      ],
    });

    const container = renderToContainer(<DealerApp />);

    // Select the game
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });
    container.querySelector('[data-testid="game-card"]').click();

    // Wait for dashboard with hand row
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-row"]')).not.toBeNull();
    });

    // Click the hand
    container.querySelector('[data-testid="hand-row"]').click();

    // Player tiles should show terminal status, not "playing"
    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]');
      expect(aliceRow).not.toBeNull();
      expect(aliceRow.textContent).toContain('won');

      const bobRow = container.querySelector('[data-testid="player-row-Bob"]');
      expect(bobRow).not.toBeNull();
      expect(bobRow.textContent).toContain('lost');
    });

    // Community should show as recorded (check mark on flop tile)
    const flopTile = container.querySelector('[data-testid="flop-tile"]');
    expect(flopTile.textContent).toContain('✅');
  });

  it('HandDashboard Back button returns to GameSelector', async () => {
    createSession.mockResolvedValue({
      game_id: 99,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-09',
    });

    const container = renderToContainer(<DealerApp />);

    // Navigate: GameSelector → Create → Dashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });
    container.querySelector('[data-testid="new-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('input[type="date"]')).not.toBeNull();
    });

    // Wait for players to load
    await vi.waitFor(() => {
      const chips = container.querySelectorAll('button[type="button"]');
      expect(Array.from(chips).find(b => b.textContent === 'Alice')).not.toBeUndefined();
    });

    // Select players
    Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Alice').click();
    Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Bob').click();

    // Wait for submit to be enabled and click
    await vi.waitFor(() => {
      const btn = Array.from(container.querySelectorAll('button[type="submit"]'))
        .find(b => b.textContent.includes('Create Game'));
      expect(btn.disabled).toBe(false);
    });
    container.querySelector('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="back-btn"]')).not.toBeNull();
    });

    // Click Back — should return to GameSelector
    container.querySelector('[data-testid="back-btn"]').click();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
      expect(container.textContent).toContain('Games');
    });
  });
});
