/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';

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
}));

vi.mock('./CameraCapture.jsx', () => ({
  CameraCapture: () => <div data-testid="camera-capture" />,
}));

vi.mock('./DetectionReview.jsx', () => ({
  DetectionReview: () => <div data-testid="detection-review" />,
}));

// Use real dealerState (no mock override) — initialState.currentStep should be 'gameSelector'

import {
  createSession,
  fetchPlayers,
  fetchSessions,
  fetchHands,
} from '../api/client.js';
import { DealerApp } from './DealerApp.jsx';
import { initialState } from './dealerState.js';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

describe('GameSelector integration in DealerApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSessions.mockResolvedValue([]);
    fetchPlayers.mockResolvedValue([
      { player_id: 1, name: 'Alice' },
      { player_id: 2, name: 'Bob' },
    ]);
    fetchHands.mockResolvedValue([]);
  });

  it('initialState starts at gameSelector step', () => {
    expect(initialState.currentStep).toBe('gameSelector');
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
