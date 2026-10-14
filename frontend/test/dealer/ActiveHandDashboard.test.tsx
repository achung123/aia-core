/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../src/api/client.ts', () => ({
  fetchBlinds: vi.fn(() =>
    Promise.resolve({
      small_blind: 0.25,
      big_blind: 0.50,
      blind_timer_minutes: 15,
      blind_timer_paused: false,
      blind_timer_started_at: null,
      blind_timer_remaining_seconds: null,
    }),
  ),
  updateBlinds: vi.fn(),
  recordPlayerAction: vi.fn(),
  fetchHands: vi.fn(() => Promise.resolve([])),
  fetchEquity: vi.fn(() => Promise.resolve({ equities: [] })),
}));

vi.mock('../../src/../src/dealer/BlindTimer.tsx', () => ({
  BlindTimer: ({ gameId }: { gameId: number }) =>
    <div data-testid="blind-timer-component">BlindTimer:{gameId}</div>,
}));

vi.mock('../../src/../src/dealer/TableView3D.tsx', () => ({
  TableView3D: (props: { gameId: number; street?: string }) =>
    <div data-testid="table-view-3d" data-street={props.street ?? ''}>3D:{props.gameId}</div>,
}));

import { fetchBlinds, recordPlayerAction, fetchHands, fetchEquity } from '../../src/api/client.ts';
import { ActiveHandDashboard } from '../../src/../src/dealer/ActiveHandDashboard.tsx';
import type { ActiveHandDashboardProps } from '../../src/../src/dealer/ActiveHandDashboard.tsx';
import type { CommunityCards, Player } from '../../src/stores/dealerStore.ts';

const emptyCommunity: CommunityCards = {
  flop1: null,
  flop2: null,
  flop3: null,
  flopRecorded: false,
  turn: null,
  turnRecorded: false,
  river: null,
  riverRecorded: false,
};

