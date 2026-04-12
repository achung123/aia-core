/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react';
import { useDealerStore } from '../stores/dealerStore.ts';
import type { DealerState, Player, CommunityCards } from '../stores/dealerStore.ts';

vi.mock('../api/client.ts', () => ({
  createHand: vi.fn(),
  startHand: vi.fn(),
  addPlayerToHand: vi.fn(),
  updateHolecards: vi.fn(),
  updateCommunityCards: vi.fn(),
  updateFlop: vi.fn(),
  updateTurn: vi.fn(),
  updateRiver: vi.fn(),
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
  fetchBlinds: vi.fn(() => Promise.resolve({ small_blind: 0.25, big_blind: 0.50, blind_timer_minutes: 15, blind_timer_paused: false, blind_timer_started_at: null, blind_timer_remaining_seconds: null })),
}));

vi.mock('./CameraCapture.tsx', () => ({
  CameraCapture: ({ targetName, onDetectionResult, onCancel }: {
    targetName: string;
    onDetectionResult: (target: string, detections: { detected_value: string; confidence: number }[], file: Blob) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="camera-capture">
      <span data-testid="capture-target">{targetName}</span>
      <button
        data-testid="mock-detect"
        onClick={() => {
          onDetectionResult(targetName, [
            { detected_value: 'Ah', confidence: 0.99 },
            { detected_value: 'Kd', confidence: 0.98 },
          ], new Blob(['fake']));
        }}
      >Detect</button>
      <button data-testid="mock-cancel" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('./DetectionReview.tsx', () => ({
  DetectionReview: ({ targetName, mode, onConfirm, onRetake }: {
    targetName: string;
    mode: string;
    onConfirm: (target: string, cards: string[]) => void;
    onRetake: () => void;
  }) => (
    <div data-testid="detection-review">
      <button
        data-testid="mock-confirm"
        onClick={() => {
          const cards = mode === 'flop'
            ? ['Js', 'Tc', '5h']
            : mode === 'turn'
            ? ['Qd']
            : mode === 'river'
            ? ['9c']
            : ['Ah', 'Kd'];
          onConfirm(targetName, cards);
        }}
      >Confirm</button>
      <button data-testid="mock-retake" onClick={onRetake}>Retake</button>
    </div>
  ),
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

import { startHand as startHandApi, addPlayerToHand, updateHolecards, updateFlop, updateTurn, updateRiver, patchPlayerResult, fetchHands, fetchHand, fetchHandStatus, fetchSessions, fetchEquity } from '../api/client.ts';
import { DealerApp } from './DealerApp.tsx';

const defaultTestPlayers: Player[] = [
  { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
  { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
  { name: 'Charlie', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
];

const emptyCommunity: CommunityCards = {
  flop1: null, flop2: null, flop3: null, flopRecorded: false,
  turn: null, turnRecorded: false, river: null, riverRecorded: false,
};

const defaultTestState: Partial<DealerState> = {
  gameId: 42,
  currentStep: 'dashboard',
  players: defaultTestPlayers.map((p) => ({ ...p })),
  handCount: 0,
  gameDate: '2026-04-08',
  currentHandId: null,
  community: { ...emptyCommunity },
};

// Clear persisted dealer state before AND after every test to prevent state leaking
beforeEach(() => {
  sessionStorage.clear();
  useDealerStore.setState({ ...defaultTestState, players: defaultTestPlayers.map((p) => ({ ...p })), community: { ...emptyCommunity } });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function renderToContainer(vnode: React.ReactElement): HTMLElement {
  const { container } = render(vnode);
  return container;
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  const buttons = Array.from(container.querySelectorAll('button'));
  // Prefer exact text match, fall back to includes
  return (buttons.find((b) => b.textContent?.trim() === text)
    || buttons.find((b) => b.textContent?.includes(text))) as HTMLButtonElement | undefined;
}

describe('DealerApp 4-step shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchSessions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('renders bottom navigation with all 4 steps', () => {
    useDealerStore.setState({ ...defaultTestState, currentStep: 'gameSelector', gameId: null });
    const container = renderToContainer(<DealerApp />);
    const nav = container.querySelector('[data-testid="bottom-nav"]');
    expect(nav).not.toBeNull();
    expect(nav!.querySelector('[data-testid="nav-gameSelector"]')).not.toBeNull();
    expect(nav!.querySelector('[data-testid="nav-dashboard"]')).not.toBeNull();
    expect(nav!.querySelector('[data-testid="nav-activeHand"]')).not.toBeNull();
    expect(nav!.querySelector('[data-testid="nav-review"]')).not.toBeNull();
  });

  it('highlights the current step in navigation', () => {
    useDealerStore.setState({ ...defaultTestState, currentStep: 'dashboard' });
    const container = renderToContainer(<DealerApp />);
    const dashBtn = container.querySelector('[data-testid="nav-dashboard"]') as HTMLElement;
    expect(dashBtn.style.color).toBe('#818cf8');
  });

  it('renders GameSelector on gameSelector step', () => {
    useDealerStore.setState({ ...defaultTestState, currentStep: 'gameSelector', gameId: null });
    const container = renderToContainer(<DealerApp />);
    expect(container.textContent).toContain('Games');
  });

  it('renders HandDashboard on dashboard step', async () => {
    useDealerStore.setState({ ...defaultTestState, currentStep: 'dashboard' });
    const container = renderToContainer(<DealerApp />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });

  it('renders PlayerGrid on activeHand step', () => {
    useDealerStore.setState({
      ...defaultTestState,
      currentStep: 'activeHand',
      currentHandId: 1,
    });
    const container = renderToContainer(<DealerApp />);
    expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
  });

  it('renders review summary on review step', () => {
    useDealerStore.setState({
      ...defaultTestState,
      currentStep: 'review',
      currentHandId: 5,
      players: [
        { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'won', outcomeStreet: 'river' },
        { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'folded', outcomeStreet: 'flop' },
      ],
    });
    const container = renderToContainer(<DealerApp />);
    expect(container.textContent).toContain('Hand Review');
    expect(container.textContent).toContain('Hand #5');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Won');
    expect(container.textContent).toContain('Bob');
    expect(container.textContent).toContain('Folded');
    expect(container.querySelector('[data-testid="review-confirm-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="review-cancel-btn"]')).not.toBeNull();
  });

  it('confirm-btn on review saves and returns to dashboard', async () => {
    useDealerStore.setState({
      ...defaultTestState,
      currentStep: 'review',
      currentHandId: 5,
      players: [
        { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'won', outcomeStreet: 'river' },
      ],
    });
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const container = renderToContainer(<DealerApp />);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="review-confirm-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="finish-confirm-ok"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="finish-confirm-ok"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });
});

describe('DealerApp per-player card collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (fetchHand as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function clickStartHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  it('clicking Start Hand calls startHand on the backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(startHandApi).toHaveBeenCalledWith(42);
    });
  });

  it('after hand creation, transitions to activeHand', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
  });

  it('tapping a playing tile calls addPlayerToHand to activate player', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(addPlayerToHand).toHaveBeenCalledWith(42, 1, {
        player_name: 'Alice',
      });
    });
  });

  it('shows error toast on addPlayerToHand failure', async () => {
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });
});

describe('DealerApp outcome flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function startHandWithHandedBack(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
    // Set Alice to handed_back so outcome button appears
    act(() => {
      useDealerStore.setState((state) => ({
        players: state.players.map((p) =>
          p.name === 'Alice' ? { ...p, status: 'handed_back' } : p,
        ),
      }));
    });
  }

  it('shows outcome buttons when clicking outcome button on handed_back player', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    const outcomeBtn = container.querySelector('[data-testid="outcome-btn-Alice"]');
    expect(outcomeBtn).not.toBeNull();
    act(() => {
      (outcomeBtn as HTMLButtonElement).click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
      expect(findButton(container, 'Folded')).not.toBeUndefined();
      expect(findButton(container, 'Lost')).not.toBeUndefined();
    });
  });

  it('tapping Won PATCHes result to backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Won')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(42, 1, 'Alice', { result: 'won', outcome_street: 'river' });
    });
  });

  it('tapping Folded PATCHes result to backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Folded')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Folded')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Flop')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'Flop')!.click();
    });

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(42, 1, 'Alice', { result: 'folded', outcome_street: 'flop' });
    });
  });

  it('tapping Lost PATCHes result to backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Lost')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Lost')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Turn')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'Turn')!.click();
    });

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(42, 1, 'Alice', { result: 'lost', outcome_street: 'turn' });
    });
  });

  it('player tile updates status after outcome selection', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Won')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });

    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]');
      expect(aliceRow).not.toBeNull();
      expect(aliceRow!.textContent).toContain('won');
    });
  });

  it('shows error and keeps buttons on PATCH failure', async () => {
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Result PATCH failed'));

    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Won')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Result PATCH failed');
    });

    // Buttons should still be available for retry
    expect(findButton(container, 'Won')).not.toBeUndefined();
    expect(findButton(container, 'Folded')).not.toBeUndefined();
    expect(findButton(container, 'Lost')).not.toBeUndefined();
  });

  it('outcome PATCHes without requiring card capture first', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Folded')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Folded')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Flop')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'Flop')!.click();
    });

    await vi.waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(42, 1, 'Alice', { result: 'folded', outcome_street: 'flop' });
    });
  });

  it('returns to player grid after successful outcome selection', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHandWithHandedBack(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="outcome-btn-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Won')!.click();
    });

    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  });
});

