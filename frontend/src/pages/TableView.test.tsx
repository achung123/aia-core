/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock API client
vi.mock('../api/client.ts', () => ({
  fetchHands: vi.fn(),
  fetchHandStatus: vi.fn(),
}));

// Mock poker scene — no WebGL in happy-dom
const mockSceneUpdate = vi.fn();
const mockSceneDispose = vi.fn();
vi.mock('../scenes/pokerScene.ts', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    renderer: { domElement: document.createElement('canvas') },
    seatPositions: [
      { x: 4.3, y: 0, z: 0, clone: () => ({ project: () => ({ x: 0, y: 0, z: 0 }) }) },
      { x: 0, y: 0, z: 2.8, clone: () => ({ project: () => ({ x: 0.5, y: 0, z: 0 }) }) },
    ],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), goToPreFlop: vi.fn(), dispose: vi.fn() },
    communityCards: null,
    controls: {
      target: { set: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      saveState: vi.fn(),
      update: vi.fn(),
    },
    dispose: mockSceneDispose,
    update: mockSceneUpdate,
  })),
}));

import { fetchHands, fetchHandStatus } from '../api/client.ts';
import type { HandResponse } from '../api/types.ts';

// Lazy import so mocks are in place
const { TableView } = await import('./TableView.tsx');

const HANDS: HandResponse[] = [
  {
    hand_id: 1,
    game_id: 5,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: 'Qc',
    turn: 'Js',
    river: null,
    source_upload_id: null,
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null },
      { player_hand_id: 3, hand_id: 1, player_id: 3, player_name: 'Carol', card_1: null, card_2: null, result: 'folded', profit_loss: 0, outcome_street: null },
    ],
  },
];

function renderTableView(params: string = '?game=5&player=Alice') {
  return render(
    <MemoryRouter initialEntries={[`/player/table${params}`]}>
      <Routes>
        <Route path="/player/table" element={<TableView />} />
        <Route path="/player" element={<div data-testid="player-app">Player App</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TableView', () => {
  const origClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  const origClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    // happy-dom reports 0 dimensions — mock non-zero so scene init succeeds
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { get: () => 800, configurable: true });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { get: () => 600, configurable: true });
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchHandStatus).mockResolvedValue({
      hand_number: 1,
      community_recorded: true,
      players: [
        { name: 'Alice', participation_status: 'joined', card_1: '2h', card_2: '3h', result: null, outcome_street: null },
        { name: 'Bob', participation_status: 'joined', card_1: '4d', card_2: '5d', result: null, outcome_street: null },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    // Restore original descriptors
    if (origClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', origClientWidth);
    else delete (HTMLElement.prototype as Record<string, unknown>)['clientWidth'];
    if (origClientHeight) Object.defineProperty(HTMLElement.prototype, 'clientHeight', origClientHeight);
    else delete (HTMLElement.prototype as Record<string, unknown>)['clientHeight'];
  });

  it('renders a full-viewport canvas', () => {
    const { container } = renderTableView();
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('shows a Back to Hand button', () => {
    renderTableView();
    const btn = screen.getByTestId('back-to-hand-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Back to Hand');
  });

  it('navigates back to player screen on Back to Hand click', async () => {
    renderTableView();
    const btn = screen.getByTestId('back-to-hand-btn');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByTestId('player-app')).toBeTruthy();
    });
  });

  it('fetches hands for the game from URL params', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(vi.mocked(fetchHands)).toHaveBeenCalledWith(5, expect.any(Object));
    });
  });

  it('updates the scene with hand data showing only player cards face-up', async () => {
    // Use a hand without showdown results — only viewing player's cards shown
    const noResultHands: HandResponse[] = [{
      ...HANDS[0],
      player_hands: [
        { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: null, profit_loss: 0, outcome_street: null },
        { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: null, profit_loss: 0, outcome_street: null },
        { player_hand_id: 3, hand_id: 1, player_id: 3, player_name: 'Carol', card_1: null, card_2: null, result: null, profit_loss: 0, outcome_street: null },
      ],
    }];
    vi.mocked(fetchHands).mockResolvedValue(noResultHands);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const call = mockSceneUpdate.mock.calls[0][0];
    // Alice's cards should be present
    const alice = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Alice',
    );
    expect(alice.hole_cards).not.toBeNull();
    // Bob's cards should be masked (null) — no showdown
    const bob = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Bob',
    );
    expect(bob.hole_cards).toBeNull();
  });

  it('shows community cards from the hand', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const call = mockSceneUpdate.mock.calls[0][0];
    expect(call.cardData.flop).toHaveLength(3);
  });

  it('disposes scene on unmount', () => {
    const { unmount } = renderTableView();
    unmount();
    expect(mockSceneDispose).toHaveBeenCalled();
  });

  it('shows loading state before data arrives', () => {
    // Don't resolve the promise yet
    vi.mocked(fetchHands).mockReturnValue(new Promise(() => {}));
    renderTableView();
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('shows error when game param missing', () => {
    renderTableView('?player=Alice');
    expect(screen.getByText(/missing game/i)).toBeTruthy();
  });

  it('reveals all non-folded players cards at showdown', async () => {
    // HANDS fixture already has won/lost results — it's a showdown hand
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const call = mockSceneUpdate.mock.calls[0][0];
    // Alice (won) should have cards
    const alice = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Alice',
    );
    expect(alice.hole_cards).not.toBeNull();
    // Bob (lost, not folded) should also have cards revealed at showdown
    const bob = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Bob',
    );
    expect(bob.hole_cards).not.toBeNull();
    // Carol (folded) should still be null
    const carol = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Carol',
    );
    expect(carol.hole_cards).toBeNull();
  });

  it('sets streetIndex to 4 (showdown) when results include won/lost', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const call = mockSceneUpdate.mock.calls[0][0];
    expect(call.streetIndex).toBe(4);
  });

  it('does not reveal other players cards when no showdown results', async () => {
    const noShowdownHands: HandResponse[] = [{
      ...HANDS[0],
      player_hands: [
        { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: null, profit_loss: 0, outcome_street: null },
        { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: null, profit_loss: 0, outcome_street: null },
      ],
    }];
    vi.mocked(fetchHands).mockResolvedValue(noShowdownHands);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const call = mockSceneUpdate.mock.calls[0][0];
    const bob = call.cardData.player_hands.find(
      (p: { player_name: string }) => p.player_name === 'Bob',
    );
    expect(bob.hole_cards).toBeNull();
    // streetIndex should not be 4
    expect(call.streetIndex).not.toBe(4);
  });
});
