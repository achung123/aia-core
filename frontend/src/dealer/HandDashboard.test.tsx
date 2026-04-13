/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { HandDashboard } from './HandDashboard.tsx';

vi.mock('../api/client.ts', () => ({
  fetchHands: vi.fn(),
  startHand: vi.fn(),
  completeGame: vi.fn(),
  fetchGame: vi.fn(),
  fetchGameStats: vi.fn(),
  createRebuy: vi.fn(),
}));

vi.mock('./QRCodeDisplay.tsx', () => ({
  QRCodeDisplay: ({ gameId, visible }: { gameId: number; visible: boolean }) =>
    visible ? <div data-testid="qr-code-display">QR:{gameId}</div> : null,
}));

vi.mock('./GamePlayerManagement.tsx', () => ({
  GamePlayerManagement: ({ gameId }: { gameId: number }) =>
    <div data-testid="game-player-management">Players:{gameId}</div>,
}));

import { fetchHands, startHand, completeGame, fetchGame, fetchGameStats, createRebuy } from '../api/client.ts';


const mockedFetchHands = fetchHands as ReturnType<typeof vi.fn>;
const mockedStartHand = startHand as ReturnType<typeof vi.fn>;
const mockedCompleteGame = completeGame as ReturnType<typeof vi.fn>;
const mockedFetchGame = fetchGame as ReturnType<typeof vi.fn>;
const mockedFetchGameStats = fetchGameStats as ReturnType<typeof vi.fn>;
const mockedCreateRebuy = createRebuy as ReturnType<typeof vi.fn>;

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
    source_upload_id: null,
    created_at: '2026-04-08T10:00:00Z',
    player_hands: [
      { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: 'won', profit_loss: 50.0, outcome_street: 'river', winning_hand_description: null },
      { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: 'lost', profit_loss: -25.0, outcome_street: 'turn', winning_hand_description: null },
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
    source_upload_id: null,
    created_at: '2026-04-08T10:30:00Z',
    player_hands: [
      { player_hand_id: 3, hand_id: 2, player_id: 1, player_name: 'Alice', card_1: 'Qh', card_2: '9d', result: null, profit_loss: null, outcome_street: null, winning_hand_description: null },
    ],
  },
];

