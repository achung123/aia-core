/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { PlayerApp } from './PlayerApp.tsx';

vi.mock('../api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchGame: vi.fn(),
  fetchHands: vi.fn(),
  fetchHandStatus: vi.fn(),
  uploadImage: vi.fn(),
  getDetectionResults: vi.fn(),
  updateHolecards: vi.fn(),
  patchPlayerResult: vi.fn(),
}));

import {
  fetchSessions,
  fetchGame,
  fetchHands,
  fetchHandStatus,
  uploadImage,
  getDetectionResults,
  updateHolecards,
  patchPlayerResult,
} from '../api/client.ts';

const mockFetchSessions = fetchSessions as ReturnType<typeof vi.fn>;
const mockFetchGame = fetchGame as ReturnType<typeof vi.fn>;
const mockFetchHands = fetchHands as ReturnType<typeof vi.fn>;
const mockFetchHandStatus = fetchHandStatus as ReturnType<typeof vi.fn>;
const mockUploadImage = uploadImage as ReturnType<typeof vi.fn>;
const mockGetDetectionResults = getDetectionResults as ReturnType<typeof vi.fn>;
const mockUpdateHolecards = updateHolecards as ReturnType<typeof vi.fn>;
const mockPatchPlayerResult = patchPlayerResult as ReturnType<typeof vi.fn>;

let root: Root | null = null;

function renderToContainer(element: React.ReactElement): HTMLDivElement {
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => { root!.render(element); });
  return container;
}

const SESSIONS = [
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3, winners: [] },
  { game_id: 3, game_date: '2026-04-06', status: 'active', player_count: 5, hand_count: 1, winners: null },
  { game_id: 4, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8, winners: ['Bob'] },
];

describe('PlayerApp', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    window.location.hash = originalHash;
  });

  it('shows loading state initially', () => {
    mockFetchSessions.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    expect(container.textContent).toContain('Loading');
  });

  it('renders only active games (no completed games)', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    // Only active games: id=3 and id=2
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
    // Completed games should not appear
    expect(container.textContent).not.toContain('#1');
    expect(container.textContent).not.toContain('#4');
  });

  it('sorts active games by game_id descending', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
  });

  it('selecting a game transitions to name picker step', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue({ game_id: 3, player_names: ['Alice', 'Bob'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    act(() => { (cards[0] as HTMLElement).click(); });

    await vi.waitFor(() => {
      // After clicking, should no longer show game cards
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      // Should show game id selected context
      expect(container.textContent).toContain('Game #3');
    });
  });

  it('auto-selects game from ?game= URL param and skips picker', async () => {
    window.location.hash = '#/player?game=2';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue({ game_id: 2, player_names: ['Dan', 'Eve'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      // Should not show game cards — auto-selected
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      expect(container.textContent).toContain('Game #2');
    });
  });

  it('shows error when ?game= references an invalid game', async () => {
    window.location.hash = '#/player?game=999';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('not found');
    });
  });

  it('shows error when fetchSessions fails', async () => {
    mockFetchSessions.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('shows empty message when no active games', async () => {
    mockFetchSessions.mockResolvedValue([
      { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
    ]);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No active games');
    });
  });

  it('displays game date and player count on cards', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards[0].textContent).toContain('2026-04-06');
    expect(cards[0].textContent).toContain('5 players');
    expect(cards[1].textContent).toContain('2026-04-05');
    expect(cards[1].textContent).toContain('6 players');
  });
});

const GAME_DETAIL = {
  game_id: 3,
  game_date: '2026-04-06',
  status: 'active',
  player_names: ['Alice', 'Bob', 'Charlie'],
  hand_count: 1,
  winners: [],
};

