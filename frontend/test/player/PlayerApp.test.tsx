/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react';
import { PlayerApp } from '../../src/../src/player/PlayerApp.tsx';

vi.mock('../../src/api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchGame: vi.fn(),
  fetchHands: vi.fn(),
  fetchLatestHand: vi.fn(),
  fetchHandStatus: vi.fn(),
  fetchHandStatusConditional: vi.fn(),
  fetchGameStats: vi.fn(),
  uploadImage: vi.fn(),
  getDetectionResults: vi.fn(),
  updateHolecards: vi.fn(),
  patchPlayerResult: vi.fn(),
  recordPlayerAction: vi.fn(),
}));

const mockPlayerName = { current: 'Bob' as string | null };
vi.mock('../../src/stores/playerStore.ts', () => {
  const usePlayerStore = (selector: (s: { playerName: string | null; setPlayerName: (n: string | null) => void }) => unknown) =>
    selector({ playerName: mockPlayerName.current, setPlayerName: vi.fn() });
  return { usePlayerStore };
});

import {
  fetchSessions,
  fetchGame,
  fetchHands,
  fetchLatestHand,
  fetchHandStatusConditional,
  fetchGameStats,
  uploadImage,
  getDetectionResults,
  updateHolecards,
} from '../../src/api/client.ts';

const mockFetchSessions = fetchSessions as ReturnType<typeof vi.fn>;
const mockFetchGame = fetchGame as ReturnType<typeof vi.fn>;
const mockFetchHands = fetchHands as ReturnType<typeof vi.fn>;
const mockFetchLatestHand = fetchLatestHand as ReturnType<typeof vi.fn>;
const mockFetchHandStatusConditional = fetchHandStatusConditional as ReturnType<typeof vi.fn>;
const mockFetchGameStats = fetchGameStats as ReturnType<typeof vi.fn>;
const mockUploadImage = uploadImage as ReturnType<typeof vi.fn>;
const mockGetDetectionResults = getDetectionResults as ReturnType<typeof vi.fn>;
const mockUpdateHolecards = updateHolecards as ReturnType<typeof vi.fn>;

function renderToContainer(element: React.ReactElement): HTMLElement {
  const { container } = render(element);
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
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
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

  it('selecting a game transitions directly to playing step', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchLatestHand.mockResolvedValue(null);
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({ hand_number: 1, community_recorded: false, players: [] }));
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
      // Should show player name from store
      expect(container.textContent).toContain('Bob');
    });
  });

  it('auto-selects game from ?game= URL param and goes to playing', async () => {
    window.location.hash = '#/player?game=2';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchLatestHand.mockResolvedValue(null);
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({ hand_number: 1, community_recorded: false, players: [] }));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      // Should not show game cards — auto-selected
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      expect(container.textContent).toContain('Game #2');
      expect(container.textContent).toContain('Bob');
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
  players: [
    { name: 'Alice', is_active: true, seat_number: null, buy_in: null },
    { name: 'Bob', is_active: true, seat_number: null, buy_in: null },
    { name: 'Charlie', is_active: true, seat_number: null, buy_in: null },
  ],
  hand_count: 1,
  winners: [],
};

describe('PlayerApp — no player selected in navbar', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    originalHash = window.location.hash;
    window.location.hash = '';
    mockPlayerName.current = null;
    mockFetchLatestHand.mockResolvedValue(null);
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
      hand_number: 1,
      community_recorded: false,
      players: [],
    }));
  });

  afterEach(() => {
    cleanup();
    window.location.hash = originalHash;
  });

  it('shows prompt to select name from navbar when playerName is null', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="no-player-selected"]')).not.toBeNull();
      expect(container.textContent).toContain('Select your name from the dropdown above.');
    });
  });
});