describe('HandDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchGame.mockResolvedValue({ players: [] });
    mockedFetchGameStats.mockResolvedValue({ player_stats: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state initially', () => {
    mockedFetchHands.mockReturnValue(new Promise(() => {})); // never resolves
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Loading')).toBeTruthy();
  });

  it('shows hand count in header after loading', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('2 Hands')).toBeTruthy();
    });
  });

  it('renders a row for each hand', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('hand-row').length).toBe(2);
    });
  });

  it('each row shows hand number and player names', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const rows = screen.getAllByTestId('hand-row');
      expect(rows[0].textContent).toContain('Hand #1');
      expect(rows[0].textContent).toContain('Alice');
      expect(rows[0].textContent).toContain('Bob');
      expect(rows[1].textContent).toContain('Hand #2');
      expect(rows[1].textContent).toContain('Alice');
    });
  });

  it('each row shows result summary', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const rows = screen.getAllByTestId('hand-row');
      expect(rows[0].textContent).toContain('won');
      expect(rows[0].textContent).toContain('river');
      expect(rows[0].textContent).toContain('lost');
      expect(rows[0].textContent).toContain('turn');
    });
  });

  it('tapping a row calls onSelectHand with hand number', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    const onSelectHand = vi.fn();
    render(<HandDashboard gameId={42} onSelectHand={onSelectHand} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getAllByTestId('hand-row').length).toBe(2);
    });

    screen.getAllByTestId('hand-row')[0].click();
    expect(onSelectHand).toHaveBeenCalledWith(1);

    screen.getAllByTestId('hand-row')[1].click();
    expect(onSelectHand).toHaveBeenCalledWith(2);
  });

  it('Start Hand button calls startHand(gameId) and transitions on success', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    mockedStartHand.mockResolvedValue({ hand_number: 3 });
    const onSelectHand = vi.fn();
    render(<HandDashboard gameId={42} onSelectHand={onSelectHand} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('2 Hands')).toBeTruthy();
    });

    screen.getByTestId('start-hand-btn').click();

    await waitFor(() => {
      expect(mockedStartHand).toHaveBeenCalledWith(42);
      expect(onSelectHand).toHaveBeenCalledWith(3);
    });
  });

  it('Start Hand button shows loading state during API call', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    let resolveStart: (value: unknown) => void;
    mockedStartHand.mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('start-hand-btn')).toBeTruthy();
    });

    screen.getByTestId('start-hand-btn').click();

    await waitFor(() => {
      const btn = screen.getByTestId('start-hand-btn');
      expect(btn.textContent).toContain('Starting');
      expect(btn.hasAttribute('disabled')).toBe(true);
    });

    // Resolve to clean up
    resolveStart!({ hand_number: 3 });
  });

  it('Start Hand button shows error message when API fails', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    mockedStartHand.mockRejectedValue(new Error('No active players'));
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('start-hand-btn')).toBeTruthy();
    });

    screen.getByTestId('start-hand-btn').click();

    await waitFor(() => {
      expect(screen.getByTestId('start-hand-error')).toBeTruthy();
      expect(screen.getByTestId('start-hand-error').textContent).toContain('No active players');
    });
    // Button should be re-enabled after error
    expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(false);
  });

  it('Start Hand button is disabled while loading', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    let resolveStart: (value: unknown) => void;
    mockedStartHand.mockReturnValue(new Promise((resolve) => { resolveStart = resolve; }));
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('start-hand-btn')).toBeTruthy();
    });

    // Click once
    screen.getByTestId('start-hand-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(true);
    });

    // Second click should not trigger another API call
    screen.getByTestId('start-hand-btn').click();
    expect(mockedStartHand).toHaveBeenCalledTimes(1);

    resolveStart!({ hand_number: 3 });
  });

  it('Back to Games button calls onBack', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    const onBack = vi.fn();
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText('2 Hands')).toBeTruthy();
    });

    screen.getByTestId('back-btn').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('shows error state when fetch fails', async () => {
    mockedFetchHands.mockRejectedValue(new Error('Network error'));
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('shows empty state when no hands exist', async () => {
    mockedFetchHands.mockResolvedValue([]);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('0 Hands')).toBeTruthy();
    });
  });

  it('fetches hands for the given gameId', async () => {
    mockedFetchHands.mockResolvedValue([]);
    render(<HandDashboard gameId={99} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(mockedFetchHands).toHaveBeenCalledWith(99);
    });
  });

  it('shows hand list as scrollable', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const list = screen.getByTestId('hand-list');
      expect(list.style.overflowY).toBe('auto');
    });
  });

  it('hand row result badges wrap on narrow screens', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const row = screen.getAllByTestId('hand-row')[0];
      const badgeContainer = row.querySelector('[data-testid="result-badges"]');
      expect(badgeContainer).toBeTruthy();
      expect((badgeContainer as HTMLElement).style.flexWrap).toBe('wrap');
    });
  });

  it('renders End Game button', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const btn = screen.getByTestId('end-game-btn');
      expect(btn).toBeTruthy();
      expect(btn.textContent).toContain('End Game');
    });
  });

  it('End Game shows winner selection dialog', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('end-game-btn')).toBeTruthy();
    });
    screen.getByTestId('end-game-btn').click();
    await waitFor(() => {
      const dialog = screen.getByTestId('end-game-confirm');
      expect(dialog).toBeTruthy();
      expect(dialog.textContent).toContain('Alice');
      expect(dialog.textContent).toContain('Bob');
    });
  });

  it('End Game requires at least 1 winner selected', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('end-game-btn')).toBeTruthy();
    });
    screen.getByTestId('end-game-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('end-game-confirm')).toBeTruthy();
    });
    screen.getByTestId('end-game-confirm-yes').click();
    await waitFor(() => {
      expect(screen.getByText('Select 1 or 2 winners')).toBeTruthy();
    });
    expect(mockedCompleteGame).not.toHaveBeenCalled();
  });

  it('End Game limits to 2 winners max', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob', 'Carol']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('end-game-btn')).toBeTruthy();
    });
    screen.getByTestId('end-game-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('end-game-confirm')).toBeTruthy();
    });
    screen.getByTestId('winner-checkbox-Alice').click();
    await waitFor(() => {
      expect(screen.getByTestId('winner-checkbox-Alice').textContent).toContain('✅');
    });
    screen.getByTestId('winner-checkbox-Bob').click();
    await waitFor(() => {
      expect(screen.getByTestId('winner-checkbox-Bob').textContent).toContain('✅');
    });
    screen.getByTestId('winner-checkbox-Carol').click();
    // Third should not toggle on (still only 2 selected)
    screen.getByTestId('end-game-confirm-yes').click();
    await waitFor(() => {
      expect(mockedCompleteGame).toHaveBeenCalledWith(42, ['Alice', 'Bob']);
    });
  });

  it('End Game with winner calls completeGame and onBack', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    mockedCompleteGame.mockResolvedValue({});
    const onBack = vi.fn();
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByTestId('end-game-btn')).toBeTruthy();
    });
    screen.getByTestId('end-game-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('end-game-confirm')).toBeTruthy();
    });
    screen.getByTestId('winner-checkbox-Alice').click();
    await waitFor(() => {
      expect(screen.getByTestId('winner-checkbox-Alice').textContent).toContain('✅');
    });
    screen.getByTestId('end-game-confirm-yes').click();
    await waitFor(() => {
      expect(mockedCompleteGame).toHaveBeenCalledWith(42, ['Alice']);
      expect(onBack).toHaveBeenCalled();
    });
  });

  it('End Game confirmation can be cancelled', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('end-game-btn')).toBeTruthy();
    });
    screen.getByTestId('end-game-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('end-game-confirm')).toBeTruthy();
    });
    screen.getByTestId('end-game-confirm-no').click();
    await waitFor(() => {
      expect(screen.queryByTestId('end-game-confirm')).toBeNull();
    });
  });

  it('shows winner icon next to player with won result', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const rows = screen.getAllByTestId('hand-row');
      expect(rows[0].textContent).toContain('🏆');
    });
  });

  it('QR code is hidden by default', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('toggle-qr-btn')).toBeTruthy();
    });
    expect(screen.queryByTestId('qr-code-display')).toBeNull();
    expect(screen.getByTestId('toggle-qr-btn').textContent).toBe('Show QR');
  });

  it('toggle button shows/hides QR code', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('toggle-qr-btn')).toBeTruthy();
    });

    // Click to show
    screen.getByTestId('toggle-qr-btn').click();
    await waitFor(() => {
      expect(screen.queryAllByTestId('qr-code-display').length).toBe(1);
    });
    expect(screen.getByTestId('toggle-qr-btn').textContent).toBe('Hide QR');

    // Click to hide
    screen.getByTestId('toggle-qr-btn').click();
    await waitFor(() => {
      expect(screen.queryAllByTestId('qr-code-display').length).toBe(0);
    });
    expect(screen.getByTestId('toggle-qr-btn').textContent).toBe('Show QR');
  });

  it('QR toggle always visible', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('hand-list')).toBeTruthy();
    });
    expect(screen.getByTestId('toggle-qr-btn')).toBeTruthy();
  });

  it('always shows tile view (no 3D toggle)', async () => {
    mockedFetchHands.mockResolvedValue(HANDS);
    render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('hand-list')).toBeTruthy();
    });
    // 3D view toggle has been moved to ActiveHandDashboard
    expect(screen.queryByTestId('view-toggle-btn')).toBeNull();
    expect(screen.queryByTestId('table-view-3d')).toBeNull();
  });
});