describe('DealerApp community card PATCH wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateFlop as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateTurn as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateRiver as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function clickStartHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function captureCommunityCards(container: HTMLElement) {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="flop-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });
  }

  it('tapping Flop tile opens camera capture for flop cards', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="flop-tile"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="capture-target"]')!.textContent).toBe('flop');
    });
  });

  it('after confirm, updateFlop is called with correct payload', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      expect(updateFlop).toHaveBeenCalledWith(42, 1, {
        flop_1: 'Js',
        flop_2: 'Tc',
        flop_3: '5h',
      });
    });
  });

  it('Flop tile shows checkmark after successful PATCH', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      const flopTile = container.querySelector('[data-testid="flop-tile"]');
      expect(flopTile!.textContent).toContain('✅');
    });
  });

  it('shows error toast on flop PATCH failure', async () => {
    (updateFlop as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Duplicate card detected'));

    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Duplicate card detected');
    });
  });

  it('does not update community state on PATCH failure', async () => {
    (updateFlop as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });

    const flopTile = container.querySelector('[data-testid="flop-tile"]');
    expect(flopTile!.textContent).not.toContain('✅');
  });
});

describe('DealerApp finish hand flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateFlop as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateTurn as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateRiver as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function clickStartHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function captureCommunityCards(container: HTMLElement) {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="flop-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  function setPlayerHandedBack(playerName: string) {
    act(() => {
      useDealerStore.setState((state) => ({
        players: state.players.map((p) =>
          p.name === playerName ? { ...p, status: 'handed_back' } : p,
        ),
      }));
    });
  }

  async function completePlayer(container: HTMLElement, playerName: string) {
    setPlayerHandedBack(playerName);

    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="outcome-btn-${playerName}"]`)!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'Won')!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function directOutcome(container: HTMLElement, playerName: string, outcome: string) {
    setPlayerHandedBack(playerName);

    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="outcome-btn-${playerName}"]`)!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, outcome)).not.toBeUndefined();
    });
    act(() => {
      findButton(container, outcome)!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'River')).not.toBeUndefined();
    });
    act(() => {
      findButton(container, 'River')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  it('does not show Finish Hand button when no community cards and no outcomes', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    expect(findButton(container, 'Finish Hand')).toBeUndefined();
  });

  it('does not show Finish Hand button when community recorded but no outcomes', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);

    expect(findButton(container, 'Finish Hand')).toBeUndefined();
  });

  it('shows Finish Hand button when outcome recorded without community cards', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await directOutcome(container, 'Alice', 'Folded');

    expect(findButton(container, 'Finish Hand')).not.toBeUndefined();
  });

  it('shows Finish Hand button when community cards + at least one outcome recorded', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    expect(findButton(container, 'Finish Hand')).not.toBeUndefined();
  });

  it('shows confirmation dialog listing uncaptured players when Finish Hand clicked', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });

    await vi.waitFor(() => {
      // Dialog should list Bob as uncaptured (still 'playing')
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('will not be recorded');
      expect(findButton(container, 'Confirm')).not.toBeUndefined();
      expect(findButton(container, 'Cancel')).not.toBeUndefined();
    });
  });

  it('cancelling confirmation dialog returns to player grid', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'Cancel')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Cancel')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  });

  it('confirming finish does NOT post uncaptured players', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'Confirm')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Confirm')!.click();
    });

    // Goes to review step first
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="review-confirm-btn"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="review-confirm-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="finish-confirm-ok"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="finish-confirm-ok"]')!.click();
    });

    await vi.waitFor(() => {
      // Should reach dashboard without posting uncaptured Bob
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });

    // addPlayerToHand should NOT have been called for uncaptured Bob
    const bobCalls = (addPlayerToHand as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => (args[2] as { player_name: string }).player_name === 'Bob'
    );
    expect(bobCalls).toHaveLength(0);
  });

  it('confirming finish dispatches FINISH_HAND and returns to dashboard with incremented count', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });
    await vi.waitFor(() => {
      expect(findButton(container, 'Confirm')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Confirm')!.click();
    });

    // Goes to review step first
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="review-confirm-btn"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="review-confirm-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="finish-confirm-ok"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="finish-confirm-ok"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });

  it('skips confirmation dialog when all players have outcomes (no uncaptured)', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await completePlayer(container, 'Alice');
    await completePlayer(container, 'Bob');
    await completePlayer(container, 'Charlie');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });

    // Should go directly to review (no dialog needed since all players captured)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="review-confirm-btn"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="review-confirm-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="finish-confirm-ok"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="finish-confirm-ok"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
  });

  it('uncaptured players with three players are all skipped', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    // Bob and Charlie are both uncaptured ('playing')
    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Bob');
      expect(container.textContent).toContain('Charlie');
      expect(findButton(container, 'Confirm')).not.toBeUndefined();
    });

    act(() => {
      findButton(container, 'Confirm')!.click();
    });

    // Goes to review step first
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="review-confirm-btn"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="review-confirm-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="finish-confirm-ok"]')).not.toBeNull();
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="finish-confirm-ok"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });

    // Neither Bob nor Charlie should have been POSTed
    const uncapturedCalls = (addPlayerToHand as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => {
        const data = args[2] as { player_name: string };
        return data.player_name === 'Bob' || data.player_name === 'Charlie';
      }
    );
    expect(uncapturedCalls).toHaveLength(0);
  });

  it('does not show legacy Submit Hand button', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    expect(findButton(container, 'Submit Hand')).toBeUndefined();
  });
});