/* ---- Helper: navigate to playing step ---- */
async function goToPlaying(playerIndex = 1, { hands, handStatus }: { hands?: { hand_number: number }[]; handStatus?: Record<string, unknown> } = {}): Promise<HTMLElement> {
  // Set the player name in the mock store based on index
  mockPlayerName.current = GAME_DETAIL.player_names[playerIndex];

  mockFetchSessions.mockResolvedValue(SESSIONS);
  mockFetchGame.mockResolvedValue(GAME_DETAIL);
  mockFetchHands.mockResolvedValue(hands || [{ hand_number: 1 }]);
  const handList = hands || [{ hand_number: 1 }];
  mockFetchLatestHand.mockResolvedValue(handList[handList.length - 1]);
  if (handStatus) {
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(handStatus));
  } else if (!mockFetchHandStatusConditional.getMockImplementation()) {
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
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
    }));
  }

  const { container } = render(<PlayerApp />);
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
  });
  act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  // Should go directly to playing — player name comes from store
  await vi.waitFor(() => {
    expect(container.textContent).toContain(GAME_DETAIL.player_names[playerIndex]);
  });
  return container;
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

function wrapConditional(data: Record<string, unknown>) {
  return { data, etag: '"test-etag"', notModified: false };
}

function makeStatus(playerName: string, status: string, extras: Record<string, unknown> = {}) {
  return {
    hand_number: 1,
    community_recorded: false,
    phase: 'preflop',
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
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('fetches hands list and starts polling hand status after name selection', async () => {
    await goToPlaying();

    await vi.waitFor(() => {
      expect(mockFetchLatestHand).toHaveBeenCalledWith(3, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledWith(3, 1, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('polls hand status every 5 seconds', async () => {
    await goToPlaying();

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(1);
    });

    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(HAND_STATUS_IDLE));
    act(() => { vi.advanceTimersByTime(5000); });
    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(2);
    });

    act(() => { vi.advanceTimersByTime(5000); });
    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(3);
    });
  });

  it('stops polling on unmount (no leaked intervals)', async () => {
    await goToPlaying();

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(1);
    });

    // Unmount
    cleanup();

    const callsBefore = mockFetchHandStatusConditional.mock.calls.length;
    act(() => { vi.advanceTimersByTime(10000); });
    expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(callsBefore);
  });

  it('shows "Waiting for hand…" when status is idle', async () => {
    const container = await goToPlaying(1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('shows "Your turn!" when status is pending', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('shows "Cards submitted" when status is joined', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });
  });

  it('shows "Folded" when status is folded', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'folded', { result: 'folded' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Folded');
    });
  });

  it('shows "Waiting for dealer" when status is handed_back', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'handed_back', { result: 'handed_back' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });
  });

  it('shows "You won!" when status is won', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'won', { result: 'won' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('You won');
    });
  });

  it('shows "You lost" when status is lost', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'lost', { result: 'lost' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('You lost');
    });
  });

  it('uses the latest hand number from fetchHands', async () => {
    await goToPlaying(1, {
      hands: [{ hand_number: 1 }, { hand_number: 2 }, { hand_number: 3 }],
      handStatus: { ...HAND_STATUS_IDLE, hand_number: 3 },
    });

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalledWith(3, 3, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('updates UI when status changes on subsequent polls', async () => {
    const container = await goToPlaying(1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    // Next poll returns pending
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(makeStatus('Bob', 'pending')));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('stops polling when leaving game via Leave Game', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalled();
    });

    act(() => { container.querySelector<HTMLElement>('[data-testid="leave-game-btn"]')!.click(); });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const callsBefore = mockFetchHandStatusConditional.mock.calls.length;
    act(() => { vi.advanceTimersByTime(10000); });
    expect(mockFetchHandStatusConditional).toHaveBeenCalledTimes(callsBefore);
  });

  it('does not show action buttons when pending even if is_current_turn is true', async () => {
    const container = await goToPlaying(1, {
      handStatus: makeStatus('Bob', 'pending', { is_current_turn: true }),
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
    expect(container.querySelector('[data-testid="action-buttons"]')).toBeNull();
  });

  it('does not show action buttons when pending and is_current_turn is false', async () => {
    const container = await goToPlaying(1, {
      handStatus: makeStatus('Bob', 'pending', { is_current_turn: false }),
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
    expect(container.querySelector('[data-testid="action-buttons"]')).toBeNull();
  });
});

describe('PlayerApp — camera capture flow', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows Capture Cards button when status is pending', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="capture-cards-btn"]');
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toContain('Capture Cards');
    });
  });

  it('does NOT show Capture Cards button when status is idle', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    const btn = container.querySelector('[data-testid="capture-cards-btn"]');
    expect(btn).toBeNull();
  });

  it('does NOT show Capture Cards button when status is joined', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'joined') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    const btn = container.querySelector('[data-testid="capture-cards-btn"]');
    expect(btn).toBeNull();
  });

  it('tapping Capture Cards opens camera capture overlay', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

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
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

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
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

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

    // Preview step — click Use Photo to proceed
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Use Photo');
    });
    const usePhotoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Use Photo');
    await act(async () => { usePhotoBtn!.click(); });

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
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

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

    // Preview step — click Use Photo to proceed
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Use Photo');
    });
    const usePhotoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Use Photo');
    await act(async () => { usePhotoBtn!.click(); });

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
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

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

    // Preview step — click Use Photo to proceed
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Use Photo');
    });
    const usePhotoBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Use Photo');
    await act(async () => { usePhotoBtn!.click(); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
    });

    mockUpdateHolecards.mockResolvedValue({});
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' })));

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    await act(async () => { confirmBtn!.click(); });

    // After success, should go back to status view (no review/camera screen)
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Review Detection');
      expect(container.textContent).not.toContain('Open Camera');
    });
  });
});