const defaultPlayers: Player[] = [
  { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
  { name: 'Bob', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
  { name: 'Carol', card1: 'Ah', card2: 'Kd', recorded: true, status: 'won', outcomeStreet: 'river' },
  { name: 'Dave', card1: null, card2: null, recorded: false, status: 'joined', outcomeStreet: null },
];

const defaultProps: ActiveHandDashboardProps = {
  gameId: 42,
  community: emptyCommunity,
  players: defaultPlayers,
  sbPlayerName: 'Alice',
  bbPlayerName: 'Bob',
  onTileSelect: vi.fn(),
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  (fetchBlinds as ReturnType<typeof vi.fn>).mockResolvedValue({
    small_blind: 0.25,
    big_blind: 0.50,
    blind_timer_minutes: 15,
    blind_timer_paused: false,
    blind_timer_started_at: null,
    blind_timer_remaining_seconds: null,
  });
});

describe('ActiveHandDashboard', () => {
  // AC1: Player tiles show name, participation status, and last action
  it('renders player tiles with name and status', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);
    expect(rows.length).toBe(4);

    expect(rows[0].textContent).toContain('Alice');
    expect(rows[0].textContent).toContain('playing');

    expect(rows[1].textContent).toContain('Bob');
    expect(rows[1].textContent).toContain('folded');
    expect(rows[1].textContent).toContain('flop');

    expect(rows[2].textContent).toContain('Carol');
    expect(rows[2].textContent).toContain('won');
    expect(rows[2].textContent).toContain('river');

    expect(rows[3].textContent).toContain('Dave');
    expect(rows[3].textContent).toContain('joined');
  });

  // AC2: Tile colors use the existing statusColors mapping
  it('sets tile background color based on player status', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);

    expect(rows[0].style.backgroundColor).toBe('#ffffff'); // playing
    expect(rows[1].style.backgroundColor).toBe('#fecaca'); // folded
    expect(rows[2].style.backgroundColor).toBe('#bbf7d0'); // won
    expect(rows[3].style.backgroundColor).toBe('#bbf7d0'); // joined
  });

  // AC3: Board area shows 5 slots filled as captured
  it('renders 5 community card slots all empty initially', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const board = screen.getByTestId('community-board');
    expect(board).not.toBeNull();
    const slots = board.querySelectorAll('[data-testid^="board-slot-"]');
    expect(slots.length).toBe(5);
    // All empty — PlayingCard renders '—' for null cards
    for (const slot of slots) {
      expect(slot.textContent).toBe('—');
    }
  });

  it('renders community cards in board slots when captured', () => {
    const withFlop: CommunityCards = {
      ...emptyCommunity,
      flop1: 'Ah',
      flop2: 'Kd',
      flop3: '5c',
      flopRecorded: true,
    };
    render(<ActiveHandDashboard {...defaultProps} community={withFlop} />);
    const board = screen.getByTestId('community-board');
    const slots = board.querySelectorAll('[data-testid^="board-slot-"]');
    expect(slots[0].textContent).toBe('A♥');
    expect(slots[1].textContent).toBe('K♦');
    expect(slots[2].textContent).toBe('5♣');
    expect(slots[3].textContent).toBe('—'); // turn empty
    expect(slots[4].textContent).toBe('—'); // river empty
  });

  it('fills turn and river slots when captured', () => {
    const full: CommunityCards = {
      flop1: 'Ah',
      flop2: 'Kd',
      flop3: '5c',
      flopRecorded: true,
      turn: 'Qh',
      turnRecorded: true,
      river: '9s',
      riverRecorded: true,
    };
    render(<ActiveHandDashboard {...defaultProps} community={full} />);
    const board = screen.getByTestId('community-board');
    const slots = board.querySelectorAll('[data-testid^="board-slot-"]');
    expect(slots[0].textContent).toBe('A♥');
    expect(slots[1].textContent).toBe('K♦');
    expect(slots[2].textContent).toBe('5♣');
    expect(slots[3].textContent).toBe('Q♥');
    expect(slots[4].textContent).toBe('9♠');
  });

  // AC4: Blind info bar shows BlindTimer component and SB/BB player names
  it('renders BlindTimer component in blind info bar', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.getByTestId('blind-timer-component')).toBeTruthy();
    expect(screen.getByTestId('blind-timer-component').textContent).toContain('BlindTimer:42');
  });

  it('renders SB/BB player names in blind info bar', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const bar = screen.getByTestId('blind-info-bar');
    expect(bar.textContent).toContain('Alice');
    expect(bar.textContent).toContain('Bob');
  });

  it('fetches blinds for BlindTimer via gameId prop', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.getByTestId('blind-timer-component').textContent).toContain('42');
  });

  // AC5: Take Flop / Take Turn / Take River buttons shown
  it('renders Take Flop, Take Turn, and Take River buttons', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.getByTestId('flop-tile')).not.toBeNull();
    expect(screen.getByTestId('turn-tile')).not.toBeNull();
    expect(screen.getByTestId('river-tile')).not.toBeNull();
  });

  it('disables Turn button when flop not recorded', () => {
    render(<ActiveHandDashboard {...defaultProps} community={emptyCommunity} />);
    const turnBtn = screen.getByTestId('turn-tile') as HTMLButtonElement;
    expect(turnBtn.disabled).toBe(true);
  });

  it('enables Turn button when flop is recorded', () => {
    const withFlop: CommunityCards = {
      ...emptyCommunity,
      flop1: 'Ah',
      flop2: 'Kd',
      flop3: '5c',
      flopRecorded: true,
    };
    render(<ActiveHandDashboard {...defaultProps} community={withFlop} />);
    const turnBtn = screen.getByTestId('turn-tile') as HTMLButtonElement;
    expect(turnBtn.disabled).toBe(false);
  });

  // Showdown button removed — street row has only Flop/Turn/River
  it('does not render Showdown button', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.queryByTestId('showdown-btn')).toBeNull();
  });

  // AC4 edge case: no SB/BB names
  it('renders blind info bar gracefully when no SB/BB names', async () => {
    render(
      <ActiveHandDashboard {...defaultProps} sbPlayerName={null} bbPlayerName={null} />,
    );
    // BlindTimer should still render
    expect(screen.getByTestId('blind-timer-component')).toBeTruthy();
  });

  // Callbacks
  it('calls onTileSelect when a player tile is clicked', async () => {
    const onTileSelect = vi.fn();
    render(<ActiveHandDashboard {...defaultProps} onTileSelect={onTileSelect} />);
    screen.getByTestId('player-tile-Alice').click();
    expect(onTileSelect).toHaveBeenCalledWith('Alice');
  });

  it('calls onTileSelect when a street button is clicked', () => {
    const onTileSelect = vi.fn();
    render(<ActiveHandDashboard {...defaultProps} onTileSelect={onTileSelect} />);
    screen.getByTestId('flop-tile').click();
    expect(onTileSelect).toHaveBeenCalledWith('flop');
  });

  it('calls onBack when Back button is clicked', () => {
    const onBack = vi.fn();
    render(<ActiveHandDashboard {...defaultProps} onBack={onBack} />);
    screen.getByTestId('back-btn').click();
    expect(onBack).toHaveBeenCalled();
  });

  it('renders Finish Hand button when canFinish is true', () => {
    render(<ActiveHandDashboard {...defaultProps} canFinish={true} onFinishHand={vi.fn()} />);
    const btn = screen.queryByText('Finish Hand');
    expect(btn).not.toBeNull();
  });

  it('does not render Finish Hand button when canFinish is false', () => {
    render(<ActiveHandDashboard {...defaultProps} canFinish={false} />);
    const btn = screen.queryByText('Finish Hand');
    expect(btn).toBeNull();
  });

  // T-053: Split-screen dealer input layout
  describe('Split-screen layout', () => {
    function mockMatchMedia(matches: boolean) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }

    // AC1: ≥600px splits into board-panel (top) and player-panel (bottom)
    it('renders split layout panels with independent scroll on wide viewports', () => {
      mockMatchMedia(true);
      render(<ActiveHandDashboard {...defaultProps} />);
      const boardPanel = screen.getByTestId('board-panel');
      const playerPanel = screen.getByTestId('player-panel');
      expect(boardPanel).toBeTruthy();
      expect(playerPanel).toBeTruthy();
      // AC3: independent scroll
      expect(boardPanel.style.overflowY).toBe('auto');
      expect(playerPanel.style.overflowY).toBe('auto');
    });

    // AC2: <600px stacked single-column (no split overflow)
    it('renders stacked layout without split scroll on narrow viewports', () => {
      mockMatchMedia(false);
      render(<ActiveHandDashboard {...defaultProps} />);
      const boardPanel = screen.getByTestId('board-panel');
      const playerPanel = screen.getByTestId('player-panel');
      // In narrow mode, panels exist but no independent scroll
      expect(boardPanel.style.overflowY).not.toBe('auto');
      expect(playerPanel.style.overflowY).not.toBe('auto');
    });

    // AC4: Blind info bar sticky
    it('blind info bar has sticky positioning', () => {
      mockMatchMedia(true);
      render(<ActiveHandDashboard {...defaultProps} />);
      const bar = screen.getByTestId('blind-info-bar');
      expect(bar.style.position).toBe('sticky');
      expect(bar.style.top).toBe('0px');
    });

    // AC5: CSS flexbox layout
    it('uses flexbox for the split layout container', () => {
      mockMatchMedia(true);
      render(<ActiveHandDashboard {...defaultProps} />);
      const layout = screen.getByTestId('active-hand-layout');
      expect(layout.style.display).toBe('flex');
    });

    // AC1+AC2: container fills viewport height on wide, normal on narrow
    it('wide container fills viewport height', () => {
      mockMatchMedia(true);
      render(<ActiveHandDashboard {...defaultProps} />);
      const layout = screen.getByTestId('active-hand-layout');
      expect(layout.style.flexDirection).toBe('column');
      expect(layout.style.flex).toContain('1');
    });

    it('narrow container does not force split flex', () => {
      mockMatchMedia(false);
      render(<ActiveHandDashboard {...defaultProps} />);
      const layout = screen.getByTestId('active-hand-layout');
      expect(layout.style.flex).not.toBe('1');
    });
  });
});

