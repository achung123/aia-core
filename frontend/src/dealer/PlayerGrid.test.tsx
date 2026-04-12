/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PlayerGrid } from './PlayerGrid.tsx';
import type { PlayerGridProps } from './PlayerGrid.tsx';
import type { CommunityCards, Player } from '../stores/dealerStore.ts';

const emptyCommunity: CommunityCards = {
  flop1: null, flop2: null, flop3: null, flopRecorded: false,
  turn: null, turnRecorded: false, river: null, riverRecorded: false,
};

const defaultPlayers: Player[] = [
  { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
  { name: 'Bob', card1: null, card2: null, recorded: true, status: 'won', outcomeStreet: 'river' },
  { name: 'Carol', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
  { name: 'Dave', card1: null, card2: null, recorded: false, status: 'lost', outcomeStreet: 'turn' },
  { name: 'Eve', card1: null, card2: null, recorded: false, status: 'not_playing', outcomeStreet: null },
];

const defaultProps: PlayerGridProps = {
  players: defaultPlayers,
  community: emptyCommunity,
  onTileSelect: vi.fn(),
  onBack: vi.fn(),
  canFinish: false,
  onFinishHand: vi.fn(),
};

describe('PlayerGrid', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders player name and status text on each tile', () => {
    render(<PlayerGrid {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);
    expect(rows.length).toBe(5);

    expect(rows[0].textContent).toContain('Alice');
    expect(rows[0].textContent).toContain('playing');

    expect(rows[1].textContent).toContain('Bob');
    expect(rows[1].textContent).toContain('won');
    expect(rows[1].textContent).toContain('river');

    expect(rows[2].textContent).toContain('Carol');
    expect(rows[2].textContent).toContain('folded');
    expect(rows[2].textContent).toContain('flop');

    expect(rows[3].textContent).toContain('Dave');
    expect(rows[3].textContent).toContain('lost');
    expect(rows[3].textContent).toContain('turn');

    expect(rows[4].textContent).toContain('Eve');
    expect(rows[4].textContent).toContain('not playing');
  });

  it('sets background color based on player status', () => {
    render(<PlayerGrid {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);

    expect(rows[0].style.backgroundColor).toBe('#ffffff'); // playing = white
    expect(rows[1].style.backgroundColor).toBe('#bbf7d0'); // won = green
    expect(rows[2].style.backgroundColor).toBe('#fecaca'); // folded = red
    expect(rows[3].style.backgroundColor).toBe('#fed7aa'); // lost = orange
    expect(rows[4].style.backgroundColor).toBe('#e5e7eb'); // not_playing = gray
  });

  it('renders player rows with adequate min-height', () => {
    render(<PlayerGrid {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);
    for (const row of rows) {
      expect(parseInt(row.style.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });

  it('does not show outcome button for not_playing player', () => {
    const onDirectOutcome = vi.fn();
    render(<PlayerGrid {...defaultProps} onDirectOutcome={onDirectOutcome} />);
    expect(screen.queryByTestId('outcome-btn-Eve')).toBeNull();
  });

  it('shows ✅ on Flop tile when flop is recorded', () => {
    const recordedCommunity: CommunityCards = { ...emptyCommunity, flopRecorded: true, flop1: 'Ah', flop2: 'Kd', flop3: '5c' };
    render(<PlayerGrid {...defaultProps} community={recordedCommunity} />);
    const flopTile = screen.getByTestId('flop-tile');
    expect(flopTile.textContent).toContain('Flop');
    expect(flopTile.textContent).toContain('✅');
  });

  it('does not show ✅ on Flop tile when flop is not recorded', () => {
    render(<PlayerGrid {...defaultProps} community={emptyCommunity} />);
    const flopTile = screen.getByTestId('flop-tile');
    expect(flopTile.textContent).toContain('Flop');
    expect(flopTile.textContent).not.toContain('✅');
  });

  it('shows ✅ on player tile when recorded', () => {
    render(<PlayerGrid {...defaultProps} />);
    const bobRow = screen.getByTestId('player-row-Bob');
    expect(bobRow.textContent).toContain('✅');
  });

  it('renders a back button that calls onBack', () => {
    const onBack = vi.fn();
    render(<PlayerGrid {...defaultProps} onBack={onBack} />);
    const backBtn = screen.getByTestId('back-btn');
    backBtn.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders street tiles above the player rows', () => {
    render(<PlayerGrid {...defaultProps} />);
    const streetButtons = screen.getByTestId('street-buttons');
    const playerList = screen.getByTestId('player-list');
    expect(streetButtons).toBeTruthy();
    expect(playerList).toBeTruthy();
    const flopTile = screen.getByTestId('flop-tile');
    expect(playerList.contains(flopTile)).toBe(false);
  });

  it('renders each player as a row with name column and status column', () => {
    render(<PlayerGrid {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);
    expect(rows.length).toBe(5);

    const aliceRow = screen.getByTestId('player-row-Alice');
    expect(aliceRow.textContent).toContain('Alice');
    expect(aliceRow.textContent).toContain('playing');
  });

  it('shows outcome button for handed_back players', () => {
    const onDirectOutcome = vi.fn();
    const players: Player[] = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
      { name: 'Bob', card1: null, card2: null, recorded: true, status: 'handed_back', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} onDirectOutcome={onDirectOutcome} />);
    expect(screen.getByTestId('outcome-btn-Bob')).toBeTruthy();
    expect(screen.queryByTestId('outcome-btn-Alice')).toBeNull();
  });

  it('clicking outcome button on handed_back player calls onDirectOutcome', () => {
    const onDirectOutcome = vi.fn();
    const players: Player[] = [
      { name: 'Bob', card1: null, card2: null, recorded: true, status: 'handed_back', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} onDirectOutcome={onDirectOutcome} />);
    screen.getByTestId('outcome-btn-Bob').click();
    expect(onDirectOutcome).toHaveBeenCalledWith('Bob');
  });

  it('sets background color for pending participation status', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'pending', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.style.backgroundColor).toBe('#fef08a');
  });

  it('sets background color for joined participation status', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'joined', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.style.backgroundColor).toBe('#bbf7d0');
  });

  it('sets background color for handed_back participation status', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.style.backgroundColor).toBe('#fef08a');
  });

  it('formats pending status text as "pending"', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'pending', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.textContent).toContain('pending');
  });

  it('formats joined status text as "joined"', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'joined', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.textContent).toContain('joined');
  });

  it('formats handed_back status text as decision prompt', () => {
    const players: Player[] = [
      { name: 'Zara', card1: null, card2: null, recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    render(<PlayerGrid {...defaultProps} players={players} />);
    const row = screen.getByTestId('player-row-Zara');
    expect(row.textContent).toContain('Decide outcome');
  });

  it('preserves existing status colors when new statuses are added', () => {
    render(<PlayerGrid {...defaultProps} />);
    const rows = screen.getAllByTestId(/^player-row-/);
    expect(rows[0].style.backgroundColor).toBe('#ffffff'); // playing
    expect(rows[1].style.backgroundColor).toBe('#bbf7d0'); // won
    expect(rows[2].style.backgroundColor).toBe('#fecaca'); // folded
    expect(rows[3].style.backgroundColor).toBe('#fed7aa'); // lost
    expect(rows[4].style.backgroundColor).toBe('#e5e7eb'); // not_playing
  });

  describe('participation mode — sit-out button', () => {
    const participationPlayers: Player[] = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
      { name: 'Dan', card1: null, card2: null, recorded: false, status: 'idle', outcomeStreet: null },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'pending', outcomeStreet: null },
      { name: 'Carol', card1: null, card2: null, recorded: false, status: 'handed_back', outcomeStreet: null },
    ];

    it('shows sit-out button for playing-status players', () => {
      const onMarkNotPlaying = vi.fn();
      render(
        <PlayerGrid
          {...defaultProps}
          players={participationPlayers}
          onMarkNotPlaying={onMarkNotPlaying}
        />,
      );
      expect(screen.getByTestId('sitout-btn-Alice')).toBeTruthy();
      expect(screen.getByTestId('sitout-btn-Dan')).toBeTruthy();
    });

    it('does not show sit-out button for non-playing-status players', () => {
      const onMarkNotPlaying = vi.fn();
      render(
        <PlayerGrid
          {...defaultProps}
          players={participationPlayers}
          onMarkNotPlaying={onMarkNotPlaying}
        />,
      );
      expect(screen.queryByTestId('sitout-btn-Bob')).toBeNull();
      expect(screen.queryByTestId('sitout-btn-Carol')).toBeNull();
    });

    it('calls onMarkNotPlaying with player name when sit-out button clicked', () => {
      const onMarkNotPlaying = vi.fn();
      render(
        <PlayerGrid
          {...defaultProps}
          players={participationPlayers}
          onMarkNotPlaying={onMarkNotPlaying}
        />,
      );
      screen.getByTestId('sitout-btn-Alice').click();
      expect(onMarkNotPlaying).toHaveBeenCalledWith('Alice');
    });

    it('does not show sit-out button when onMarkNotPlaying is not provided', () => {
      render(
        <PlayerGrid
          {...defaultProps}
          players={participationPlayers}
        />,
      );
      expect(screen.queryByTestId('sitout-btn-Alice')).toBeNull();
    });
  });
});