describe('PlayerApp — hand back cards removed', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('does NOT show Hand Back Cards button when status is joined', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('does NOT show Hand Back Cards button when status is idle', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('does NOT show Hand Back Cards button when status is pending', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });

  it('does NOT show Hand Back Cards button when status is handed_back', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'handed_back', { result: 'handed_back' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });

    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });
});

describe('PlayerApp — polling edge cases', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows "No hands yet" when fetchHands returns empty array', async () => {
    const container = await goToPlaying(1, { hands: [] });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="no-active-hand"]')).not.toBeNull();
      expect(container.textContent).toContain('No hands yet');
    });

    // Player status controls should not be shown
    expect(container.querySelector('[data-testid="capture-cards-btn"]')).toBeNull();
  });

  it('recovers from empty hands when a new hand appears', async () => {
    const container = await goToPlaying(1, { hands: [] });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No hands yet');
    });

    // Next poll cycle: a hand now exists
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(makeStatus('Bob', 'pending')));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="no-active-hand"]')).toBeNull();
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('detects hand number change and resets status', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    // New hand starts — hand_number changes from 1 to 2
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }, { hand_number: 2 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 2 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
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
    }));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('handles network error on fetchLatestHand without crashing', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalled();
    });

    // Next poll: fetchLatestHand network error
    mockFetchLatestHand.mockRejectedValue(new Error('Network error'));
    act(() => { vi.advanceTimersByTime(5000); });

    // Should show reconnection indicator but not crash
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-reconnecting"]')).not.toBeNull();
    });

    // Component should still be mounted and functional
    expect(container.textContent).toContain('Bob');
    expect(container.querySelector('[data-testid="leave-game-btn"]')).not.toBeNull();
  });

  it('handles network error on fetchHandStatusConditional without crashing', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalled();
    });

    // Next poll: fetchHandStatusConditional network error
    mockFetchHandStatusConditional.mockRejectedValue(new Error('Server error'));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-reconnecting"]')).not.toBeNull();
    });

    // Should recover on next successful poll
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(makeStatus('Bob', 'pending')));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-reconnecting"]')).toBeNull();
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('clears reconnection indicator on successful recovery', async () => {
    const container = await goToPlaying(1);

    await vi.waitFor(() => {
      expect(mockFetchHandStatusConditional).toHaveBeenCalled();
    });

    // Error poll
    mockFetchLatestHand.mockRejectedValue(new Error('Timeout'));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-reconnecting"]')).not.toBeNull();
    });

    // Recovery poll
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional(HAND_STATUS_IDLE));
    act(() => { vi.advanceTimersByTime(5000); });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-reconnecting"]')).toBeNull();
    });
  });
});

