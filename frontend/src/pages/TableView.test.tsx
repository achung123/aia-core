/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock API client
vi.mock('../api/client.ts', () => ({
  fetchHands: vi.fn(),
  fetchHandStatus: vi.fn(),
  fetchPlayerEquity: vi.fn(() => Promise.resolve({ equities: [] })),
  fetchBlinds: vi.fn(() => Promise.resolve({
    small_blind: 0.10,
    big_blind: 0.20,
    blind_timer_minutes: 15,
    blind_timer_paused: false,
    blind_timer_started_at: null,
    blind_timer_remaining_seconds: null,
  })),
}));

// Mock seatCamera — track animation calls
const mockAnimateCancel = vi.fn();
const mockAnimateCameraToSeat = vi.fn(() => ({ cancel: mockAnimateCancel }));
vi.mock('../scenes/seatCamera.ts', () => ({
  computeSeatCameraPosition: vi.fn((seatPos: { x: number; z: number }) => ({
    position: { x: seatPos.x * 1.4, y: 6, z: seatPos.z * 1.4 },
    target: { x: 0, y: 0, z: 0 },
  })),
  animateCameraToSeat: mockAnimateCameraToSeat,
  getDefaultCameraPosition: vi.fn(() => ({
    position: { x: 0, y: 14, z: 3 },
    target: { x: 0, y: 0, z: 0 },
  })),
  DEFAULT_OVERHEAD_POSITION: { x: 0, y: 14, z: 3 },
  DEFAULT_OVERHEAD_TARGET: { x: 0, y: 0, z: 0 },
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

import { fetchHands, fetchHandStatus, fetchPlayerEquity, fetchBlinds } from '../api/client.ts';
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
    sb_player_name: 'Alice',
    bb_player_name: 'Bob',
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null },
      { player_hand_id: 3, hand_id: 1, player_id: 3, player_name: 'Carol', card_1: null, card_2: null, result: 'folded', profit_loss: 0, outcome_street: null },
    ],
  },
];