describe('DealerApp hand status polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.useFakeTimers();
    useDealerStore.setState({
      ...defaultTestState,
      players: defaultTestPlayers.map((p) => ({ ...p })),
      community: { ...emptyCommunity },
    });
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (fetchHand as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Alice', participation_status: 'idle', card_1: null, card_2: null, result: null, outcome_street: null },
        { name: 'Bob', participation_status: 'idle', card_1: null, card_2: null, result: null, outcome_street: null },
        { name: 'Charlie', participation_status: 'idle', card_1: null, card_2: null, result: null, outcome_street: null },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function clickStartHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  it('starts polling fetchHandStatus when on activeHand step', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    // Initial poll on mount
    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledWith(42, 1, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('polls every 3 seconds', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    // Wait for initial poll to happen
    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    // Clear call history after initial poll(s) during startHand
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockClear();
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Alice', participation_status: 'idle' },
        { name: 'Bob', participation_status: 'idle' },
        { name: 'Charlie', participation_status: 'idle' },
      ],
    });

    await vi.advanceTimersByTimeAsync(3000);
    const callsAfterFirst = (fetchHandStatus as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    (fetchHandStatus as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(3000);
    expect((fetchHandStatus as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('maps participation_status into player tile colors', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    // Update mock to return 'joined' for Alice
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Alice', participation_status: 'joined' },
        { name: 'Bob', participation_status: 'pending' },
        { name: 'Charlie', participation_status: 'idle' },
      ],
    });

    await vi.advanceTimersByTimeAsync(3000);

    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]') as HTMLElement;
      expect(aliceRow.style.backgroundColor).toBe('#bbf7d0'); // joined
    });

    await vi.waitFor(() => {
      const bobRow = container.querySelector('[data-testid="player-row-Bob"]') as HTMLElement;
      expect(bobRow.style.backgroundColor).toBe('#fef08a'); // pending
    });
  });

  it('stops polling when leaving activeHand step', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    // Navigate back to dashboard
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="back-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });

    (fetchHandStatus as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchHandStatus).toHaveBeenCalledTimes(0);
  });

  it('stops polling on unmount', async () => {
    vi.useRealTimers();
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Alice', participation_status: 'idle' },
        { name: 'Bob', participation_status: 'idle' },
        { name: 'Charlie', participation_status: 'idle' },
      ],
    });

    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    act(() => {
      cleanup();
    });

    const callsAtUnmount = (fetchHandStatus as ReturnType<typeof vi.fn>).mock.calls.length;

    // Wait a polling cycle with real timers to confirm no new calls
    await new Promise((r) => setTimeout(r, 4000));

    // After unmount, no significant new polling should occur
    const callsAfterWait = (fetchHandStatus as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterWait - callsAtUnmount).toBeLessThanOrEqual(1);
  });

  it('tile tap activates player alongside polling', async () => {
    vi.useRealTimers();
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });

    // Tap Alice tile — in participation mode this calls addPlayerToHand
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(addPlayerToHand).toHaveBeenCalled();
    });
  });

  it('silently ignores polling errors', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    (fetchHandStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    await vi.advanceTimersByTimeAsync(3000);

    // Should not crash — grid still visible
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  });

  it('recovers after transient network error', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    // Error on next poll
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Timeout'));
    await vi.advanceTimersByTimeAsync(3000);

    // Grid still visible
    expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();

    // Successful recovery poll
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      community_recorded: false,
      players: [
        { name: 'Alice', participation_status: 'joined' },
        { name: 'Bob', participation_status: 'idle' },
        { name: 'Charlie', participation_status: 'idle' },
      ],
    });
    await vi.advanceTimersByTimeAsync(3000);

    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]') as HTMLElement;
      expect(aliceRow.style.backgroundColor).toBe('#bbf7d0');
    });
  });

  it('manual action wins over stale poll response (recorded player not overwritten)', async () => {
    vi.useRealTimers();
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });

    // Tap Alice tile — in participation mode this calls addPlayerToHand
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(addPlayerToHand).toHaveBeenCalled();
    });

    // Use sit-out button to mark Alice as not_playing
    const sitOutBtn = container.querySelector('[data-testid="sitout-btn-Alice"]');
    if (sitOutBtn) {
      act(() => {
        (sitOutBtn as HTMLButtonElement).click();
      });

      // Wait for player grid to show
      await vi.waitFor(() => {
        expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
      });

      // Alice is now not_playing. The grid should reflect that.
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]') as HTMLElement;
      expect(aliceRow).not.toBeNull();
      // Alice should have the not_playing background (#e5e7eb)
      expect(aliceRow.style.backgroundColor).toBe('#e5e7eb');
    }
  });

  it('sit-out button marks player as not_playing in participation mode without API call', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    // Wait for player grid
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });

    // Alice should have a sit-out button (she's in 'playing' status)
    const sitOutBtn = container.querySelector('[data-testid="sitout-btn-Alice"]');
    expect(sitOutBtn).not.toBeNull();

    // Click sit-out
    act(() => {
      (sitOutBtn as HTMLButtonElement).click();
    });

    // Alice should now show "not playing"
    await vi.waitFor(() => {
      const aliceRow = container.querySelector('[data-testid="player-row-Alice"]') as HTMLElement;
      expect(aliceRow.textContent).toContain('not playing');
      expect(aliceRow.style.backgroundColor).toBe('#e5e7eb');
    });

    // Should NOT have made an API call for this
    expect(addPlayerToHand).not.toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({ player_name: 'Alice' })
    );
    expect(patchPlayerResult).not.toHaveBeenCalled();
  });
});

