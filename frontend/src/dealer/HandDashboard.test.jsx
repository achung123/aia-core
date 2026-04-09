/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { HandDashboard } from './HandDashboard.jsx';

vi.mock('../api/client.js', () => ({
  fetchHands: vi.fn(),
  createHand: vi.fn(),
  completeGame: vi.fn(),
}));

import { fetchHands, createHand, completeGame } from '../api/client.js';

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
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: 'won', profit_loss: 50.0, outcome_street: 'river' },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: 'lost', profit_loss: -25.0, outcome_street: 'turn' },
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
      // Hand 1 has results with outcome streets
      expect(rows[0].textContent).toContain('won');
      expect(rows[0].textContent).toContain('river');
      expect(rows[0].textContent).toContain('lost');
      expect(rows[0].textContent).toContain('turn');
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

  it('renders End Game button', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const btn = container.querySelector('[data-testid="end-game-btn"]');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('End Game');
    });
  });

  it('End Game shows winner selection dialog', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-btn"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-btn"]').click();
    await vi.waitFor(() => {
      const dialog = container.querySelector('[data-testid="end-game-confirm"]');
      expect(dialog).toBeTruthy();
      // Should show player checkboxes for winner selection
      expect(dialog.textContent).toContain('Alice');
      expect(dialog.textContent).toContain('Bob');
    });
  });

  it('End Game requires at least 1 winner selected', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-btn"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-confirm"]')).toBeTruthy();
    });
    // Try to confirm without selecting anyone
    container.querySelector('[data-testid="end-game-confirm-yes"]').click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Select 1 or 2 winners');
    });
    // completeGame should NOT have been called
    expect(completeGame).not.toHaveBeenCalled();
  });

  it('End Game limits to 2 winners max', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob', 'Carol']} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-btn"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-confirm"]')).toBeTruthy();
    });
    // Select all 3 players
    container.querySelector('[data-testid="winner-checkbox-Alice"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="winner-checkbox-Alice"]').textContent).toContain('✅');
    });
    container.querySelector('[data-testid="winner-checkbox-Bob"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="winner-checkbox-Bob"]').textContent).toContain('✅');
    });
    container.querySelector('[data-testid="winner-checkbox-Carol"]').click();
    // Third should not toggle on (still only 2 selected)
    container.querySelector('[data-testid="end-game-confirm-yes"]').click();
    await vi.waitFor(() => {
      expect(completeGame).toHaveBeenCalledWith(42, ['Alice', 'Bob']);
    });
  });

  it('End Game with winner calls completeGame and onBack', async () => {
    fetchHands.mockResolvedValue(HANDS);
    completeGame.mockResolvedValue({});
    const onBack = vi.fn();
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={onBack} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-btn"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-confirm"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="winner-checkbox-Alice"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="winner-checkbox-Alice"]').textContent).toContain('✅');
    });
    container.querySelector('[data-testid="end-game-confirm-yes"]').click();
    await vi.waitFor(() => {
      expect(completeGame).toHaveBeenCalledWith(42, ['Alice']);
      expect(onBack).toHaveBeenCalled();
    });
  });

  it('End Game confirmation can be cancelled', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-btn"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-btn"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-confirm"]')).toBeTruthy();
    });
    container.querySelector('[data-testid="end-game-confirm-no"]').click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="end-game-confirm"]')).toBeNull();
    });
  });

  it('shows winner icon next to player with won result', async () => {
    fetchHands.mockResolvedValue(HANDS);
    const container = renderToContainer(
      <HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />
    );
    await vi.waitFor(() => {
      const rows = container.querySelectorAll('[data-testid="hand-row"]');
      expect(rows[0].textContent).toContain('🏆');
    });
  });
});