describe('PlayerApp — name picker', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
    // Default mocks so polling in 'playing' step doesn't crash
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchHandStatus.mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [],
    });
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    window.location.hash = originalHash;
  });

  it('fetches game details and shows player names as buttons', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      const playerBtns = container.querySelectorAll('[data-testid="player-name-btn"]');
      expect(playerBtns.length).toBe(3);
      expect(playerBtns[0].textContent).toContain('Alice');
      expect(playerBtns[1].textContent).toContain('Bob');
      expect(playerBtns[2].textContent).toContain('Charlie');
    });
  });

  it('shows loading while fetching players', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Loading players');
    });
  });

  it('shows message when game has no players', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue({ ...GAME_DETAIL, player_names: [] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No players');
    });
  });

  it('selecting a name transitions to playing step with welcome message', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    act(() => { container.querySelectorAll('[data-testid="player-name-btn"]')[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('Change Player button returns to name picker', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    act(() => { container.querySelectorAll('[data-testid="player-name-btn"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Alice');
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="change-player-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });
  });

  it('auto-selected game via URL also fetches players', async () => {
    window.location.hash = '#/player?game=2';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue({
      ...GAME_DETAIL,
      game_id: 2,
      player_names: ['Dan', 'Eve'],
    });
    const container = renderToContainer(<PlayerApp />);

    await vi.waitFor(() => {
      const playerBtns = container.querySelectorAll('[data-testid="player-name-btn"]');
      expect(playerBtns.length).toBe(2);
      expect(playerBtns[0].textContent).toContain('Dan');
      expect(playerBtns[1].textContent).toContain('Eve');
    });
  });

  it('auto-selects game AND player when both are in URL, skipping name pick', async () => {
    window.location.hash = '#/player?game=2&player=Bob';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchHandStatus.mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Bob', participation_status: 'idle', card_1: null, card_2: null, result: null, outcome_street: null },
      ],
    });
    const container = renderToContainer(<PlayerApp />);

    // Should go straight to playing step, not name pick
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Game #2');
      expect(container.textContent).toContain('Waiting for hand');
    });
    // Should NOT show name pick buttons
    expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(0);
  });
});

/* ---- Helper: navigate to playing step ---- */
async function goToPlaying(container: HTMLDivElement, playerIndex = 1, { hands, handStatus }: { hands?: { hand_number: number }[]; handStatus?: Record<string, unknown> } = {}) {
  mockFetchSessions.mockResolvedValue(SESSIONS);
  mockFetchGame.mockResolvedValue(GAME_DETAIL);
  mockFetchHands.mockResolvedValue(hands || [{ hand_number: 1 }]);
  if (handStatus) {
    mockFetchHandStatus.mockResolvedValue(handStatus);
  } else if (!mockFetchHandStatus.getMockImplementation()) {
    mockFetchHandStatus.mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: GAME_DETAIL.player_names.map(name => ({
        name,
        participation_status: 'idle',
        card_1: null,
        card_2: null,
        result: null,
        outcome_street: null,
      })),
    });
  }

  root = createRoot(container);
  act(() => { root!.render(<PlayerApp />); });
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
  });
  act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
  });
  act(() => { container.querySelectorAll('[data-testid="player-name-btn"]')[playerIndex].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

const HAND_STATUS_IDLE = {
  hand_number: 1,
  community_recorded: false,
  players: GAME_DETAIL.player_names.map(name => ({
    name,
    participation_status: 'idle',
    card_1: null,
    card_2: null,
    result: null,
    outcome_street: null,
  })),
};

function makeStatus(playerName: string, status: string, extras: Record<string, unknown> = {}) {
  return {
    hand_number: 1,
    community_recorded: false,
    players: GAME_DETAIL.player_names.map(name => ({
      name,
      participation_status: name === playerName ? status : 'idle',
      card_1: null,
      card_2: null,
      result: null,
      outcome_street: null,
      ...((name === playerName) ? extras : {}),
    })),
  };
}

describe('PlayerApp — polling and status', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('fetches hands list and starts polling hand status after name selection', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(mockFetchHands).toHaveBeenCalledWith(3, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledWith(3, 1, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('polls hand status every 3 seconds', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledTimes(1);
    });

    mockFetchHandStatus.mockResolvedValue(HAND_STATUS_IDLE);
    act(() => { vi.advanceTimersByTime(3000); });
    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledTimes(2);
    });

    act(() => { vi.advanceTimersByTime(3000); });
    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledTimes(3);
    });
  });

  it('stops polling on unmount (no leaked intervals)', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledTimes(1);
    });

    // Unmount
    act(() => { root!.unmount(); });
    root = null;

    const callsBefore = mockFetchHandStatus.mock.calls.length;
    act(() => { vi.advanceTimersByTime(6000); });
    expect(mockFetchHandStatus).toHaveBeenCalledTimes(callsBefore);
  });

  it('shows "Waiting for hand…" when status is idle', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('shows "Your turn!" when status is pending', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('shows "Cards submitted" when status is joined', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });
  });

  it('shows "Folded" when status is folded', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'folded', { result: 'folded' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Folded');
    });
  });

  it('shows "Waiting for dealer" when status is handed_back', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'handed_back', { result: 'handed_back' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });
  });

  it('shows "You won!" when status is won', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'won', { result: 'won' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('You won');
    });
  });

  it('shows "You lost" when status is lost', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'lost', { result: 'lost' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('You lost');
    });
  });

  it('uses the latest hand number from fetchHands', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, {
      hands: [{ hand_number: 1 }, { hand_number: 2 }, { hand_number: 3 }],
      handStatus: { ...HAND_STATUS_IDLE, hand_number: 3 },
    });

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalledWith(3, 3, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('updates UI when status changes on subsequent polls', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    // Next poll returns pending
    mockFetchHandStatus.mockResolvedValue(makeStatus('Bob', 'pending'));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('stops polling when returning to name picker via Change Player', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalled();
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="change-player-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    const callsBefore = mockFetchHandStatus.mock.calls.length;
    act(() => { vi.advanceTimersByTime(6000); });
    expect(mockFetchHandStatus).toHaveBeenCalledTimes(callsBefore);
  });
});

