/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../api/client.ts', () => ({
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
}));

import { fetchBlinds } from '../api/client.ts';
import { ActiveHandDashboard } from './ActiveHandDashboard.tsx';
import type { ActiveHandDashboardProps } from './ActiveHandDashboard.tsx';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';

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
    // All empty
    for (const slot of slots) {
      expect(slot.textContent).toBe('');
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
    expect(slots[0].textContent).toBe('Ah');
    expect(slots[1].textContent).toBe('Kd');
    expect(slots[2].textContent).toBe('5c');
    expect(slots[3].textContent).toBe(''); // turn empty
    expect(slots[4].textContent).toBe(''); // river empty
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
    expect(slots[0].textContent).toBe('Ah');
    expect(slots[1].textContent).toBe('Kd');
    expect(slots[2].textContent).toBe('5c');
    expect(slots[3].textContent).toBe('Qh');
    expect(slots[4].textContent).toBe('9s');
  });

  // AC4: Blind info bar shows current level and SB/BB player names
  it('renders blind info bar with SB/BB player names', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    await vi.waitFor(() => {
      const bar = screen.getByTestId('blind-info-bar');
      expect(bar.textContent).toContain('Alice');
      expect(bar.textContent).toContain('Bob');
    });
  });

  it('fetches and displays blind levels', async () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(fetchBlinds).toHaveBeenCalledWith(42);
    await vi.waitFor(() => {
      const bar = screen.getByTestId('blind-info-bar');
      expect(bar.textContent).toContain('0.25');
      expect(bar.textContent).toContain('0.50');
    });
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

  // AC6: Showdown button shown
  it('renders Showdown button', () => {
    render(<ActiveHandDashboard {...defaultProps} />);
    expect(screen.getByTestId('showdown-btn')).not.toBeNull();
    expect(screen.getByTestId('showdown-btn').textContent).toContain('Showdown');
  });

  // Showdown enable/disable (AC1 of T-024)
  it('disables Showdown button when no community cards recorded', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
    ];
    render(<ActiveHandDashboard {...defaultProps} community={emptyCommunity} players={players} />);
    const btn = screen.getByTestId('showdown-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('disables Showdown button when fewer than 2 non-folded players have cards', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Js', flop2: 'Tc', flop3: '5h', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
    ];
    render(<ActiveHandDashboard {...defaultProps} community={community} players={players} />);
    const btn = screen.getByTestId('showdown-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Showdown button when community recorded and 2+ non-folded players have cards', () => {
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Js', flop2: 'Tc', flop3: '5h', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
    ];
    render(<ActiveHandDashboard {...defaultProps} community={community} players={players} />);
    const btn = screen.getByTestId('showdown-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('calls onShowdown when enabled Showdown button is clicked', () => {
    const onShowdown = vi.fn();
    const community: CommunityCards = {
      ...emptyCommunity, flop1: 'Js', flop2: 'Tc', flop3: '5h', flopRecorded: true,
    };
    const players: Player[] = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: '9s', card2: 'Tc', recorded: true, status: 'playing', outcomeStreet: null },
    ];
    render(<ActiveHandDashboard {...defaultProps} community={community} players={players} onShowdown={onShowdown} />);
    screen.getByTestId('showdown-btn').click();
    expect(onShowdown).toHaveBeenCalled();
  });

  // AC4 edge case: no SB/BB names
  it('renders blind info bar gracefully when no SB/BB names', async () => {
    render(
      <ActiveHandDashboard {...defaultProps} sbPlayerName={null} bbPlayerName={null} />,
    );
    await vi.waitFor(() => {
      const bar = screen.getByTestId('blind-info-bar');
      expect(bar.textContent).toContain('0.25');
      expect(bar.textContent).toContain('0.50');
    });
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