describe('ActiveHandDashboard — 3D view toggle', () => {
  const mockedFetchHands = fetchHands as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockedFetchHands.mockResolvedValue([]);
  });

  it('shows view toggle defaulting to tile view', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const btn = screen.getByTestId('view-toggle-btn');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('3D View');
    expect(screen.queryByTestId('table-view-3d')).toBeNull();
  });

  it('clicking 3D View fetches hands and shows 3D component', async () => {
    mockedFetchHands.mockResolvedValue([
      {
        hand_id: 1, hand_number: 1, game_session_id: 42,
        flop_1: null, flop_2: null, flop_3: null, turn: null, river: null,
        created_at: '2026-04-13T00:00:00Z', player_hands: [],
      },
    ]);
    render(<ActiveHandDashboard {...defaultProps} />);
    screen.getByTestId('view-toggle-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('table-view-3d')).toBeTruthy();
    });
    expect(screen.getByTestId('view-toggle-btn').textContent).toContain('Tile View');
  });

  it('clicking Tile View restores normal content', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    // Switch to 3D
    screen.getByTestId('view-toggle-btn').click();
    await waitFor(() => {
      expect(screen.getByTestId('table-view-3d')).toBeTruthy();
    });
    // Switch back to tile
    screen.getByTestId('view-toggle-btn').click();
    await waitFor(() => {
      expect(screen.queryByTestId('table-view-3d')).toBeNull();
    });
    expect(screen.getByTestId('board-panel')).toBeTruthy();
  });
});