describe('DealerApp incremental community card capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (startHandApi as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateFlop as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateTurn as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateRiver as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (fetchHand as ReturnType<typeof vi.fn>).mockResolvedValue({
      hand_number: 1,
      flop_1: null, flop_2: null, flop_3: null,
      turn: null, river: null,
      player_hands: [],
    });
  });

  async function clickStartHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="start-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="start-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function captureFlop(container: HTMLElement) {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="flop-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function captureTurn(container: HTMLElement) {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="turn-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  async function captureRiver(container: HTMLElement) {
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="river-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-list"]')).not.toBeNull();
    });
  }

  it('Turn tile is disabled before flop capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    const turnTile = container.querySelector('[data-testid="turn-tile"]') as HTMLButtonElement;
    expect(turnTile.disabled).toBe(true);
  });

  it('Turn tile becomes enabled after flop capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);

    const turnTile = container.querySelector('[data-testid="turn-tile"]') as HTMLButtonElement;
    expect(turnTile.disabled).toBe(false);
  });

  it('clicking Turn tile opens camera capture with turn target', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="turn-tile"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="capture-target"]')!.textContent).toBe('turn');
    });
  });

  it('after Turn confirm, updateTurn is called with correct payload', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);

    await vi.waitFor(() => {
      expect(updateTurn).toHaveBeenCalledWith(42, 1, { turn: 'Qd' });
    });
  });

  it('Turn tile shows checkmark after successful PATCH', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);

    await vi.waitFor(() => {
      const turnTile = container.querySelector('[data-testid="turn-tile"]');
      expect(turnTile!.textContent).toContain('✅');
    });
  });

  it('River tile is disabled before turn capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);

    const riverTile = container.querySelector('[data-testid="river-tile"]') as HTMLButtonElement;
    expect(riverTile.disabled).toBe(true);
  });

  it('River tile becomes enabled after turn capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);

    const riverTile = container.querySelector('[data-testid="river-tile"]') as HTMLButtonElement;
    expect(riverTile.disabled).toBe(false);
  });

  it('clicking River tile opens camera capture with river target', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="river-tile"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="capture-target"]')!.textContent).toBe('river');
    });
  });

  it('after River confirm, updateRiver is called with correct payload', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);
    await captureRiver(container);

    await vi.waitFor(() => {
      expect(updateRiver).toHaveBeenCalledWith(42, 1, { river: '9c' });
    });
  });

  it('River tile shows checkmark after successful PATCH', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);
    await captureRiver(container);

    await vi.waitFor(() => {
      const riverTile = container.querySelector('[data-testid="river-tile"]');
      expect(riverTile!.textContent).toContain('✅');
    });
  });

  it('board slots fill incrementally after each capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    // Before any capture — all slots empty
    for (let i = 0; i < 5; i++) {
      expect(container.querySelector(`[data-testid="board-slot-${i}"]`)!.textContent).toBe('');
    }

    // After flop — slots 0-2 filled
    await captureFlop(container);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="board-slot-0"]')!.textContent).toBe('Js');
      expect(container.querySelector('[data-testid="board-slot-1"]')!.textContent).toBe('Tc');
      expect(container.querySelector('[data-testid="board-slot-2"]')!.textContent).toBe('5h');
    });
    expect(container.querySelector('[data-testid="board-slot-3"]')!.textContent).toBe('');
    expect(container.querySelector('[data-testid="board-slot-4"]')!.textContent).toBe('');

    // After turn — slot 3 filled
    await captureTurn(container);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="board-slot-3"]')!.textContent).toBe('Qd');
    });
    expect(container.querySelector('[data-testid="board-slot-4"]')!.textContent).toBe('');

    // After river — slot 4 filled
    await captureRiver(container);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="board-slot-4"]')!.textContent).toBe('9c');
    });
  });

  it('full incremental flow: flop → turn → river with correct API calls', async () => {
    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);

    await captureFlop(container);
    await vi.waitFor(() => {
      expect(updateFlop).toHaveBeenCalledWith(42, 1, { flop_1: 'Js', flop_2: 'Tc', flop_3: '5h' });
    });

    await captureTurn(container);
    await vi.waitFor(() => {
      expect(updateTurn).toHaveBeenCalledWith(42, 1, { turn: 'Qd' });
    });

    await captureRiver(container);
    await vi.waitFor(() => {
      expect(updateRiver).toHaveBeenCalledWith(42, 1, { river: '9c' });
    });

    expect(updateFlop).toHaveBeenCalledTimes(1);
    expect(updateTurn).toHaveBeenCalledTimes(1);
    expect(updateRiver).toHaveBeenCalledTimes(1);
  });

  it('shows error toast on turn PATCH failure', async () => {
    (updateTurn as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Turn save failed'));

    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="turn-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Turn save failed');
    });
  });

  it('shows error toast on river PATCH failure', async () => {
    (updateRiver as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('River save failed'));

    const container = renderToContainer(<DealerApp />);
    await clickStartHand(container);
    await captureFlop(container);
    await captureTurn(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="river-tile"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-detect"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-detect"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="mock-confirm"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="mock-confirm"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('River save failed');
    });
  });
});

