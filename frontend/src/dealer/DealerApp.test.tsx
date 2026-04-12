/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react';
import { useDealerStore } from '../stores/dealerStore.ts';
import type { DealerState, Player, CommunityCards } from '../stores/dealerStore.ts';

vi.mock('../api/client.ts', () => ({
  createHand: vi.fn(),
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

import { createHand, addPlayerToHand, updateHolecards, updateFlop, updateTurn, updateRiver, patchPlayerResult, fetchHands, fetchHand, fetchHandStatus } from '../api/client.ts';
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
  gameMode: 'dealer_centric',
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

describe('DealerApp per-player card collection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createHand as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
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

  async function startHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });
  }

  async function capturePlayerCards(container: HTMLElement, playerName: string) {
    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="player-tile-${playerName}"]`)!.click();
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

  async function captureAndCompletePlayer(container: HTMLElement, playerName: string) {
    await capturePlayerCards(container, playerName);
    // After card confirm, outcome buttons appear — select Won then street to return to grid
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
      expect(container.textContent).toContain('Select a Player');
    });
  }

  it('clicking Start Hand creates an empty hand on the backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(createHand).toHaveBeenCalledWith(42, {});
    });
  });

  it('after hand creation, transitions to playerGrid', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    expect(container.textContent).toContain('Select a Player');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('Bob');
  });

  it('tapping a playing tile opens camera capture', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="capture-target"]')!.textContent).toBe('Alice');
    });
  });

  it('after confirm, addPlayerToHand is called for unrecorded player', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await capturePlayerCards(container, 'Alice');

    await vi.waitFor(() => {
      expect(addPlayerToHand).toHaveBeenCalledWith(42, 1, {
        player_name: 'Alice',
        card_1: 'Ah',
        card_2: 'Kd',
      });
    });
  });

  it('player tile shows recorded after successful PATCH', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndCompletePlayer(container, 'Alice');

    await vi.waitFor(() => {
      const aliceTile = container.querySelector('[data-testid="player-tile-Alice"]');
      expect(aliceTile).not.toBeNull();
      expect(aliceTile!.textContent).toContain('✅');
    });
  });

  it('tapping a recorded tile opens camera for retake', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndCompletePlayer(container, 'Alice');

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-tile-Alice"]')!.textContent).toContain('✅');
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="camera-capture"]')).not.toBeNull();
    });
  });

  it('retake calls updateHolecards instead of addPlayerToHand', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndCompletePlayer(container, 'Alice');

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="player-tile-Alice"]')!.textContent).toContain('✅');
    });

    // Second capture = retake
    await capturePlayerCards(container, 'Alice');

    await vi.waitFor(() => {
      expect(updateHolecards).toHaveBeenCalledWith(42, 1, 'Alice', {
        card_1: 'Ah',
        card_2: 'Kd',
      });
    });
  });

  it('shows error toast on PATCH failure', async () => {
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await capturePlayerCards(container, 'Alice');

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('does not update player state on PATCH failure', async () => {
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await capturePlayerCards(container, 'Alice');

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Server error');
    });

    const aliceTile = container.querySelector('[data-testid="player-tile-Alice"]');
    expect(aliceTile!.textContent).not.toContain('✅');
  });
});

describe('DealerApp outcome flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createHand as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function startHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });
  }

  async function captureAndConfirmCards(container: HTMLElement, playerName: string) {
    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="player-tile-${playerName}"]`)!.click();
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

  it('shows outcome buttons after card review confirm', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

    await vi.waitFor(() => {
      expect(findButton(container, 'Won')).not.toBeUndefined();
      expect(findButton(container, 'Folded')).not.toBeUndefined();
      expect(findButton(container, 'Lost')).not.toBeUndefined();
    });
  });

  it('tapping Won PATCHes result to backend', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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

  it('allows direct outcome selection from player grid (skip camera)', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    // Click the direct outcome button on Alice's tile
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

  it('direct outcome PATCHes without requiring card capture first', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

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

    // Should NOT have called addPlayerToHand
    expect(addPlayerToHand).not.toHaveBeenCalled();
  });

  it('returns to player grid after successful outcome selection', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureAndConfirmCards(container, 'Alice');

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
      expect(container.textContent).toContain('Select a Player');
    });
  });
});

