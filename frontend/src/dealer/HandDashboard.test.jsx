/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { HandDashboard } from './HandDashboard.jsx';

vi.mock('../api/client.js', () => ({
  fetchHands: vi.fn(),
  createHand: vi.fn(),
}));

import { fetchHands, createHand } from '../api/client.js';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const HANDS = [
  {
    hand_id: 1,
    game_id: 42,
    hand_number: 1,
    flop_1: 'Ah',
    flop_2: 'Kd',
    flop_3: '5h',
    turn: null,
    river: null,
    created_at: '2026-04-08T10:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: 'Won', profit_loss: 50.0 },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: 'Lost', profit_loss: -25.0 },
    ],
  },
  {
    hand_id: 2,
    game_id: 42,
    hand_number: 2,
    flop_1: null,
    flop_2: null,
    flop_3: null,
    turn: null,
    river: null,
    created_at: '2026-04-08T10:30:00Z',
    player_hands: [
      { player_hand_id: 3, hand_id: 2, player_id: 1, player_name: 'Alice', card_1: 'Qh', card_2: '9d', result: null, profit_loss: null },
    ],
  },
];

describe('HandDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    fetchHands.mockReturnValue(new Promise(() => {})); // never resolves
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    expect(container.textContent).toContain('Loading');
  });

  it('shows hand count in header after loading', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2 Hands');
    });
  });

  it('renders a row for each hand', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const rows = container.querySelectorAll('[data-testid="hand-row"]');
      expect(rows.length).toBe(2);
    });
  });

  it('each row shows hand number and player names', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const rows = container.querySelectorAll('[data-testid="hand-row"]');
      expect(rows[0].textContent).toContain('Hand #1');
      expect(rows[0].textContent).toContain('Alice');
      expect(rows[0].textContent).toContain('Bob');
      expect(rows[1].textContent).toContain('Hand #2');
      expect(rows[1].textContent).toContain('Alice');
    });
  });

  it('each row shows result summary', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const rows = container.querySelectorAll('[data-testid="hand-row"]');
      // Hand 1 has results
      expect(rows[0].textContent).toContain('Won');
      expect(rows[0].textContent).toContain('Lost');
    });
  });

  it('tapping a row calls onSelectHand with hand number', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const onSelectHand = vi.fn();
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={onSelectHand} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-testid="hand-row"]').length).toBe(2);
    });

    container.querySelectorAll('[data-testid="hand-row"]')[0].click();
    expect(onSelectHand).toHaveBeenCalledWith(1);

    container.querySelectorAll('[data-testid="hand-row"]')[1].click();
    expect(onSelectHand).toHaveBeenCalledWith(2);
  });

  it('New Hand button creates hand and calls onSelectHand', async () => {
    fetchHands.mockResolvedValue(HANDS);
    createHand.mockResolvedValue({ hand_number: 3 });
    const onSelectHand = vi.fn();
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={onSelectHand} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2 Hands');
    });

    const newBtn = container.querySelector('[data-testid="new-hand-btn"]');
    expect(newBtn).toBeTruthy();
    newBtn.click();

    await vi.waitFor(() => {
      expect(createHand).toHaveBeenCalledWith(42, {});
      expect(onSelectHand).toHaveBeenCalledWith(3);
    });
  });

  it('Back to Games button calls onBack', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const onBack = vi.fn();
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={onBack} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('2 Hands');
    });

    const backBtn = container.querySelector('[data-testid="back-btn"]');
    expect(backBtn).toBeTruthy();
    backBtn.click();
    expect(onBack).toHaveBeenCalled();
  });

  it('shows error state when fetch fails', async () => {
    fetchHands.mockRejectedValue(new Error('Network error'));
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });
  });

  it('shows empty state when no hands exist', async () => {
    fetchHands.mockResolvedValue([]);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.textContent).toContain('0 Hands');
    });
  });

  it('fetches hands for the given gameId', async () => {
    fetchHands.mockResolvedValue([]);
    renderToContainer(
      <HandDashboard gameId={99} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(fetchHands).toHaveBeenCalledWith(99);
    });
  });

  it('shows hand list as scrollable', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const list = container.querySelector('[data-testid="hand-list"]');
      expect(list).toBeTruthy();
      expect(list.style.overflowY).toBe('auto');
    });
  });
});
