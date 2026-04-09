/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from 'preact';
import { PlayerApp } from './PlayerApp.jsx';

vi.mock('../api/client.js', () => ({
  fetchSessions: vi.fn(),
  fetchGame: vi.fn(),
  fetchHands: vi.fn(),
  fetchHandStatus: vi.fn(),
  uploadImage: vi.fn(),
  getDetectionResults: vi.fn(),
  updateHolecards: vi.fn(),
  patchPlayerResult: vi.fn(),
}));

import { fetchSessions, fetchGame, fetchHands, fetchHandStatus, uploadImage, getDetectionResults, updateHolecards, patchPlayerResult } from '../api/client.js';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const SESSIONS = [
  { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
  { game_id: 2, game_date: '2026-04-05', status: 'active', player_count: 6, hand_count: 3, winners: [] },
  { game_id: 3, game_date: '2026-04-06', status: 'active', player_count: 5, hand_count: 1, winners: null },
  { game_id: 4, game_date: '2026-02-15', status: 'complete', player_count: 3, hand_count: 8, winners: ['Bob'] },
];

describe('PlayerApp', () => {
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('shows loading state initially', () => {
    fetchSessions.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    expect(container.textContent).toContain('Loading');
  });

  it('renders only active games (no completed games)', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
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
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards[0].textContent).toContain('#3');
    expect(cards[1].textContent).toContain('#2');
  });

  it('selecting a game transitions to name picker step', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ game_id: 3, player_names: ['Alice', 'Bob'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    const cards = container.querySelectorAll('[data-testid="game-card"]');
    cards[0].click();

    await vi.waitFor(() => {
      // After clicking, should no longer show game cards
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      // Should show game id selected context
      expect(container.textContent).toContain('Game #3');
    });
  });

  it('auto-selects game from ?game= URL param and skips picker', async () => {
    window.location.hash = '#/player?game=2';
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ game_id: 2, player_names: ['Dan', 'Eve'] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      // Should not show game cards — auto-selected
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(0);
      expect(container.textContent).toContain('Game #2');
    });
  });

  it('shows error when ?game= references an invalid game', async () => {
    window.location.hash = '#/player?game=999';
    fetchSessions.mockResolvedValue(SESSIONS);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('not found');
    });
  });

  it('shows error when fetchSessions fails', async () => {
    fetchSessions.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('shows empty message when no active games', async () => {
    fetchSessions.mockResolvedValue([
      { game_id: 1, game_date: '2026-03-01', status: 'complete', player_count: 4, hand_count: 12, winners: ['Alice'] },
    ]);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No active games');
    });
  });

  it('displays game date and player count on cards', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
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
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    originalHash = window.location.hash;
    window.location.hash = '';
    // Default mocks so polling in 'playing' step doesn't crash
    fetchHands.mockResolvedValue([{ hand_number: 1 }]);
    fetchHandStatus.mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [],
    });
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('fetches game details and shows player names as buttons', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      const playerBtns = container.querySelectorAll('[data-testid="player-name-btn"]');
      expect(playerBtns.length).toBe(3);
      expect(playerBtns[0].textContent).toContain('Alice');
      expect(playerBtns[1].textContent).toContain('Bob');
      expect(playerBtns[2].textContent).toContain('Charlie');
    });
  });

  it('shows loading while fetching players', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Loading players');
    });
  });

  it('shows message when game has no players', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({ ...GAME_DETAIL, player_names: [] });
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('No players');
    });
  });

  it('selecting a name transitions to playing step with welcome message', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    container.querySelectorAll('[data-testid="player-name-btn"]')[1].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Waiting for hand');
    });
  });

  it('Change Player button returns to name picker', async () => {
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue(GAME_DETAIL);
    const container = renderToContainer(<PlayerApp />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="game-card"]')[0].click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    container.querySelectorAll('[data-testid="player-name-btn"]')[0].click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Alice');
    });

    container.querySelector('[data-testid="change-player-btn"]').click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });
  });

  it('auto-selected game via URL also fetches players', async () => {
    window.location.hash = '#/player?game=2';
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchGame.mockResolvedValue({
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
});

/* ---- Helper: navigate to playing step ---- */
async function goToPlaying(container, playerIndex = 1, { hands, handStatus } = {}) {
  fetchSessions.mockResolvedValue(SESSIONS);
  fetchGame.mockResolvedValue(GAME_DETAIL);
  fetchHands.mockResolvedValue(hands || [{ hand_number: 1 }]);
  if (handStatus) {
    fetchHandStatus.mockResolvedValue(handStatus);
  } else if (!fetchHandStatus.getMockImplementation()) {
    fetchHandStatus.mockResolvedValue({
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

  render(<PlayerApp />, container);
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(2);
  });
  container.querySelectorAll('[data-testid="game-card"]')[0].click();
  await vi.waitFor(() => {
    expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
  });
  container.querySelectorAll('[data-testid="player-name-btn"]')[playerIndex].click();
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

function makeStatus(playerName, status, extras = {}) {
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
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('fetches hands list and starts polling hand status after name selection', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(3);
    });

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledWith(3, 1);
    });
  });

  it('polls hand status every 3 seconds', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledTimes(1);
    });

    fetchHandStatus.mockResolvedValue(HAND_STATUS_IDLE);
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledTimes(2);
    });

    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledTimes(3);
    });
  });

  it('stops polling on unmount (no leaked intervals)', async () => {
    const container = document.createElement('div');
    await goToPlaying(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledTimes(1);
    });

    // Unmount
    render(null, container);

    const callsBefore = fetchHandStatus.mock.calls.length;
    vi.advanceTimersByTime(6000);
    expect(fetchHandStatus).toHaveBeenCalledTimes(callsBefore);
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
      expect(fetchHandStatus).toHaveBeenCalledWith(3, 3);
    });
  });

  it('updates UI when status changes on subsequent polls', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1); // Bob

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    // Next poll returns pending
    fetchHandStatus.mockResolvedValue(makeStatus('Bob', 'pending'));
    vi.advanceTimersByTime(3000);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Your turn');
    });
  });

  it('stops polling when returning to name picker via Change Player', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    container.querySelector('[data-testid="change-player-btn"]').click();

    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="player-name-btn"]').length).toBe(3);
    });

    const callsBefore = fetchHandStatus.mock.calls.length;
    vi.advanceTimersByTime(6000);
    expect(fetchHandStatus).toHaveBeenCalledTimes(callsBefore);
  });
});