describe('PlayerApp — button alignment', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('capture-cards-btn is full width', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="capture-cards-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.style.width).toBe('100%');
    });
  });

  it('leave-game-btn has flex layout', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="leave-game-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.style.minHeight).toBe('44px');
    });
  });

  it('capture-cards-btn and leave-game-btn both have adequate minHeight', async () => {
    const container = await goToPlaying(1, { handStatus: makeStatus('Bob', 'pending') });
    await vi.waitFor(() => {
      const capture = container.querySelector('[data-testid="capture-cards-btn"]') as HTMLElement;
      const leave = container.querySelector('[data-testid="leave-game-btn"]') as HTMLElement;
      expect(capture).not.toBeNull();
      expect(leave).not.toBeNull();
      expect(parseInt(capture.style.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(leave.style.minHeight)).toBeGreaterThanOrEqual(44);
    });
  });

  it('shows a Table View button when in playing step', async () => {
    const container = await goToPlaying();
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="table-view-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Table View');
    });
  });

  it('Table View button sets window.location.hash with game and player params', async () => {
    const container = await goToPlaying(1); // Bob (index 1)
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="table-view-btn"]') as HTMLElement;
      expect(btn).not.toBeNull();
    });
    const btn = container.querySelector('[data-testid="table-view-btn"]') as HTMLElement;
    act(() => { btn.click(); });
    expect(window.location.hash).toContain('/player/table');
    expect(window.location.hash).toContain('game=3');
    expect(window.location.hash).toContain('player=Bob');
  });
});

import { PLAYER_SESSION_KEY } from '../../src/../src/player/PlayerApp.tsx';

describe('PlayerApp — session pinning (sessionStorage)', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockPlayerName.current = 'Bob';
    originalHash = window.location.hash;
    window.location.hash = '';
    sessionStorage.clear();
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
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
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
    sessionStorage.clear();
  });

  it('stores gameId and playerName in sessionStorage after selecting game', async () => {
    const container = await goToPlaying(1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
    });

    const stored = JSON.parse(sessionStorage.getItem(PLAYER_SESSION_KEY)!);
    expect(stored).toEqual({ gameId: 3, playerName: 'Bob' });
  });

  it('restores session from sessionStorage and skips to playing step on mount', async () => {
    sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId: 2, playerName: 'Bob' }));
    mockFetchSessions.mockResolvedValue(SESSIONS);

    const { container } = render(<PlayerApp />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Game #2');
    });

    // Should not show game cards
    expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
  });

  it('clears storage and shows selector when stored game is not active', async () => {
    // Game 1 is "complete" in SESSIONS
    sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId: 1, playerName: 'Alice' }));
    mockFetchSessions.mockResolvedValue(SESSIONS);

    const { container } = render(<PlayerApp />);

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    expect(sessionStorage.getItem(PLAYER_SESSION_KEY)).toBeNull();
  });

  it('clears storage and shows selector when stored game is not found', async () => {
    sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId: 999, playerName: 'Ghost' }));
    mockFetchSessions.mockResolvedValue(SESSIONS);

    const { container } = render(<PlayerApp />);

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    expect(sessionStorage.getItem(PLAYER_SESSION_KEY)).toBeNull();
  });

  it('Leave Game button clears sessionStorage and returns to game selector', async () => {
    const container = await goToPlaying(1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
    });

    // Verify storage was set
    expect(sessionStorage.getItem(PLAYER_SESSION_KEY)).not.toBeNull();

    // Click Leave Game
    const leaveBtn = container.querySelector('[data-testid="leave-game-btn"]') as HTMLElement;
    expect(leaveBtn).not.toBeNull();
    act(() => { leaveBtn.click(); });

    await vi.waitFor(() => {
      // Should be back at game selector
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    expect(sessionStorage.getItem(PLAYER_SESSION_KEY)).toBeNull();
  });

  it('does not restore session when sessionStorage is empty', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);

    const { container } = render(<PlayerApp />);

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    // Should show game selector normally
    expect(container.textContent).toContain('Select a Game');
  });

  it('URL game param takes precedence over sessionStorage', async () => {
    // Store session for game 3
    sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId: 3, playerName: 'Alice' }));
    // URL points to game 2
    window.location.hash = '#/player?game=2';
    mockFetchSessions.mockResolvedValue(SESSIONS);

    const { container } = render(<PlayerApp />);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Game #2');
    });

    // Session should be updated to URL game with store player name
    const stored = JSON.parse(sessionStorage.getItem(PLAYER_SESSION_KEY)!);
    expect(stored).toEqual({ gameId: 2, playerName: 'Bob' });
  });
});

