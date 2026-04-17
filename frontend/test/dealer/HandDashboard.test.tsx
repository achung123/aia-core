/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { HandDashboard } from '../../src/../src/dealer/HandDashboard.tsx';

vi.mock('../../src/api/client.ts', () => ({
  fetchHands: vi.fn(),
  startHand: vi.fn(),
  completeGame: vi.fn(),
  fetchGame: vi.fn().mockResolvedValue({
    players: [
      { name: 'Alice', is_active: true, seat_number: 1, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
      { name: 'Bob', is_active: true, seat_number: 2, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
    ],
  }),
  assignPlayerSeat: vi.fn(),
}));

vi.mock('../../src/../src/dealer/QRCodeDisplay.tsx', () => ({
  QRCodeDisplay: ({ gameId, visible }: { gameId: number; visible: boolean }) =>
    visible ? <div data-testid="qr-code-display">QR:{gameId}</div> : null,
}));

vi.mock('../../src/../src/dealer/GamePlayerManagement.tsx', () => ({
  GamePlayerManagement: ({ gameId }: { gameId: number }) =>
    <div data-testid="game-player-management">Players:{gameId}</div>,
}));

vi.mock('../../src/components/SeatPicker.tsx', () => ({
  SeatPicker: () => <div data-testid="seat-picker">SeatPicker</div>,
}));

import { fetchHands, startHand, completeGame, fetchGame } from '../../src/api/client.ts';


const mockedFetchHands = fetchHands as ReturnType<typeof vi.fn>;
const mockedStartHand = startHand as ReturnType<typeof vi.fn>;
const mockedCompleteGame = completeGame as ReturnType<typeof vi.fn>;
const mockedFetchGame = fetchGame as ReturnType<typeof vi.fn>;

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
      { player_hand_id: 3, hand_id: 2, player_id: 1, player_name: 'Alice', card_1: 'Qh', card_2: '9d', result: 'won', profit_loss: 10.0, outcome_street: 'river', winning_hand_description: null },
    ],
  },
];

describe('HandDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('Start Hand guard rails', () => {
    const COMPLETE_HANDS = [
      {
        hand_id: 1, game_id: 42, hand_number: 1,
        flop_1: 'Ah', flop_2: 'Kd', flop_3: '5h', turn: null, river: null,
        source_upload_id: null, created_at: '2026-04-08T10:00:00Z', pot: 0, side_pots: [],
        sb_player_name: null, bb_player_name: null,
        player_hands: [
          { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: 'won', profit_loss: 50.0, outcome_street: 'river', winning_hand_description: null },
          { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: 'lost', profit_loss: -25.0, outcome_street: 'turn', winning_hand_description: null },
        ],
      },
    ];

    const INCOMPLETE_HANDS = [
      ...COMPLETE_HANDS,
      {
        hand_id: 2, game_id: 42, hand_number: 2,
        flop_1: null, flop_2: null, flop_3: null, turn: null, river: null,
        source_upload_id: null, created_at: '2026-04-08T10:30:00Z', pot: 0, side_pots: [],
        sb_player_name: null, bb_player_name: null,
        player_hands: [
          { player_hand_id: 3, hand_id: 2, player_id: 1, player_name: 'Alice', card_1: 'Qh', card_2: '9d', result: null, profit_loss: null, outcome_street: null, winning_hand_description: null },
        ],
      },
    ];

    const TWO_ACTIVE_PLAYERS = {
      players: [
        { name: 'Alice', is_active: true, seat_number: 1, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
        { name: 'Bob', is_active: true, seat_number: 2, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
      ],
    };

    const ONE_ACTIVE_PLAYER = {
      players: [
        { name: 'Alice', is_active: true, seat_number: 1, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
        { name: 'Bob', is_active: false, seat_number: 2, buy_in: null, current_chips: null, rebuy_count: 0, total_rebuys: 0 },
      ],
    };

    it('disables Start Hand when the most recent hand is incomplete', async () => {
      mockedFetchHands.mockResolvedValue(INCOMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(TWO_ACTIVE_PLAYERS);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(true);
      });
    });

    it('shows warning when the most recent hand is incomplete', async () => {
      mockedFetchHands.mockResolvedValue(INCOMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(TWO_ACTIVE_PLAYERS);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        const warning = screen.getByTestId('start-hand-warning');
        expect(warning).toBeTruthy();
        expect(warning.textContent).toContain('Complete the current hand');
      });
    });

    it('disables Start Hand when only one active player', async () => {
      mockedFetchHands.mockResolvedValue(COMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(ONE_ACTIVE_PLAYER);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(true);
      });
    });

    it('shows warning when only one active player', async () => {
      mockedFetchHands.mockResolvedValue(COMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(ONE_ACTIVE_PLAYER);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        const warning = screen.getByTestId('start-hand-warning');
        expect(warning).toBeTruthy();
        expect(warning.textContent).toContain('Need at least 2 active players');
      });
    });

    it('enables Start Hand when last hand is complete and 2+ active players', async () => {
      mockedFetchHands.mockResolvedValue(COMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(TWO_ACTIVE_PLAYERS);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(false);
      });
      expect(screen.queryByTestId('start-hand-warning')).toBeNull();
    });

    it('enables Start Hand when no hands exist and 2+ active players', async () => {
      mockedFetchHands.mockResolvedValue([]);
      mockedFetchGame.mockResolvedValue(TWO_ACTIVE_PLAYERS);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(false);
      });
      expect(screen.queryByTestId('start-hand-warning')).toBeNull();
    });

    it('shows both warnings when hand is incomplete and only one active player', async () => {
      mockedFetchHands.mockResolvedValue(INCOMPLETE_HANDS);
      mockedFetchGame.mockResolvedValue(ONE_ACTIVE_PLAYER);
      render(<HandDashboard gameId={42} onSelectHand={() => {}} onBack={() => {}} />);
      await waitFor(() => {
        expect(screen.getByTestId('start-hand-btn').hasAttribute('disabled')).toBe(true);
        const warning = screen.getByTestId('start-hand-warning');
        expect(warning.textContent).toContain('Complete the current hand');
        expect(warning.textContent).toContain('Need at least 2 active players');
      });
    });
  });
});