describe('ActiveHandDashboard — bet info display (no record action)', () => {
  const betProps: ActiveHandDashboardProps = {
    ...defaultProps,
    handNumber: 1,
    currentPlayerName: 'Alice',
    legalActions: ['call', 'raise', 'fold'],
    amountToCall: 0.50,
    minimumRaise: 1.00,
    pot: 1.50,
  };

  it('shows "Waiting for turn" when no current player', () => {
    render(<ActiveHandDashboard {...defaultProps} handNumber={1} currentPlayerName={null} />);
    const panel = screen.getByTestId('bet-verify-panel');
    expect(panel.textContent).toContain('Waiting for turn');
  });

  it('shows current player name when it is their turn', () => {
    render(<ActiveHandDashboard {...betProps} />);
    const panel = screen.getByTestId('bet-verify-panel');
    expect(panel.textContent).toContain('Turn: Alice');
  });

  it('displays pot amount', () => {
    render(<ActiveHandDashboard {...betProps} />);
    expect(screen.getByTestId('pot-display').textContent).toContain('$1.50');
  });

  it('displays legal actions and amount to call', () => {
    render(<ActiveHandDashboard {...betProps} />);
    const display = screen.getByTestId('legal-actions-display');
    expect(display.textContent).toContain('call, raise, fold');
    expect(display.textContent).toContain('$0.50 to call');
    expect(display.textContent).toContain('min raise $1.00');
  });

  it('does NOT render a record action button', () => {
    render(<ActiveHandDashboard {...betProps} />);
    expect(screen.queryByTestId('record-action-btn')).toBeNull();
  });

  it('does NOT render an override form', () => {
    render(<ActiveHandDashboard {...betProps} />);
    expect(screen.queryByTestId('override-form')).toBeNull();
    expect(screen.queryByTestId('override-action-select')).toBeNull();
    expect(screen.queryByTestId('override-amount-input')).toBeNull();
    expect(screen.queryByTestId('override-submit-btn')).toBeNull();
  });

  it('does not show bet verify panel when no handNumber', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.queryByTestId('bet-verify-panel')).toBeNull();
  });
});