const GAME_DETAIL_WITH_BUYIN = {
  game_id: 3,
  game_date: '2026-04-06',
  status: 'active',
  player_names: ['Alice', 'Bob', 'Charlie'],
  players: [
    { name: 'Alice', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Bob', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Charlie', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
  ],
  hand_count: 1,
  winners: [],
  default_buy_in: 100,
};

const GAME_STATS_FOR_PLAYER = {
  game_id: 3,
  game_date: '2026-04-06',
  total_hands: 2,
  player_stats: [
    { player_name: 'Alice', hands_played: 2, hands_won: 1, hands_lost: 1, hands_folded: 0, win_rate: 50, profit_loss: 30 },
    { player_name: 'Bob', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -50 },
    { player_name: 'Charlie', hands_played: 2, hands_won: 1, hands_lost: 1, hands_folded: 0, win_rate: 50, profit_loss: 20 },
  ],
};

describe('PlayerApp — running total', () => {
  let originalHash: string;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockPlayerName.current = 'Bob';
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows running total for the current player in playing view', async () => {
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue(GAME_DETAIL_WITH_BUYIN);
    mockFetchGameStats.mockResolvedValue(GAME_STATS_FOR_PLAYER);
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
      hand_number: 1,
      community_recorded: false,
      players: GAME_DETAIL_WITH_BUYIN.player_names.map(name => ({
        name,
        participation_status: 'idle',
        card_1: null,
        card_2: null,
        result: null,
        outcome_street: null,
      })),
    }));

    // Bob: buy_in=100 + total_rebuys=0 + profit_loss=-50 = $50.00
    const { container } = render(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });
    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      const stackEl = container.querySelector('[data-testid="player-stack"]');
      expect(stackEl).toBeTruthy();
      expect(stackEl!.textContent).toContain('Stack: $50.00');
    });
  });

  it('colors the stack green when positive', async () => {
    mockPlayerName.current = 'Alice';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue(GAME_DETAIL_WITH_BUYIN);
    mockFetchGameStats.mockResolvedValue(GAME_STATS_FOR_PLAYER);
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
      hand_number: 1,
      community_recorded: false,
      players: GAME_DETAIL_WITH_BUYIN.player_names.map(name => ({
        name,
        participation_status: 'idle',
        card_1: null,
        card_2: null,
        result: null,
        outcome_street: null,
      })),
    }));

    // Alice: buy_in=100 + 0 + 30 = $130.00 (positive)
    const { container } = render(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });
    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      const stackEl = container.querySelector('[data-testid="player-stack"]');
      expect(stackEl).toBeTruthy();
      expect((stackEl as HTMLElement).style.color).toBe('#4ade80');
    });
  });

  it('colors the stack red when negative', async () => {
    mockPlayerName.current = 'Alice';
    mockFetchSessions.mockResolvedValue(SESSIONS);
    mockFetchGame.mockResolvedValue({
      ...GAME_DETAIL_WITH_BUYIN,
      players: [
        { name: 'Alice', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
        { name: 'Bob', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
        { name: 'Charlie', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
      ],
    });
    mockFetchGameStats.mockResolvedValue({
      ...GAME_STATS_FOR_PLAYER,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -120 },
        { player_name: 'Bob', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -50 },
        { player_name: 'Charlie', hands_played: 2, hands_won: 2, hands_lost: 0, hands_folded: 0, win_rate: 100, profit_loss: 170 },
      ],
    });
    mockFetchHands.mockResolvedValue([{ hand_number: 1 }]);
    mockFetchLatestHand.mockResolvedValue({ hand_number: 1 });
    mockFetchHandStatusConditional.mockResolvedValue(wrapConditional({
      hand_number: 1,
      community_recorded: false,
      players: GAME_DETAIL_WITH_BUYIN.player_names.map(name => ({
        name,
        participation_status: 'idle',
        card_1: null,
        card_2: null,
        result: null,
        outcome_street: null,
      })),
    }));

    // Alice: buy_in=100 + 0 + (-120) = -$20.00 (negative)
    const { container } = render(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });
    act(() => { container.querySelectorAll('[data-testid="game-card"]')[0].dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    await vi.waitFor(() => {
      const stackEl = container.querySelector('[data-testid="player-stack"]');
      expect(stackEl).toBeTruthy();
      expect((stackEl as HTMLElement).style.color).toBe('#f87171');
    });
  });
});