describe('PlayerApp — camera capture flow', () => {
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows Capture Cards button when status is pending', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="capture-cards-btn"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Capture Cards');
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

    container.querySelector('[data-testid="capture-cards-btn"]').click();

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

    container.querySelector('[data-testid="capture-cards-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    // Click the Cancel button in CameraCapture
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
    cancelBtn.click();

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

    uploadImage.mockResolvedValue({ upload_id: 'u1' });
    getDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    container.querySelector('[data-testid="capture-cards-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    // Simulate file input change
    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // After upload + detection, should show DetectionReview
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
      expect(container.textContent).toContain('Confirm');
    });

    // Confirm the detection
    updateHolecards.mockResolvedValue({});

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    confirmBtn.click();

    await vi.waitFor(() => {
      expect(updateHolecards).toHaveBeenCalledWith(3, 1, 'Bob', {
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

    uploadImage.mockResolvedValue({ upload_id: 'u1' });
    getDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    container.querySelector('[data-testid="capture-cards-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
    });

    updateHolecards.mockRejectedValue(new Error('Server error'));

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    confirmBtn.click();

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

    uploadImage.mockResolvedValue({ upload_id: 'u1' });
    getDetectionResults.mockResolvedValue({
      detections: [
        { detected_value: 'Ah', confidence: 0.95, bbox_x: 10 },
        { detected_value: 'Ks', confidence: 0.90, bbox_x: 50 },
      ],
    });

    container.querySelector('[data-testid="capture-cards-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Open Camera');
    });

    const fileInput = container.querySelector('input[type="file"]');
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], writable: false });
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Review Detection');
    });

    updateHolecards.mockResolvedValue({});
    fetchHandStatus.mockResolvedValue(makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }));

    const confirmBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Confirm');
    confirmBtn.click();

    // After success, should go back to status view (no review/camera screen)
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain('Review Detection');
      expect(container.textContent).not.toContain('Open Camera');
    });
  });
});