describe('DealerApp community card PATCH wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createHand as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateFlop as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateTurn as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateRiver as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function startHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
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
    await startHand(container);

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
    await startHand(container);
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
    await startHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      const flopTile = container.querySelector('[data-testid="flop-tile"]');
      expect(flopTile!.textContent).toContain('✅');
    });
  });

  it('shows error toast on flop PATCH failure', async () => {
    (updateFlop as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Duplicate card detected'));

    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureCommunityCards(container);

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Duplicate card detected');
    });
  });

  it('does not update community state on PATCH failure', async () => {
    (updateFlop as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server error'));

    const container = renderToContainer(<DealerApp />);
    await startHand(container);
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
    (createHand as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
    (addPlayerToHand as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateHolecards as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateFlop as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateTurn as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateRiver as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  async function startHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
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
      expect(container.textContent).toContain('Select a Player');
    });
  }

  async function capturePlayerCards(container: HTMLElement, playerName: string) {
    act(() => {
      container.querySelector<HTMLButtonElement>(`[data-testid="player-tile-${playerName}"]`)!.click();
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

  async function captureAndCompletePlayer(container: HTMLElement, playerName: string) {
    await capturePlayerCards(container, playerName);
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
      expect(container.textContent).toContain('Select a Player');
    });
  }

  async function directOutcome(container: HTMLElement, playerName: string, outcome: string) {
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
      expect(container.textContent).toContain('Select a Player');
    });
  }

  it('does not show Finish Hand button when no community cards and no outcomes', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    expect(findButton(container, 'Finish Hand')).toBeUndefined();
  });

  it('does not show Finish Hand button when community recorded but no outcomes', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureCommunityCards(container);

    expect(findButton(container, 'Finish Hand')).toBeUndefined();
  });

  it('shows Finish Hand button when outcome recorded without community cards', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await directOutcome(container, 'Alice', 'Folded');

    expect(findButton(container, 'Finish Hand')).not.toBeUndefined();
  });

  it('shows Finish Hand button when community cards + at least one outcome recorded', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureCommunityCards(container);
    await directOutcome(container, 'Alice', 'Folded');

    expect(findButton(container, 'Finish Hand')).not.toBeUndefined();
  });

  it('shows confirmation dialog listing uncaptured players when Finish Hand clicked', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
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
    await startHand(container);
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
      expect(container.textContent).toContain('Select a Player');
    });
  });

  it('confirming finish does NOT post uncaptured players', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
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

    await vi.waitFor(() => {
      // Should reach dashboard without posting uncaptured Bob
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });

    // addPlayerToHand should NOT have been called for uncaptured Bob
    const bobCalls = (addPlayerToHand as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => (args[2] as { player_name: string }).player_name === 'Bob'
    );
    expect(bobCalls).toHaveLength(0);
  });

  it('confirming finish dispatches FINISH_HAND and returns to dashboard with incremented count', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
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

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
  });

  it('skips confirmation dialog when all players have outcomes (no uncaptured)', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
    await captureCommunityCards(container);
    await captureAndCompletePlayer(container, 'Alice');
    await captureAndCompletePlayer(container, 'Bob');
    await captureAndCompletePlayer(container, 'Charlie');

    act(() => {
      findButton(container, 'Finish Hand')!.click();
    });

    // Should go directly to dashboard (no dialog needed since all players captured)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
  });

  it('uncaptured players with three players are all skipped', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);
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

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
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
    await startHand(container);

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
      gameMode: 'participation',
      players: defaultTestPlayers.map((p) => ({ ...p })),
      community: { ...emptyCommunity },
    });
    (fetchHands as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createHand as ReturnType<typeof vi.fn>).mockResolvedValue({ hand_number: 1 });
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

  async function startHand(container: HTMLElement) {
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });
  }

  it('starts polling fetchHandStatus when on playerGrid step', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    // Initial poll on mount
    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalledWith(42, 1, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it('polls every 3 seconds', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

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
    await startHand(container);

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

  it('stops polling when leaving playerGrid step', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    // Navigate back to dashboard
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="back-btn"]')!.click();
    });

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });

    (fetchHandStatus as ReturnType<typeof vi.fn>).mockClear();
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchHandStatus).toHaveBeenCalledTimes(0);
  });

  it('stops polling on unmount', async () => {
    vi.useRealTimers();
    useDealerStore.setState({ gameMode: 'participation' });
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
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
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

  it('existing manual flow still works alongside polling', async () => {
    vi.useRealTimers();
    useDealerStore.setState({ gameMode: 'dealer_centric' });
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });

    // Manually capture Alice's cards via tile tap
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
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
      expect(addPlayerToHand).toHaveBeenCalled();
    });
  });

  it('silently ignores polling errors', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    (fetchHandStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    await vi.advanceTimersByTimeAsync(3000);

    // Should not crash — grid still visible
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });
  });

  it('recovers after transient network error', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    await vi.waitFor(() => {
      expect(fetchHandStatus).toHaveBeenCalled();
    });

    // Error on next poll
    (fetchHandStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Timeout'));
    await vi.advanceTimersByTimeAsync(3000);

    // Grid still visible
    expect(container.textContent).toContain('Select a Player');

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
    useDealerStore.setState({ gameMode: 'dealer_centric' });
    const container = renderToContainer(<DealerApp />);

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="new-hand-btn"]')).not.toBeNull();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="new-hand-btn"]')!.click();
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });

    // Manually capture Alice's cards
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="player-tile-Alice"]')!.click();
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
      expect(addPlayerToHand).toHaveBeenCalled();
    });

    // Set outcome — select "Not Playing" which is a single-click outcome (no street needed)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Outcome for Alice');
    });
    const notPlayingBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Not Playing');
    act(() => {
      notPlayingBtn!.click();
    });

    // Wait for player grid to show
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
    });

    // Alice is now recorded. The grid should reflect that.
    const aliceRow = container.querySelector('[data-testid="player-row-Alice"]') as HTMLElement;
    expect(aliceRow).not.toBeNull();
    // Alice should not have the idle/playing background (#f3f4f6)
    expect(aliceRow.style.backgroundColor).not.toBe('#f3f4f6');
  });

  it('sit-out button marks player as not_playing in participation mode without API call', async () => {
    const container = renderToContainer(<DealerApp />);
    await startHand(container);

    // Wait for player grid
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select a Player');
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