describe('ActiveHandDashboard — disable completed streets', () => {
  const flopRecorded: CommunityCards = {
    ...emptyCommunity,
    flop1: 'Ah', flop2: 'Kd', flop3: '5c', flopRecorded: true,
  };

  it('keeps flop button enabled when flop is recorded and handPhase is turn (re-editing allowed)', () => {
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={flopRecorded}
        handPhase="turn"
        handNumber={1}
      />,
    );
    const flopBtn = screen.getByTestId('flop-tile') as HTMLButtonElement;
    expect(flopBtn.disabled).toBe(false);
  });

  it('keeps flop enabled when phase is still preflop', () => {
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={emptyCommunity}
        handPhase="preflop"
        handNumber={1}
      />,
    );
    const flopBtn = screen.getByTestId('flop-tile') as HTMLButtonElement;
    expect(flopBtn.disabled).toBe(false);
  });

  it('keeps turn button enabled when turn is recorded and handPhase is river (re-editing allowed)', () => {
    const turnRecorded: CommunityCards = {
      ...flopRecorded,
      turn: 'Qh', turnRecorded: true,
    };
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={turnRecorded}
        handPhase="river"
        handNumber={1}
      />,
    );
    const turnBtn = screen.getByTestId('turn-tile') as HTMLButtonElement;
    expect(turnBtn.disabled).toBe(false);
  });

  it('keeps all street buttons enabled at showdown when all cards are recorded (re-editing allowed)', () => {
    const allRecorded: CommunityCards = {
      flop1: 'Ah', flop2: 'Kd', flop3: '5c', flopRecorded: true,
      turn: 'Qh', turnRecorded: true,
      river: '9s', riverRecorded: true,
    };
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={allRecorded}
        handPhase="showdown"
        handNumber={1}
      />,
    );
    expect((screen.getByTestId('flop-tile') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('turn-tile') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId('river-tile') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ActiveHandDashboard — 3D view has street scrubber', () => {
  const mockedFetchHands = fetchHands as ReturnType<typeof vi.fn>;
  const handData = [{
    hand_id: 1, hand_number: 1, game_id: 42,
    flop_1: 'Ah', flop_2: 'Kd', flop_3: '5c', turn: 'Qh', river: null,
    created_at: '2026-04-13T00:00:00Z', player_hands: [],
    sb_player_name: null, bb_player_name: null, source_upload_id: null,
  }];

  it('shows street scrubber when in 3D view mode', async () => {
    mockedFetchHands.mockResolvedValue(handData);
    render(<ActiveHandDashboard {...defaultProps} />);
    fireEvent.click(screen.getByTestId('view-toggle-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('table-view-3d')).toBeTruthy();
    });
    expect(screen.getByTestId('street-scrubber')).toBeTruthy();
    expect(screen.getByTestId('table-view-3d').getAttribute('data-street')).toBe('Pre-Flop');
  });

  it('forwards the selected 3D street into TableView3D', async () => {
    mockedFetchHands.mockResolvedValue(handData);
    render(<ActiveHandDashboard {...defaultProps} />);
    fireEvent.click(screen.getByTestId('view-toggle-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('table-view-3d')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('street-showdown'));
    await waitFor(() => {
      expect(screen.getByTestId('table-view-3d').getAttribute('data-street')).toBe('Showdown');
    });
  });

  it('keeps folded players in the dealer equity row with 0.0% when omitted by the endpoint', async () => {
    mockedFetchHands.mockResolvedValue(handData);
    (fetchEquity as ReturnType<typeof vi.fn>).mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.72, winning_hand_description: null },
      ],
    });

    render(
      <ActiveHandDashboard
        {...defaultProps}
        handNumber={1}
        players={[
          { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
          { name: 'Bob', card1: '7s', card2: '8s', recorded: true, status: 'folded', outcomeStreet: 'flop' },
        ]}
      />,
    );

    fireEvent.click(screen.getByTestId('view-toggle-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('dealer-equity-row')).toBeTruthy();
    });

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('72.0%')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('0.0%')).toBeTruthy();
  });
});

describe('ActiveHandDashboard — player last action display removed', () => {
  it('does not display last action next to player name', () => {
    const playersWithActions: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null, lastAction: 'raise' },
      { name: 'Bob', card1: '7s', card2: '8s', recorded: true, status: 'folded', outcomeStreet: 'preflop', lastAction: 'fold' },
      { name: 'Carol', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: 'check' },
    ];
    render(
      <ActiveHandDashboard
        {...defaultProps}
        players={playersWithActions}
      />,
    );
    expect(screen.queryByTestId('last-action-Alice')).toBeNull();
    expect(screen.queryByTestId('last-action-Bob')).toBeNull();
    expect(screen.queryByTestId('last-action-Carol')).toBeNull();
  });

  it('does not show checkmark emoji on player tiles', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const carolRow = screen.getByTestId('player-row-Carol');
    expect(carolRow.textContent).not.toContain('✅');
  });
});

describe('ActiveHandDashboard — pot contribution display', () => {
  it('shows pot contribution on player tiles when provided', () => {
    render(
      <ActiveHandDashboard
        {...defaultProps}
        potContributions={{ Alice: 0.10, Bob: 0.20 }}
      />,
    );
    const aliceRow = screen.getByTestId('player-row-Alice');
    expect(aliceRow.textContent).toContain('$0.10');
    const bobRow = screen.getByTestId('player-row-Bob');
    expect(bobRow.textContent).toContain('$0.20');
  });

  it('does not show pot contribution badge when value is zero', () => {
    render(
      <ActiveHandDashboard
        {...defaultProps}
        potContributions={{ Alice: 0, Bob: 0 }}
      />,
    );
    const aliceRow = screen.getByTestId('player-row-Alice');
    expect(aliceRow.querySelector('[data-testid="pot-contrib-Alice"]')).toBeNull();
  });

  it('does not show pot contribution badge when potContributions is not provided', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    const aliceRow = screen.getByTestId('player-row-Alice');
    expect(aliceRow.querySelector('[data-testid="pot-contrib-Alice"]')).toBeNull();
  });
});