describe('PlayerApp — camera capture flow', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows Capture Cards button when status is pending', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="capture-cards-btn"]');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toContain('Capture Cards');
    });
  });

  it('does NOT show Capture Cards button when status is idle', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    const btn = container.querySelector('[data-testid="capture-cards-btn"]');
    expect(btn).toBeNull();
  });

  it('does NOT show Capture Cards button when status is joined', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    const btn = container.querySelector('[data-testid="capture-cards-btn"]');
    expect(btn).toBeNull();
  });

  it('tapping Capture Cards opens camera capture overlay', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="capture-cards-btn"]')!.click(); });

    await vi.waitFor(() => {
      // CameraCapture renders an overlay with "Open Camera" button
      expect(container.textContent).toContain('Open Camera');
    });
  });

  it('cancelling camera capture returns to pending state', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="capture-cards-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    // Click the Cancel button in CameraCapture
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
    act(() => { cancelBtn!.click(); });

    await vi.waitFor(() => {
      // Should be back to showing Capture Cards button
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });
  });

  it('after detection, shows review screen and confirm submits cards', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });

    mockUploadImage.mockResolvedValue({ upload_id: 'u1' });
    mockGetDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="capture-cards-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    // Simulate file input change
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });

    // After upload + detection, should show DetectionReview
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
      expect(container.textContent).toContain('Confirm');
    });

    // Confirm the detection
    mockUpdateHolecards.mockResolvedValue({});

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    await act(async () => { confirmBtn!.click(); });

    await vi.waitFor(() => {
      expect(mockUpdateHolecards).toHaveBeenCalledWith(3, 1, 'Bob', {
        card_1: 'Ah',
        card_2: 'Ks',
      });
    });
  });

  it('shows error message when updateHolecards fails and allows retry', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });

    mockUploadImage.mockResolvedValue({ upload_id: 'u1' });
    mockGetDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="capture-cards-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
    });

    mockUpdateHolecards.mockRejectedValue(new Error('Server error'));

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    await act(async () => { confirmBtn!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });

    // Should show a retry button
    const retryBtn = container.querySelector('[data-testid="capture-retry-btn"]');
    expect(retryBtn).not.toBeNull();
  });

  it('on success returns to polling state', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="capture-cards-btn"]')).not.toBeNull();
    });

    mockUploadImage.mockResolvedValue({ upload_id: 'u1' });
    mockGetDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="capture-cards-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
    });

    mockUpdateHolecards.mockResolvedValue({});
    mockFetchHandStatus.mockResolvedValue(makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }));

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    await act(async () => { confirmBtn!.click(); });

    // After success, should go back to status view (no review/camera screen)
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Review Detection');
      expect(container.textContent).not.toContain('Open Camera');
    });
  });
});

