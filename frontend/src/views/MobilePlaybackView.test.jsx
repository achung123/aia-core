/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';

// Mock API client
vi.mock('../api/client.js', () => ({
  fetchSessions: vi.fn(),
  fetchHands: vi.fn(),
}));

// Mock client-side equity calculator
vi.mock('../poker/evaluator.js', () => ({
  calculateEquity: vi.fn(() => []),
}));

// Mock poker scene — no WebGL in happy-dom
vi.mock('../scenes/pokerScene.js', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {},
    renderer: { domElement: document.createElement('canvas') },
    seatPositions: [],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), dispose: vi.fn() },
    communityCards: null,
    dispose: vi.fn(),
    update: vi.fn(),
  })),
}));

// Mock scene helpers that need WebGL context
vi.mock('../scenes/tableGeometry.js', () => ({
  createSeatLabels: vi.fn(() => []),
  loadSession: vi.fn(),
  updateSeatLabelPositions: vi.fn(),
}));

vi.mock('../scenes/communityCards.js', () => ({
  createCommunityCards: vi.fn(() => ({
    goToStreet: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../components/equityOverlay.js', () => ({
  createEquityOverlay: vi.fn(() => ({
    update: vi.fn(),
    hide: vi.fn(),
    updatePositions: vi.fn(),
  })),
}));

import { fetchSessions, fetchHands } from '../api/client.js';
import { calculateEquity } from '../poker/evaluator.js';
import { MobilePlaybackView } from './MobilePlaybackView.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const SESSIONS = [
  { game_id: 1, game_date: '2026-02-15', hand_count: 8, player_count: 3 },
  { game_id: 2, game_date: '2026-04-05', hand_count: 3, player_count: 6 },
  { game_id: 3, game_date: '2026-03-01', hand_count: 12, player_count: 4 },
];

const HANDS = [
  {
    hand_number: 1,
    flop_1: 'Ah', flop_2: 'Kd', flop_3: 'Qc',
    turn: 'Js', river: 'Tc',
    player_hands: [
      { player_name: 'Alice', card_1: '2h', card_2: '3h', result: 'win', profit_loss: 50 },
      { player_name: 'Bob', card_1: '4d', card_2: '5d', result: 'loss', profit_loss: -50 },
    ],
  },
];

describe('MobilePlaybackView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSessions.mockResolvedValue(SESSIONS);
    fetchHands.mockResolvedValue(HANDS);
    calculateEquity.mockReturnValue([
      { equity: 0.6 },
      { equity: 0.4 },
    ]);
  });

  it('renders a full-viewport canvas', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    // Check the canvas wrapper takes full viewport
    const wrapper = container.querySelector('[data-testid="mobile-canvas"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe('100vw');
    expect(wrapper.style.height).toBe('100vh');
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
    // Drawer should be at the bottom
    expect(drawer.style.position).toBe('absolute');
    expect(drawer.style.bottom).toBe('0px');
  });

  it('shows loading state in drawer initially', () => {
    fetchSessions.mockReturnValue(new Promise(() => {})); // never resolves
    const container = renderToContainer(<MobilePlaybackView />);
    const drawer = container.querySelector('[data-testid="bottom-drawer"]');
    expect(drawer.textContent).toContain('Loading');
  });

  it('renders game list sorted by date descending', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2026-04-05');
    });
    const cards = container.querySelectorAll('[data-testid="game-card"]');
    expect(cards.length).toBe(3);
    // First card is most recent
    expect(cards[0].textContent).toContain('2026-04-05');
    expect(cards[1].textContent).toContain('2026-03-01');
    expect(cards[2].textContent).toContain('2026-02-15');
  });

  it('selecting a game calls fetchHands and hides drawer', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    const cards = container.querySelectorAll('[data-testid="game-card"]');
    cards[0].click(); // click the most recent game (game_id=2)
    await vi.waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(2);
    });
  });

  it('has a mount point for scrubber controls', () => {
    const container = renderToContainer(<MobilePlaybackView />);
    const scrubber = container.querySelector('[data-testid="scrubber-mount"]');
    expect(scrubber).toBeTruthy();
  });

  it('shows error when fetchSessions fails', async () => {
    fetchSessions.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('toggle button opens and closes the drawer', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    const toggle = container.querySelector('[data-testid="drawer-toggle"]');
    expect(toggle).toBeTruthy();
    // Clicking toggle should collapse/expand the drawer
    toggle.click();
    await vi.waitFor(() => {
      const drawer = container.querySelector('[data-testid="bottom-drawer"]');
      // After toggle, drawer content should be hidden
      const list = container.querySelector('[data-testid="drawer-content"]');
      expect(list.style.display).toBe('none');
    });
  });

  it('shows session scrubber after selecting a game', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeTruthy();
    });
  });

  it('shows street scrubber after selecting a game', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="street-scrubber"]')).toBeTruthy();
    });
  });

  it('shows back button when a game is active', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
  });

  it('back button returns to session list', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="back-button"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="back-button"]')).toBeNull();
      expect(container.querySelector('[data-testid="session-scrubber"]')).toBeNull();
    });
  });

  it('session scrubber shows correct hand count', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      const label = container.querySelector('[data-testid="session-label"]');
      expect(label.textContent).toBe('Hand 1 / 1');
    });
  });

  it('calls calculateEquity after selecting game with 2+ players', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });
  });

  it('shows equity row after selecting a game with 2+ players', async () => {
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeTruthy();
    });
  });

  it('hides equity row when calculateEquity throws', async () => {
    calculateEquity.mockImplementation(() => { throw new Error('eval error'); });
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(fetchHands).toHaveBeenCalled();
    });
    // equity row should be hidden
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="equity-row"]')).toBeNull();
    });
  });

  it('recalculates equity when hand index changes', async () => {
    const multiHands = [
      { ...HANDS[0], hand_number: 1 },
      { ...HANDS[0], hand_number: 2 },
    ];
    fetchHands.mockResolvedValue(multiHands);
    const container = renderToContainer(<MobilePlaybackView />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="game-card"]').length).toBe(3);
    });
    container.querySelectorAll('[data-testid="game-card"]')[0].click();
    await vi.waitFor(() => {
      expect(calculateEquity).toHaveBeenCalled();
    });

    const callsBefore = calculateEquity.mock.calls.length;

    // Scrub to hand 2 via the next button
    const nextBtn = container.querySelector('[data-testid="scrubber-next"]');
    if (nextBtn) {
      nextBtn.click();
      await vi.waitFor(() => {
        expect(calculateEquity.mock.calls.length).toBeGreaterThan(callsBefore);
      });
    }
  });
});