const MULTI_HANDS: HandResponse[] = [
  {
    hand_id: 1,
    game_id: 5,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: 'Qc',
    turn: null,
    river: null,
    source_upload_id: null,
    sb_player_name: 'Alice',
    bb_player_name: 'Bob',
    created_at: '2026-04-10T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null },
    ],
  },
  {
    hand_id: 2,
    game_id: 5,
    hand_number: 2,
    flop_1: '9s',
    flop_2: '8c',
    flop_3: '7h',
    turn: '6d',
    river: null,
    source_upload_id: null,
    sb_player_name: 'Bob',
    bb_player_name: 'Alice',
    created_at: '2026-04-10T12:05:00Z',
    player_hands: [
      { player_hand_id: 3, hand_id: 2, player_id: 1, player_name: 'Alice', card_1: 'Th', card_2: 'Jh', result: 'won', profit_loss: 80, outcome_street: null },
      { player_hand_id: 4, hand_id: 2, player_id: 2, player_name: 'Bob', card_1: '2c', card_2: '3c', result: 'lost', profit_loss: -80, outcome_street: null },
    ],
  },
  {
    hand_id: 3,
    game_id: 5,
    hand_number: 3,
    flop_1: 'Ks',
    flop_2: 'Qs',
    flop_3: 'Js',
    turn: 'Ts',
    river: 'As',
    source_upload_id: null,
    sb_player_name: 'Alice',
    bb_player_name: 'Bob',
    created_at: '2026-04-10T12:10:00Z',
    player_hands: [
      { player_hand_id: 5, hand_id: 3, player_id: 1, player_name: 'Alice', card_1: '9s', card_2: '8s', result: null, profit_loss: 0, outcome_street: null },
      { player_hand_id: 6, hand_id: 3, player_id: 2, player_name: 'Bob', card_1: 'Ad', card_2: 'Kd', result: null, profit_loss: 0, outcome_street: null },
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

  /* ── Seat-snap camera view (T-037) ────────────────────────── */

  it('makes seat labels clickable (pointer-events auto)', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const label = screen.getByTestId('seat-label-0');
    expect(label.style.pointerEvents).toBe('auto');
    expect(label.style.cursor).toBe('pointer');
  });

  it('animates camera to seat when seat label is clicked', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    mockAnimateCameraToSeat.mockClear();
    const label = screen.getByTestId('seat-label-1');
    fireEvent.click(label);
    expect(mockAnimateCameraToSeat).toHaveBeenCalledOnce();
  });

  it('shows a Reset View button', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    const btn = screen.getByTestId('reset-view-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Reset View');
  });

  it('Reset View animates camera to default overhead position', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    mockAnimateCameraToSeat.mockClear();
    const btn = screen.getByTestId('reset-view-btn');
    fireEvent.click(btn);
    expect(mockAnimateCameraToSeat).toHaveBeenCalledOnce();
    // First two args: camera, controls — third arg should be the default overhead position
    const callArgs = mockAnimateCameraToSeat.mock.calls[0];
    expect(callArgs[2]).toEqual({ x: 0, y: 14, z: 3 });
  });

  it('defaults camera to player own seat on load', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // Should have animated to Alice's seat (index 0) on initial load
    expect(mockAnimateCameraToSeat).toHaveBeenCalled();
  });

  it('cancels previous animation when a new seat is clicked', async () => {
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    mockAnimateCancel.mockClear();
    // Click seat 0
    fireEvent.click(screen.getByTestId('seat-label-0'));
    // Click seat 1 — should cancel the previous animation
    fireEvent.click(screen.getByTestId('seat-label-1'));
    expect(mockAnimateCancel).toHaveBeenCalled();
  });

  /* ── Session scrubber (T-035) ─────────────────────────────── */

  it('renders a SessionScrubber when hands are loaded', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('session-scrubber')).toBeTruthy();
    });
  });

  it('scrubber defaults to the latest hand number', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('session-scrubber')).toBeTruthy();
    });
    // Latest hand is hand_number 3
    expect(screen.getByTestId('session-label').textContent).toBe('Hand 3 / 3');
  });

  it('scrubber label shows Hand X / Y format', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('session-label')).toBeTruthy();
    });
    expect(screen.getByTestId('session-label').textContent).toMatch(/^Hand \d+ \/ \d+$/);
  });

  it('scrubber slider has min=1 and max=total hands', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('session-slider')).toBeTruthy();
    });
    const slider = screen.getByTestId('session-slider') as HTMLInputElement;
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('3');
  });

  it('changing the scrubber updates the 3D scene with selected hand', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    mockSceneUpdate.mockClear();

    // Change scrubber to hand 1
    const slider = screen.getByTestId('session-slider');
    fireEvent.change(slider, { target: { value: '1' } });

    // Scene should be updated with hand 1's card data (flop: Ah, Kd, Qc)
    expect(mockSceneUpdate).toHaveBeenCalled();
    const call = mockSceneUpdate.mock.calls[0][0];
    expect(call.cardData.flop[0].rank).toBe('A');
  });

  it('does not render scrubber when there are no hands', async () => {
    vi.mocked(fetchHands).mockResolvedValue([]);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByText(/no hands found/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('session-scrubber')).toBeNull();
  });

  it('scrubber has touch-friendly 48px thumb styling', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('session-scrubber')).toBeTruthy();
    });
    // The SessionScrubber component injects a <style> tag with 48px thumb
    const styleTag = screen.getByTestId('session-scrubber').querySelector('style');
    expect(styleTag).toBeTruthy();
    expect(styleTag!.textContent).toContain('48px');
  });

  /* ── Adjusted equity display (T-033) ──────────────────────── */

  it('calls fetchPlayerEquity with game, hand, and player name (AC1)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.72 }],
    });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(vi.mocked(fetchPlayerEquity)).toHaveBeenCalledWith(5, 1, 'Alice');
    });
  });

  it('displays equity percentage near player cards (AC2)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.72 }],
    });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('equity-overlay')).toBeTruthy();
    });
    expect(screen.getByTestId('equity-overlay').textContent).toContain('72%');
  });

  it('recalculates equity when hand changes via scrubber (AC3)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.65 }],
    });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(vi.mocked(fetchPlayerEquity)).toHaveBeenCalled();
    });

    vi.mocked(fetchPlayerEquity).mockClear();
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.50 }],
    });

    // Change scrubber to hand 1
    const slider = screen.getByTestId('session-slider');
    fireEvent.change(slider, { target: { value: '1' } });

    await waitFor(() => {
      expect(vi.mocked(fetchPlayerEquity)).toHaveBeenCalledWith(5, 1, 'Alice');
    });
  });

  it('has a toggle button to show/hide equity (AC4)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.72 }],
    });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('equity-overlay')).toBeTruthy();
    });

    // Toggle button exists
    const toggleBtn = screen.getByTestId('equity-toggle-btn');
    expect(toggleBtn).toBeTruthy();

    // Click to hide
    fireEvent.click(toggleBtn);
    expect(screen.queryByTestId('equity-overlay')).toBeNull();

    // Click to show again
    fireEvent.click(toggleBtn);
    await waitFor(() => {
      expect(screen.getByTestId('equity-overlay')).toBeTruthy();
    });
  });

  it('shows preflop equity when no community cards (AC5)', async () => {
    const preflopHand: HandResponse[] = [{
      ...HANDS[0],
      flop_1: null,
      flop_2: null,
      flop_3: null,
      turn: null,
      river: null,
      player_hands: [
        { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'As', result: null, profit_loss: 0, outcome_street: null },
        { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: null, card_2: null, result: null, profit_loss: 0, outcome_street: null },
      ],
    }];
    vi.mocked(fetchHands).mockResolvedValue(preflopHand);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({
      equities: [{ player_name: 'Alice', equity: 0.85 }],
    });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(screen.getByTestId('equity-overlay')).toBeTruthy();
    });
    // Should show preflop equity
    expect(screen.getByTestId('equity-overlay').textContent).toContain('85%');
  });

  it('does not show equity overlay when no equity data returned', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchPlayerEquity).mockResolvedValue({ equities: [] });
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // Give time for equity fetch to complete
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByTestId('equity-overlay')).toBeNull();
  });

  it('handles equity fetch errors gracefully', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(fetchPlayerEquity).mockRejectedValue(new Error('Network error'));
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // Should not crash — no equity overlay shown
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByTestId('equity-overlay')).toBeNull();
  });

  /* ── Blind & position display (T-031) ─────────────────────── */

  it('renders BlindPositionDisplay with SB/BB from latest hand (AC1/AC2)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // BlindPositionDisplay should render with SB/BB from the hand fixture
    expect(screen.getByTestId('blind-position-display')).toBeTruthy();
    expect(screen.getByTestId('sb-label').textContent).toContain('Alice');
    expect(screen.getByTestId('bb-label').textContent).toContain('Bob');
  });

  it('highlights current player label when they are SB (AC3)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // Alice is SB in the HANDS fixture
    expect(screen.getByTestId('sb-label').getAttribute('data-highlight')).toBe('true');
    expect(screen.getByTestId('bb-label').getAttribute('data-highlight')).toBe('false');
  });

  it('updates SB/BB when scrubbing to a different hand (AC2)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(MULTI_HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(mockSceneUpdate).toHaveBeenCalled();
    });
    // Latest hand (3) has SB=Alice, BB=Bob
    expect(screen.getByTestId('sb-label').textContent).toContain('Alice');
    expect(screen.getByTestId('bb-label').textContent).toContain('Bob');

    // Scrub to hand 2 where SB=Bob, BB=Alice
    const slider = screen.getByTestId('session-slider');
    fireEvent.change(slider, { target: { value: '2' } });

    expect(screen.getByTestId('sb-label').textContent).toContain('Bob');
    expect(screen.getByTestId('bb-label').textContent).toContain('Alice');
    // Alice is now BB — highlight should flip
    expect(screen.getByTestId('bb-label').getAttribute('data-highlight')).toBe('true');
    expect(screen.getByTestId('sb-label').getAttribute('data-highlight')).toBe('false');
  });

  it('calls fetchBlinds for the blind level display (AC4)', async () => {
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    renderTableView('?game=5&player=Alice');
    await waitFor(() => {
      expect(vi.mocked(fetchBlinds)).toHaveBeenCalledWith(5);
    });
  });

  it('does not show blind display when loading or error', async () => {
    vi.mocked(fetchHands).mockReturnValue(new Promise(() => {}));
    renderTableView('?game=5&player=Alice');
    expect(screen.queryByTestId('blind-position-display')).toBeNull();
  });
});
