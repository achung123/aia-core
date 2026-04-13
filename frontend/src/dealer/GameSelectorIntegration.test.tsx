/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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
  fetchGame: vi.fn(() => Promise.resolve({ players: [] })),
  fetchHand: vi.fn(),
  fetchGameStats: vi.fn(() => Promise.resolve({ player_stats: [] })),
  createRebuy: vi.fn(),
  fetchHandStatus: vi.fn(() => Promise.resolve({ hand_number: 1, community_recorded: false, players: [] })),
  fetchBlinds: vi.fn(() => Promise.resolve({ small_blind: 0.25, big_blind: 0.50, blind_timer_minutes: 15, blind_timer_paused: false, blind_timer_started_at: null, blind_timer_remaining_seconds: null })),
}));

vi.mock('./CameraCapture.tsx', () => ({
  CameraCapture: () => <div data-testid="camera-capture" />,
}));

vi.mock('./DetectionReview.tsx', () => ({
  DetectionReview: () => <div data-testid="detection-review" />,
}));

vi.mock('../scenes/pokerScene.ts', () => ({
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

vi.mock('./GamePlayerManagement.tsx', () => ({
  GamePlayerManagement: ({ gameId }: { gameId: number }) =>
    <div data-testid="game-player-management">Players:{gameId}</div>,
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

const mockedCreateSession = createSession as ReturnType<typeof vi.fn>;
const mockedFetchPlayers = fetchPlayers as ReturnType<typeof vi.fn>;
const mockedFetchSessions = fetchSessions as ReturnType<typeof vi.fn>;
const mockedFetchHands = fetchHands as ReturnType<typeof vi.fn>;
const mockedFetchGame = fetchGame as ReturnType<typeof vi.fn>;
const mockedFetchHand = fetchHand as ReturnType<typeof vi.fn>;

function renderApp(): HTMLElement {
  const { container } = render(<DealerApp />);
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
    });
    mockedFetchSessions.mockResolvedValue([]);
    mockedFetchPlayers.mockResolvedValue([
      { player_id: 1, name: 'Alice' },
      { player_id: 2, name: 'Bob' },
    ]);
    mockedFetchHands.mockResolvedValue([]);
    mockedFetchHand.mockResolvedValue({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('initialState starts at gameSelector step', () => {
    expect(useDealerStore.getState().currentStep).toBe('gameSelector');
  });

  it('renders GameSelector on initial load', async () => {
    const container = renderApp();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });
    expect(container.textContent).toContain('Games');
  });

  it('tapping New Game transitions to GameCreateForm', async () => {
    const container = renderApp();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });

    container.querySelector<HTMLElement>('[data-testid="new-game-btn"]')!.click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('New Game');
      // GameCreateForm has a date input and player fieldset
      expect(container.querySelector('input[type="date"]')).not.toBeNull();
    });
  });

  it('after game creation, transitions to HandDashboard', async () => {
    mockedCreateSession.mockResolvedValue({
      game_id: 99,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-09',
    });

    const container = renderApp();

    // Start at GameSelector
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });

    // Go to GameCreateForm
    container.querySelector<HTMLElement>('[data-testid="new-game-btn"]')!.click();
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
    (Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Alice') as HTMLButtonElement).click();
    (Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Bob') as HTMLButtonElement).click();

    // Wait for submit button to become enabled
    await vi.waitFor(() => {
      const btn = Array.from(container.querySelectorAll('button[type="submit"]'))
        .find(b => b.textContent?.includes('Create Game'));
      expect(btn).not.toBeUndefined();
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    // Submit the form (happy-dom doesn't trigger form submit from button.click)
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    // Should transition directly to HandDashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });

  it('clicking an existing game card transitions to HandDashboard', async () => {
    mockedFetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 3, hand_count: 5 },
    ]);
    mockedFetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob', 'Charlie'],
      hand_count: 5,
    });

    const container = renderApp();

    // Wait for game card to appear
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });

    // Click the game card
    container.querySelector<HTMLElement>('[data-testid="game-card"]')!.click();

    // Should transition directly to HandDashboard (dashboard step)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });

  it('selecting existing game fetches players and shows them on activeHand', async () => {
    mockedFetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 3, hand_count: 1 },
    ]);
    mockedFetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob', 'Charlie'],
      hand_count: 1,
    });
    mockedFetchHands.mockResolvedValue([
      { hand_number: 1, hand_id: 1, player_hands: [] },
    ]);

    const container = renderApp();

    // Select the game
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });
    container.querySelector<HTMLElement>('[data-testid="game-card"]')!.click();

    // Wait for dashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-row"]')).not.toBeNull();
    });

    // Click the hand to go to activeHand
    container.querySelector<HTMLElement>('[data-testid="hand-row"]')!.click();

    // Player tiles should be visible
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-tile-Alice"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="player-tile-Bob"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="player-tile-Charlie"]')).not.toBeNull();
    });
  });

  it('selecting existing hand hydrates player tiles with terminal state', async () => {
    mockedFetchSessions.mockResolvedValue([
      { game_id: 42, game_date: '2026-04-08', status: 'active', player_count: 2, hand_count: 1 },
    ]);
    mockedFetchGame.mockResolvedValue({
      game_id: 42,
      game_date: '2026-04-08',
      status: 'active',
      player_names: ['Alice', 'Bob'],
      hand_count: 1,
    });
    mockedFetchHands.mockResolvedValue([
      { hand_number: 1, hand_id: 1, player_hands: [
        { player_hand_id: 1, player_name: 'Alice', result: 'won' },
        { player_hand_id: 2, player_name: 'Bob', result: 'lost' },
      ]},
    ]);
    mockedFetchHand.mockResolvedValue({
      hand_number: 1,
      flop_1: '2H', flop_2: '3C', flop_3: '5D',
      turn: 'JS', river: null,
      player_hands: [
        { player_name: 'Alice', card_1: 'AH', card_2: 'KD', result: 'won', profit_loss: 50 },
        { player_name: 'Bob', card_1: '9S', card_2: 'TC', result: 'lost', profit_loss: -50 },
      ],
    });

    const container = renderApp();

    // Select the game
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="game-card"]')).not.toBeNull();
    });
    container.querySelector<HTMLElement>('[data-testid="game-card"]')!.click();

    // Wait for dashboard with hand row
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-row"]')).not.toBeNull();
    });

    // Click the hand
    container.querySelector<HTMLElement>('[data-testid="hand-row"]')!.click();

    // Player tiles should show terminal status, not "playing"
    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]');
      expect(aliceRow).not.toBeNull();
      expect(aliceRow!.textContent).toContain('won');

      const bobRow = container.querySelector('[data-testid="player-row-Bob"]');
      expect(bobRow).not.toBeNull();
      expect(bobRow!.textContent).toContain('lost');
    });

    // Community should show as recorded (check mark on flop tile)
    const flopTile = container.querySelector('[data-testid="flop-tile"]');
    expect(flopTile!.textContent).toContain('✅');
  });

  it('HandDashboard Back button returns to GameSelector', async () => {
    mockedCreateSession.mockResolvedValue({
      game_id: 99,
      player_names: ['Alice', 'Bob'],
      game_date: '2026-04-09',
    });

    const container = renderApp();

    // Navigate: GameSelector → Create → Dashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
    });
    container.querySelector<HTMLElement>('[data-testid="new-game-btn"]')!.click();
    await vi.waitFor(() => {
      expect(container.querySelector('input[type="date"]')).not.toBeNull();
    });

    // Wait for players to load
    await vi.waitFor(() => {
      const chips = container.querySelectorAll('button[type="button"]');
      expect(Array.from(chips).find(b => b.textContent === 'Alice')).not.toBeUndefined();
    });

    // Select players
    (Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Alice') as HTMLButtonElement).click();
    (Array.from(container.querySelectorAll('button[type="button"]'))
      .find(b => b.textContent === 'Bob') as HTMLButtonElement).click();

    // Wait for submit to be enabled and click
    await vi.waitFor(() => {
      const btn = Array.from(container.querySelectorAll('button[type="submit"]'))
        .find(b => b.textContent?.includes('Create Game'));
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );

    // Goes directly to dashboard
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="back-btn"]')).not.toBeNull();
    });

    // Click Back — should return to GameSelector
    container.querySelector<HTMLElement>('[data-testid="back-btn"]')!.click();

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-game-btn"]')).not.toBeNull();
      expect(container.textContent).toContain('Games');
    });
  });
});