const GAME_RESPONSE = {
  game_id: 42,
  game_date: '2026-04-08',
  status: 'active',
  created_at: '2026-04-08T10:00:00Z',
  player_names: ['Alice', 'Bob'],
  players: [
    { name: 'Alice', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
    { name: 'Bob', is_active: true, seat_number: null, buy_in: 100, rebuy_count: 0, total_rebuys: 0 },
  ],
  hand_count: 2,
  winners: [],
  default_buy_in: 100,
};

const GAME_STATS = {
  game_id: 42,
  game_date: '2026-04-08',
  total_hands: 2,
  player_stats: [
    { player_name: 'Alice', hands_played: 2, hands_won: 1, hands_lost: 1, hands_folded: 0, win_rate: 50, profit_loss: 50 },
    { player_name: 'Bob', hands_played: 2, hands_won: 1, hands_lost: 1, hands_folded: 0, win_rate: 50, profit_loss: -50 },
  ],
};

describe('HandDashboard — Player Totals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchHands.mockResolvedValue(HANDS);
    mockedFetchGame.mockResolvedValue(GAME_RESPONSE);
    mockedFetchGameStats.mockResolvedValue(GAME_STATS);
  });

  afterEach(() => {
    cleanup();
  });

  it('fetches game and stats on mount', async () => {
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(mockedFetchGame).toHaveBeenCalledWith(42);
      expect(mockedFetchGameStats).toHaveBeenCalledWith(42);
    });
  });

  it('shows Player Totals section with computed totals', async () => {
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const section = screen.getByTestId('player-totals');
      expect(section).toBeTruthy();
      // Alice: 100 + 0 + 50 = 150
      expect(section.textContent).toContain('Alice');
      expect(section.textContent).toContain('$150.00');
      // Bob: 100 + 0 + (-50) = 50
      expect(section.textContent).toContain('Bob');
      expect(section.textContent).toContain('$50.00');
    });
  });

  it('shows rebuy button disabled when total > 0', async () => {
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const aliceRebuy = screen.getByTestId('rebuy-btn-Alice');
      expect(aliceRebuy.hasAttribute('disabled')).toBe(true);
    });
  });

  it('shows rebuy button enabled when total <= 0', async () => {
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
        { player_name: 'Bob', hands_played: 2, hands_won: 2, hands_lost: 0, hands_folded: 0, win_rate: 100, profit_loss: 100 },
      ],
    });
    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      // Alice: 100 + 0 + (-100) = 0 → enabled
      const aliceRebuy = screen.getByTestId('rebuy-btn-Alice');
      expect(aliceRebuy.hasAttribute('disabled')).toBe(false);
      // Bob: 100 + 0 + 100 = 200 → disabled
      const bobRebuy = screen.getByTestId('rebuy-btn-Bob');
      expect(bobRebuy.hasAttribute('disabled')).toBe(true);
    });
  });

  it('rebuy button calls createRebuy and refreshes totals', async () => {
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
        { player_name: 'Bob', hands_played: 2, hands_won: 2, hands_lost: 0, hands_folded: 0, win_rate: 100, profit_loss: 100 },
      ],
    });
    mockedCreateRebuy.mockResolvedValue({ rebuy_id: 1, game_id: 42, player_name: 'Alice', amount: 100, created_at: '2026-04-08T12:00:00Z' });

    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('rebuy-btn-Alice')).toBeTruthy();
    });

    screen.getByTestId('rebuy-btn-Alice').click();

    await waitFor(() => {
      expect(mockedCreateRebuy).toHaveBeenCalledWith(42, 'Alice', { amount: 100 });
      // Should re-fetch game and stats after rebuy
      expect(mockedFetchGame.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockedFetchGameStats.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('rebuy button is disabled when buy_in is null', async () => {
    mockedFetchGame.mockResolvedValue({
      ...GAME_RESPONSE,
      players: [
        { name: 'Alice', is_active: true, seat_number: null, buy_in: null, rebuy_count: 0, total_rebuys: 0 },
      ],
    });
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
      ],
    });
    render(<HandDashboard gameId={42} players={['Alice']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const btn = screen.getByTestId('rebuy-btn-Alice');
      // buy_in is null so total = 0 + 0 + (-100) = -100 → canRebuy is true by total alone
      // but button should still be disabled because buy_in is null (no valid amount to rebuy)
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('rebuy button is disabled when buy_in is 0', async () => {
    mockedFetchGame.mockResolvedValue({
      ...GAME_RESPONSE,
      players: [
        { name: 'Alice', is_active: true, seat_number: null, buy_in: 0, rebuy_count: 0, total_rebuys: 0 },
      ],
    });
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
      ],
    });
    render(<HandDashboard gameId={42} players={['Alice']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      const btn = screen.getByTestId('rebuy-btn-Alice');
      expect(btn.hasAttribute('disabled')).toBe(true);
    });
  });

  it('shows error message when rebuy API fails', async () => {
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
        { player_name: 'Bob', hands_played: 2, hands_won: 2, hands_lost: 0, hands_folded: 0, win_rate: 100, profit_loss: 100 },
      ],
    });
    mockedCreateRebuy.mockRejectedValue(new Error('Rebuy amount must be greater than 0'));

    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('rebuy-btn-Alice')).toBeTruthy();
    });

    screen.getByTestId('rebuy-btn-Alice').click();

    await waitFor(() => {
      const errEl = screen.getByTestId('rebuy-error');
      expect(errEl).toBeTruthy();
      expect(errEl.textContent).toContain('Rebuy amount must be greater than 0');
    });
  });

  it('clears rebuy error on successful rebuy', async () => {
    mockedFetchGameStats.mockResolvedValue({
      ...GAME_STATS,
      player_stats: [
        { player_name: 'Alice', hands_played: 2, hands_won: 0, hands_lost: 2, hands_folded: 0, win_rate: 0, profit_loss: -100 },
        { player_name: 'Bob', hands_played: 2, hands_won: 2, hands_lost: 0, hands_folded: 0, win_rate: 100, profit_loss: 100 },
      ],
    });
    // First call fails, second succeeds
    mockedCreateRebuy
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({ rebuy_id: 1, game_id: 42, player_name: 'Alice', amount: 100, created_at: '2026-04-08T12:00:00Z' });

    render(<HandDashboard gameId={42} players={['Alice', 'Bob']} onSelectHand={() => {}} onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('rebuy-btn-Alice')).toBeTruthy();
    });

    // First click → error appears
    screen.getByTestId('rebuy-btn-Alice').click();
    await waitFor(() => {
      expect(screen.getByTestId('rebuy-error')).toBeTruthy();
    });

    // Second click → error clears on success
    screen.getByTestId('rebuy-btn-Alice').click();
    await waitFor(() => {
      expect(screen.queryByTestId('rebuy-error')).toBeNull();
    });
  });
});