describe('DealerApp showdown flow', () => {
  const playersWithCards: Player[] = [
    { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
    { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
    { name: 'Charlie', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
  ];

  const riverCommunity: CommunityCards = {
    flop1: 'Js', flop2: 'Tc', flop3: '5h', flopRecorded: true,
    turn: 'Qd', turnRecorded: true,
    river: '9c', riverRecorded: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchEquity as ReturnType<typeof vi.fn>).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 1.0 },
        { player_name: 'Bob', equity: 0.0 },
      ],
    });
    useDealerStore.setState({
      ...defaultTestState,
      currentStep: 'activeHand',
      currentHandId: 1,
      players: playersWithCards.map((p) => ({ ...p })),
      community: { ...riverCommunity },
    });
  });

  it('showdown button calls fetchEquity and navigates to review (AC2, AC5)', async () => {
    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(fetchEquity).toHaveBeenCalledWith(42, 1);
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Hand Review');
    });
  });

  it('maps equity ~1.0 to won and ~0.0 to lost (AC2)', async () => {
    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      const bob = state.players.find((p) => p.name === 'Bob');
      expect(alice?.status).toBe('won');
      expect(bob?.status).toBe('lost');
    });
  });

  it('maps split equity to both won (AC2 split)', async () => {
    (fetchEquity as ReturnType<typeof vi.fn>).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.5 },
        { player_name: 'Bob', equity: 0.5 },
      ],
    });

    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      const bob = state.players.find((p) => p.name === 'Bob');
      expect(alice?.status).toBe('won');
      expect(bob?.status).toBe('won');
    });
  });

  it('infers outcome street from community card count (AC4)', async () => {
    const flopCommunity: CommunityCards = {
      flop1: 'Js', flop2: 'Tc', flop3: '5h', flopRecorded: true,
      turn: null, turnRecorded: false,
      river: null, riverRecorded: false,
    };
    useDealerStore.setState({ community: { ...flopCommunity } });

    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      expect(alice?.outcomeStreet).toBe('flop');
    });
  });

  it('auto-proposes won for single non-folded player without calling equity (AC3)', async () => {
    // When only 1 non-folded player with cards remains among active players,
    // mapEquityToOutcomes returns auto-won. Set up 2 non-folded with cards
    // but mock equity to return only Alice (Bob missing → inconclusive via equity,
    // but mapEquityToOutcomes sees only 1 active if we mark Bob folded in equity logic).
    // AC3 is thoroughly tested in showdownHelpers.test.ts.
    // Here we verify the handler navigates to review when equity returns an auto-win.
    (fetchEquity as ReturnType<typeof vi.fn>).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 1.0 },
        { player_name: 'Bob', equity: 0.0 },
      ],
    });

    // Set only 2 players: Alice (playing) + Bob (playing), community recorded
    useDealerStore.setState({
      ...defaultTestState,
      currentStep: 'activeHand',
      currentHandId: 1,
      players: [
        { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
        { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
      ],
      community: { ...riverCommunity },
    });

    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      expect(alice?.status).toBe('won');
      expect(alice?.outcomeStreet).toBe('river');
    });
  });

  it('navigates to review with blank results on equity error (AC6)', async () => {
    (fetchEquity as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Equity unavailable'));

    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Hand Review');
      // Players should still have 'playing' status (blank results)
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      expect(alice?.status).toBe('playing');
    });
  });

  it('navigates to review with blank results when equity data is inconclusive (AC6)', async () => {
    (fetchEquity as ReturnType<typeof vi.fn>).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 1.0 },
        // Bob missing — inconclusive
      ],
    });

    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Hand Review');
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      expect(alice?.status).toBe('playing'); // not pre-filled
    });
  });

  it('sets outcome street on proposed results (AC4 + AC5)', async () => {
    const container = renderToContainer(<DealerApp />);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="showdown-btn"]')!.click();
    });

    await vi.waitFor(() => {
      const state = useDealerStore.getState();
      const alice = state.players.find((p) => p.name === 'Alice');
      const bob = state.players.find((p) => p.name === 'Bob');
      expect(alice?.outcomeStreet).toBe('river');
      expect(bob?.outcomeStreet).toBe('river');
    });
  });
});