describe('ActiveHandDashboard — street buttons call onStreetCapture', () => {
  it('calls onStreetCapture (not onTileSelect) when Flop button is clicked', () => {
    const onTileSelect = vi.fn();
    const onStreetCapture = vi.fn();
    render(
      <ActiveHandDashboard
        {...defaultProps}
        onTileSelect={onTileSelect}
        onStreetCapture={onStreetCapture}
      />,
    );
    screen.getByTestId('flop-tile').click();
    expect(onStreetCapture).toHaveBeenCalledWith('flop');
    expect(onTileSelect).not.toHaveBeenCalledWith('flop');
  });

  it('calls onStreetCapture for Turn button', () => {
    const onTileSelect = vi.fn();
    const onStreetCapture = vi.fn();
    const withFlop: CommunityCards = {
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: '5c', flopRecorded: true,
    };
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={withFlop}
        onTileSelect={onTileSelect}
        onStreetCapture={onStreetCapture}
      />,
    );
    screen.getByTestId('turn-tile').click();
    expect(onStreetCapture).toHaveBeenCalledWith('turn');
    expect(onTileSelect).not.toHaveBeenCalledWith('turn');
  });

  it('calls onStreetCapture for River button', () => {
    const onTileSelect = vi.fn();
    const onStreetCapture = vi.fn();
    const withTurn: CommunityCards = {
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: '5c', flopRecorded: true,
      turn: 'Qh', turnRecorded: true,
    };
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={withTurn}
        onTileSelect={onTileSelect}
        onStreetCapture={onStreetCapture}
      />,
    );
    screen.getByTestId('river-tile').click();
    expect(onStreetCapture).toHaveBeenCalledWith('river');
    expect(onTileSelect).not.toHaveBeenCalledWith('river');
  });

  it('clicking a recorded board card calls onTileSelect (for correction)', () => {
    const onTileSelect = vi.fn();
    const onStreetCapture = vi.fn();
    const withFlop: CommunityCards = {
      ...emptyCommunity,
      flop1: 'Ah', flop2: 'Kd', flop3: '5c', flopRecorded: true,
    };
    render(
      <ActiveHandDashboard
        {...defaultProps}
        community={withFlop}
        onTileSelect={onTileSelect}
        onStreetCapture={onStreetCapture}
      />,
    );
    // Click on the first board card (a recorded flop card)
    screen.getByTestId('board-slot-0').click();
    expect(onTileSelect).toHaveBeenCalledWith('flop');
    expect(onStreetCapture).not.toHaveBeenCalled();
  });

  it('falls back to onTileSelect when onStreetCapture is not provided', () => {
    const onTileSelect = vi.fn();
    render(
      <ActiveHandDashboard
        {...defaultProps}
        onTileSelect={onTileSelect}
      />,
    );
    screen.getByTestId('flop-tile').click();
    expect(onTileSelect).toHaveBeenCalledWith('flop');
  });

  // The banner shown once betting on a street has finished and nobody is up
  // to act. After everyone checks or calls that is the ordinary case, so it
  // must not claim an all-in unless players are really all-in.
  describe('betting-closed banner', () => {
    const panelText = (props: Partial<ActiveHandDashboardProps>) => {
      render(
        <ActiveHandDashboard
          {...defaultProps}
          handNumber={1}
          currentPlayerName={null}
          legalActions={[]}
          streetComplete={true}
          handPhase="preflop"
          {...props}
        />,
      );
      return screen.getByTestId('bet-verify-panel').textContent ?? '';
    };

    it('says betting is complete and what to deal when players are simply still in', () => {
      const text = panelText({ handPhase: 'preflop' });
      expect(text).toContain('Betting complete');
      expect(text).toContain('deal the flop');
      expect(text).not.toMatch(/all-in/i);
    });

    it('names the right next street from the board', () => {
      const flop: CommunityCards = {
        ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: '9c', flopRecorded: true,
      };
      expect(panelText({ community: flop, handPhase: 'flop' })).toContain('deal the turn');
      cleanup();
      const turn: CommunityCards = { ...flop, turn: '4s', turnRecorded: true };
      expect(panelText({ community: turn, handPhase: 'turn' })).toContain('deal the river');
    });

    it('tells the dealer to finish the hand once the river is down', () => {
      const river: CommunityCards = {
        ...emptyCommunity, flop1: 'Ah', flop2: 'Kd', flop3: '9c', flopRecorded: true,
        turn: '4s', turnRecorded: true, river: '2h', riverRecorded: true,
      };
      const text = panelText({ community: river, handPhase: 'river' });
      expect(text).toContain('finish the hand');
      expect(text).not.toMatch(/all-in/i);
    });

    it('says all players are all-in only when every remaining player is', () => {
      const text = panelText({ allInPlayers: defaultPlayers.map((player) => player.name) });
      expect(text).toContain('All players are all-in');
    });

    it('says how many are all-in when one player still has chips', () => {
      const names = defaultPlayers.map((player) => player.name);
      const text = panelText({ allInPlayers: names.slice(0, names.length - 1) });
      expect(text).not.toContain('All players');
      expect(text).toMatch(/all-in, no more betting/);
    });

    it('ignores an all-in player who has folded', () => {
      const folded = defaultPlayers.map((player, index) =>
        index === 0 ? { ...player, status: 'folded' } : player,
      );
      const text = panelText({ players: folded, allInPlayers: [defaultPlayers[0].name] });
      expect(text).not.toMatch(/all-in/i);
      expect(text).toContain('Betting complete');
    });

    it('is not shown while waiting for cards or when a player has the turn', () => {
      expect(panelText({ handPhase: 'awaiting_cards' })).toContain('Waiting for cards');
      cleanup();
      const text = panelText({
        currentPlayerName: 'Alice',
        legalActions: ['call', 'raise', 'fold'],
        streetComplete: false,
        handPhase: 'flop',
      });
      expect(text).toContain('Turn: Alice');
      expect(text).not.toMatch(/all-in|Betting complete/i);
    });
  });
});

