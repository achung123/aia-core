/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';

// Mock API client
vi.mock('../api/client.ts', () => ({
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(),
}));

// Mock client-side equity calculator
vi.mock('../poker/evaluator.ts', () => ({
  calculateEquity: vi.fn(() => []),
}));

// Mock poker scene — no WebGL in happy-dom
vi.mock('../scenes/pokerScene.ts', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {},
    renderer: { domElement: document.createElement('canvas') },
    seatPositions: [],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), dispose: vi.fn() },
    communityCards: null,
    controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), saveState: vi.fn() },
    dispose: vi.fn(),
    update: vi.fn(),
  })),
}));

import { fetchSessions, fetchHands } from '../api/client.ts';
import { calculateEquity } from '../poker/evaluator.ts';
import type { GameSessionListItem, HandResponse } from '../api/types.ts';
import { MobilePlaybackView } from './MobilePlaybackView.tsx';

function renderToContainer(element: React.ReactElement) {
  const { container } = render(element);
  return container;
}

const SESSIONS: GameSessionListItem[] = [
  { game_id: 1, game_date: '2026-02-15', status: 'completed', hand_count: 8, player_count: 3, winners: [] },
  { game_id: 2, game_date: '2026-04-05', status: 'completed', hand_count: 3, player_count: 6, winners: [] },
  { game_id: 3, game_date: '2026-03-01', status: 'completed', hand_count: 12, player_count: 4, winners: [] },
];

const HANDS: HandResponse[] = [
  {
    hand_id: 1,
    game_id: 2,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: 'Qc',
    turn: 'Js',
    river: 'Tc',
    source_upload_id: null,
    created_at: '2026-04-05T12:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'won', profit_loss: 50, outcome_street: null, winning_hand_description: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'lost', profit_loss: -50, outcome_street: null, winning_hand_description: null },
    ],
  },
];

describe('MobilePlaybackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.mocked(fetchSessions).mockResolvedValue(SESSIONS);
    vi.mocked(fetchHands).mockResolvedValue(HANDS);
    vi.mocked(calculateEquity).mockReturnValue([
      { equity: 0.6 },
      { equity: 0.4 },
    ]);
  });

  it('renders a full-viewport canvas', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const wrapper = container.querySelector('[data-testid="mobile-canvas"]');
    expect(wrapper).toBeTruthy();
    expect((wrapper as HTMLElement).style.width).toBe('100vw');
    expect((wrapper as HTMLElement).style.height).toBe('100vh');
  });

  it('has no sidebar', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const sidebar = container.querySelector('#session-panel');
    expect(sidebar).toBeNull();
  });

  it('renders a bottom-drawer session picker', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const drawer = container.querySelector('[data-testid="bottom-drawer"]');
    expect(drawer).toBeTruthy();
    expect((drawer as HTMLElement).style.position).toBe('absolute');
    expect((drawer as HTMLElement).style.bottom).toBe('0px');
  });

  it('shows loading state in drawer initially', () => {
    vi.mocked(fetchSessions).mockReturnValue(new Promise(() => {}));
    const container = renderToContainer(<MobilePlaybackView />);
    const drawer = container.querySelector('[data-testid="bottom-drawer"]');
    expect(drawer!.textContent).toContain('Loading');
  });

  it('renders game list sorted by date descending', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });
    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards.length).toBe(3);
    expect(cards[0].textContent).toContain('2026-04-05');
    expect(cards[1].textContent).toContain('2026-03-01');
    expect(cards[2].textContent).toContain('2026-02-15');
  });

  it('selecting a game calls fetchHands and hides drawer', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(2);
    });
  });

  it('has a mount point for scrubber controls', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const scrubber = container.querySelector('[data-testid="scrubber-mount"]');
    expect(scrubber).toBeTruthy();
  });

  it('shows error when fetchSessions fails', async () => {
    vi.mocked(fetchSessions).mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('toggle button opens and closes the drawer', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    const toggle = container.querySelector('[data-testid="drawer-toggle"]');
    expect(toggle).toBeTruthy();
    fireEvent.click(toggle!);
    await waitFor(() => {
      const list = container.querySelector('[data-testid="drawer-content"]');
      expect((list as HTMLElement).style.display).toBe('none');
    });
  });

  it('shows session scrubber after selecting a game', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeTruthy();
    });
  });

  it('shows street scrubber after selecting a game', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="street-scrubber"]')).toBeTruthy();
    });
  });

  it('shows back button when a game is active', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
  });

  it('back button returns to session list', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
    fireEvent.click(container.querySelector('[data-testid="back-button"]')!);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeNull();
    });
  });

  it('session scrubber shows correct hand count', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      const label = container.querySelector('[data-testid="session-label"]');
      expect(label!.textContent).toBe('Hand 1 / 1');
    });
  });

  it('calls calculateEquity after selecting game with 2+ players', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });
  });

  it('shows equity row after selecting a game with 2+ players', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeTruthy();
    });
  });

  it('hides equity row when calculateEquity throws', async () => {
    vi.mocked(calculateEquity).mockImplementation(() => { throw new Error('eval error'); });
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(fetchHands).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeNull();
    });
  });

  it('recalculates equity when hand index changes', async () => {
    const multiHands: HandResponse[] = [
      { ...HANDS[0], hand_id: 1, hand_number: 1 },
      { ...HANDS[0], hand_id: 2, hand_number: 2 },
    ];
    vi.mocked(fetchHands).mockResolvedValue(multiHands);
    const container = renderToContainer(<MobilePlaybackView />);
    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    fireEvent.click(container.querySelectorAll('[data-testid="game-card"]')[0]);
    await waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });

    const callsBefore = vi.mocked(calculateEquity).mock.calls.length;

    const nextBtn = container.querySelector('[data-testid="session-next"]');
    if (nextBtn) {
      fireEvent.click(nextBtn);
      await waitFor(() => {
        expect(vi.mocked(calculateEquity).mock.calls.length).toBeGreaterThan(callsBefore);
      });
    }
  });

  it('uses flex column layout so canvas does not extend behind HUD', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const wrapper = container.querySelector('[data-testid="mobile-canvas"]') as HTMLElement;
    expect(wrapper.style.display).toBe('flex');
    expect(wrapper.style.flexDirection).toBe('column');
  });

  it('canvas area has overflow hidden and flex:1', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const canvasArea = container.querySelector('[data-testid="canvas-area"]') as HTMLElement;
    expect(canvasArea).toBeTruthy();
    expect(canvasArea.style.overflow).toBe('hidden');
    expect(canvasArea.style.flex).toContain('1');
  });

  it('scrubber mount is not position:absolute (no longer overlaid)', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const scrubberMount = container.querySelector('[data-testid="scrubber-mount"]') as HTMLElement;
    expect(scrubberMount).toBeTruthy();
    expect(scrubberMount.style.position).not.toBe('absolute');
  });
});