describe('PlayerApp — fold action', () => {
  let originalHash;
  let originalConfirm;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
    originalConfirm = window.confirm;
    window.confirm = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = originalHash;
    window.confirm = originalConfirm;
  });

  it('shows Fold button when status is pending', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="fold-btn"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Fold');
    });
  });

  it('does NOT show Fold button when status is idle', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for hand');
    });

    expect(container.querySelector('[data-testid="fold-btn"]')).toBeNull();
  });

  it('does NOT show Fold button when status is joined', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined') });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Cards submitted');
    });

    expect(container.querySelector('[data-testid="fold-btn"]')).toBeNull();
  });

  it('shows confirmation dialog when Fold is tapped', async () => {
    window.confirm.mockReturnValue(false);
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fold-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="fold-btn"]').click();

    expect(window.confirm).toHaveBeenCalledWith('Fold this hand?');
    // Should NOT call API since user cancelled
    expect(patchPlayerResult).not.toHaveBeenCalled();
  });

  it('calls patchPlayerResult with folded on confirm', async () => {
    window.confirm.mockReturnValue(true);
    patchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fold-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="fold-btn"]').click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(3, 1, 'Bob', { result: 'folded' });
    });
  });

  it('shows error and retry when fold API fails', async () => {
    window.confirm.mockReturnValue(true);
    patchPlayerResult.mockRejectedValue(new Error('Network error'));
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fold-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="fold-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });

    // Retry button should be visible
    const retryBtn = container.querySelector('[data-testid="fold-retry-btn"]');
    expect(retryBtn).not.toBeNull();

    // Retry should call API again
    patchPlayerResult.mockResolvedValue({});
    retryBtn.click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledTimes(2);
    });
  });

  it('polling picks up folded status after successful fold', async () => {
    window.confirm.mockReturnValue(true);
    patchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'pending') });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fold-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="fold-btn"]').click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalled();
    });

    // Next poll returns folded status
    fetchHandStatus.mockResolvedValue(makeStatus('Bob', 'folded', { result: 'folded' }));
    vi.advanceTimersByTime(3000);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Folded');
    });

    // Fold button should be gone
    expect(container.querySelector('[data-testid="fold-btn"]')).toBeNull();
  });
});

describe('PlayerApp — hand back cards action', () => {
  let originalHash;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    originalHash = window.location.hash;
    window.location.hash = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = originalHash;
  });

  it('shows Hand Back Cards button when status is joined', async () => {
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="hand-back-btn"]');
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('Hand Back Cards');
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
    patchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="hand-back-btn"]').click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(3, 1, 'Bob', { result: 'handed_back' });
    });
  });

  it('shows error and retry when hand-back API fails', async () => {
    patchPlayerResult.mockRejectedValue(new Error('Server error'));
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="hand-back-btn"]').click();

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });

    // Retry button should be visible
    const retryBtn = container.querySelector('[data-testid="hand-back-retry-btn"]');
    expect(retryBtn).not.toBeNull();

    // Retry should call API again
    patchPlayerResult.mockResolvedValue({});
    retryBtn.click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledTimes(2);
    });
  });

  it('disables button while API call is in-flight', async () => {
    let resolveApi;
    patchPlayerResult.mockImplementation(() => new Promise(r => { resolveApi = r; }));
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="hand-back-btn"]').click();

    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="hand-back-btn"]');
      expect(btn.disabled).toBe(true);
      expect(btn.textContent).toContain('Handing back');
    });

    resolveApi({});
  });

  it('polling picks up handed_back status and shows waiting message', async () => {
    patchPlayerResult.mockResolvedValue({});
    const container = document.createElement('div');
    await goToPlaying(container, 1, { handStatus: makeStatus('Bob', 'joined', { card_1: 'Ah', card_2: 'Ks' }) });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="hand-back-btn"]')).not.toBeNull();
    });

    container.querySelector('[data-testid="hand-back-btn"]').click();

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalled();
    });

    // Next poll returns handed_back status
    fetchHandStatus.mockResolvedValue(makeStatus('Bob', 'handed_back', { result: 'handed_back' }));
    vi.advanceTimersByTime(3000);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Waiting for dealer');
    });

    // Hand back button should be gone
    expect(container.querySelector('[data-testid="hand-back-btn"]')).toBeNull();
  });
});