describe('ActiveHandDashboard — 3D view follows the live street', () => {
  const withFlop: CommunityCards = {
    ...emptyCommunity,
    flop1: 'Ah', flop2: 'Kd', flop3: '9c', flopRecorded: true,
  };
  const withTurn: CommunityCards = { ...withFlop, turn: '4s', turnRecorded: true };

  const street = () => screen.getByTestId('table-view-3d').getAttribute('data-street');

  async function openThreeD(props: ActiveHandDashboardProps) {
    const view = render(<ActiveHandDashboard {...props} />);
    fireEvent.click(screen.getByTestId('view-toggle-btn'));
    await screen.findByTestId('table-view-3d');
    return view;
  }

  it('opens on the street the hand has reached', async () => {
    await openThreeD({ ...defaultProps, handNumber: 1, community: withFlop });
    await waitFor(() => expect(street()).toBe('Flop'));
  });

  it('moves along as cards are dealt', async () => {
    const props = { ...defaultProps, handNumber: 1 };
    const view = await openThreeD(props);
    expect(street()).toBe('Pre-Flop');

    view.rerender(<ActiveHandDashboard {...props} community={withFlop} />);
    await waitFor(() => expect(street()).toBe('Flop'));

    view.rerender(<ActiveHandDashboard {...props} community={withTurn} />);
    await waitFor(() => expect(street()).toBe('Turn'));
  });

  it('stays where the dealer scrubbed to, until they return to the latest street', async () => {
    const props = { ...defaultProps, handNumber: 1, community: withFlop };
    const view = await openThreeD(props);
    await waitFor(() => expect(street()).toBe('Flop'));

    // Look back at the preflop; the turn is then dealt
    fireEvent.click(screen.getByText('Pre-Flop'));
    expect(street()).toBe('Pre-Flop');
    view.rerender(<ActiveHandDashboard {...props} community={withTurn} />);
    await waitFor(() => expect(street()).toBe('Pre-Flop'));

    // Back on the newest street: following resumes
    fireEvent.click(screen.getByText('Turn'));
    expect(street()).toBe('Turn');
  });
});