describe('PlayerApp — hand back cards action', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows Hand Back Cards button when status is joined', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="hand-back-btn"]');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toContain('Hand Back Cards');
    });
  });

  it('does NOT show Hand Back Cards button when status is idle', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('does NOT show Hand Back Cards button when status is pending', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('does NOT show Hand Back Cards button when status is handed_back', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'handed_back', { result: 'handed_back' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('calls patchPlayerResult with handed_back on tap', async () => {
    mockPatchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    await act(async () => { container.querySelector<HTMLElement>('[data-testid="hand-back-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(mockPatchPlayerResult).toHaveBeenCalledWith(3, 1, 'Bob', { result: 'handed_back' });
    });
  });

  it('shows error and retry when hand-back API fails', async () => {
    mockPatchPlayerResult.mockRejectedValue(new Error('Server error'));
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    await act(async () => { container.querySelector<HTMLElement>('[data-testid="hand-back-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });

    // Retry button should be visible
    const retryBtn = container.querySelector('[data-testid="hand-back-retry-btn"]');
    expect(retryBtn).not.toBeNull();

    // Retry should call API again
    mockPatchPlayerResult.mockResolvedValue({});
    await act(async () => { (retryBtn as HTMLElement).click(); });

    await vi.waitFor(() => {
      expect(mockPatchPlayerResult).toHaveBeenCalledTimes(2);
    });
  });

  it('disables button while API call is in-flight', async () => {
    let resolveApi: (value: unknown) => void;
    mockPatchPlayerResult.mockImplementation(() => new Promise(r => { resolveApi = r; }));
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="hand-back-btn"]')!.click(); });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="hand-back-btn"]') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Handing back');
    });

    await act(async () => { resolveApi!({}); });
  });

  it('polling picks up handed_back status and shows waiting message', async () => {
    mockPatchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    await act(async () => { container.querySelector<HTMLElement>('[data-testid="hand-back-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(mockPatchPlayerResult).toHaveBeenCalled();
    });

    // Next poll returns handed_back status
    mockFetchHandStatus.mockResolvedValue(makeStatus('Bob', 'handed_back', { result: 'handed_back' }));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });

    // Hand back button should be gone
    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });
});

describe('PlayerApp — polling edge cases', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows "No hands yet" when fetchHands returns empty array', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { hands: [] });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="no-active-hand"]')).not.toBeNull();
      expect(container.textContent).toContain('No hands yet');
    });

    // Player status controls should not be shown
    expect(container.querySelector('[data-testid="capture-cards-btn"]')).toBeNull();
  });

  it('recovers from empty hands when a new hand appears', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { hands: [] });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No hands yet');
    });

    // Next poll cycle: a hand now exists
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchHandStatus.mockResolvedValue(makeStatus('Bob', 'pending'));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="no-active-hand"]')).toBeNull();
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('detects hand number change and resets status', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    // New hand starts — hand_number changes from 1 to 2
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }, { hand_number: 2 }]);
    mockFetchHandStatus.mockResolvedValue({
      hand_number: 2,
      community_recorded: false,
      players: GAME_DETAIL.player_names.map(name => ({
        name,
        participation_status: 'idle',
        card_1: null,
        card_2: null,
        result: null,
        outcome_street: null,
      })),
    });
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('handles network error on fetchHands without crashing', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalled();
    });

    // Next poll: fetchHands network error
    mockFetchHands.mockRejectedValue(new Error('Network error'));
    act(() => { vi.advanceTimersByTime(3000); });

    // Should show poll error but not crash
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="poll-error"]')).not.toBeNull();
    });

    // Component should still be mounted and functional
    expect(container.textContent).toContain('Player Mode');
    expect(container.querySelector('[data-testid="change-player-btn"]')).not.toBeNull();
  });

  it('handles network error on fetchHandStatus without crashing', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalled();
    });

    // Next poll: fetchHandStatus network error
    mockFetchHandStatus.mockRejectedValue(new Error('Server error'));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="poll-error"]')).not.toBeNull();
    });

    // Should recover on next successful poll
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchHandStatus.mockResolvedValue(makeStatus('Bob', 'pending'));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="poll-error"]')).toBeNull();
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('clears poll error on successful recovery', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatus).toHaveBeenCalled();
    });

    // Error poll
    mockFetchHands.mockRejectedValue(new Error('Timeout'));
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="poll-error"]')).not.toBeNull();
    });

    // Recovery poll
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchHandStatus.mockResolvedValue(HAND_STATUS_IDLE);
    act(() => { vi.advanceTimersByTime(3000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="poll-error"]')).toBeNull();
    });
  });
});

describe('PlayerApp — button alignment', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    if (root) { act(() => { root!.unmount(); }); root = null; }
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('capture-cards-btn is full width', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="capture-cards-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.style.width).toBe('100%');
    });
  });

  it('change-player-btn is full width', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="change-player-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.style.width).toBe('100%');
    });
  });

  it('capture-cards-btn and change-player-btn have the same minHeight', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const capture = container.querySelector('[data-testid="capture-cards-btn"]') as HTMLElement;
      const change = container.querySelector('[data-testid="change-player-btn"]') as HTMLElement;
      expect(capture).not.toBeNull();
      expect(change).not.toBeNull();
      expect(capture.style.minHeight).toBe(change.style.minHeight);
    });
  });
});
