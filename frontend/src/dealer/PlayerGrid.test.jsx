/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { PlayerGrid } from './PlayerGrid.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

const defaultProps = {
  players: [
    { name: 'Alice', recorded: false, status: 'playing', outcomeStreet: null },
    { name: 'Bob', recorded: true, status: 'won', outcomeStreet: 'river' },
    { name: 'Carol', recorded: false, status: 'folded', outcomeStreet: 'flop' },
    { name: 'Dave', recorded: false, status: 'lost', outcomeStreet: 'turn' },
    { name: 'Eve', recorded: false, status: 'not_playing', outcomeStreet: null },
  ],
  communityRecorded: false,
  onTileSelect: vi.fn(),
  onBack: vi.fn(),
  canFinish: false,
  onFinishHand: vi.fn(),
};

describe('PlayerGrid', () => {
  it('renders player name and status text on each tile', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const rows = container.querySelectorAll('[data-testid^="player-row-"]');
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
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const rows = container.querySelectorAll('[data-testid^="player-row-"]');

    expect(rows[0].style.backgroundColor).toBe('#ffffff'); // playing = white
    expect(rows[1].style.backgroundColor).toBe('#bbf7d0'); // won = green
    expect(rows[2].style.backgroundColor).toBe('#fecaca'); // folded = red
    expect(rows[3].style.backgroundColor).toBe('#fed7aa'); // lost = orange
    expect(rows[4].style.backgroundColor).toBe('#e5e7eb'); // not_playing = gray
  });

  it('renders player rows with adequate min-height', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const rows = container.querySelectorAll('[data-testid^="player-row-"]');
    for (const row of rows) {
      expect(parseInt(row.style.minHeight)).toBeGreaterThanOrEqual(48);
    }
  });

  it('shows not_playing status without outcome button allowing change', () => {
    const onDirectOutcome = vi.fn();
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} onDirectOutcome={onDirectOutcome} />
    );
    expect(container.querySelector('[data-testid="outcome-btn-Eve"]')).not.toBeNull();
  });

  it('shows ✅ on Table tile when community is recorded', () => {
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} communityRecorded={true} />,
    );
    const tableTile = container.querySelector('button[data-testid="table-tile"]');
    expect(tableTile).not.toBeNull();
    expect(tableTile.textContent).toContain('Table');
    expect(tableTile.textContent).toContain('✅');
  });

  it('does not show ✅ on Table tile when community is not recorded', () => {
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} communityRecorded={false} />,
    );
    const tableTile = container.querySelector('button[data-testid="table-tile"]');
    expect(tableTile.textContent).toContain('Table');
    expect(tableTile.textContent).not.toContain('✅');
  });

  it('shows ✅ on player tile when recorded', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const bobRow = container.querySelector('[data-testid="player-row-Bob"]');
    expect(bobRow.textContent).toContain('✅');
  });

  it('renders a back button that calls onBack', () => {
    const onBack = vi.fn();
    const container = renderToContainer(<PlayerGrid {...defaultProps} onBack={onBack} />);
    const backBtn = container.querySelector('[data-testid="back-btn"]');
    expect(backBtn).not.toBeNull();
    backBtn.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders Table tile full-width above the player rows', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const tableTile = container.querySelector('[data-testid="table-tile"]');
    // Table tile should NOT be inside the player list
    const playerList = container.querySelector('[data-testid="player-list"]');
    expect(tableTile).not.toBeNull();
    expect(playerList).not.toBeNull();
    expect(playerList.contains(tableTile)).toBe(false);
  });

  it('renders each player as a row with name column and status column', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const rows = container.querySelectorAll('[data-testid^="player-row-"]');
    expect(rows.length).toBe(5);

    // Each row should have the player name and status in separate sections
    const aliceRow = container.querySelector('[data-testid="player-row-Alice"]');
    expect(aliceRow).not.toBeNull();
    expect(aliceRow.textContent).toContain('Alice');
    expect(aliceRow.textContent).toContain('playing');
  });

  it('shows outcome button for players with non-playing status', () => {
    const onDirectOutcome = vi.fn();
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} onDirectOutcome={onDirectOutcome} />
    );
    // Bob has status=won, Carol=folded, Dave=lost — all should show outcome button
    expect(container.querySelector('[data-testid="outcome-btn-Bob"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="outcome-btn-Carol"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="outcome-btn-Dave"]')).not.toBeNull();
  });

  it('clicking outcome button on non-playing player calls onDirectOutcome', () => {
    const onDirectOutcome = vi.fn();
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} onDirectOutcome={onDirectOutcome} />
    );
    container.querySelector('[data-testid="outcome-btn-Bob"]').click();
    expect(onDirectOutcome).toHaveBeenCalledWith('Bob');
  });

  it('sets background color for pending participation status', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'pending', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.style.backgroundColor).toBe('#fef08a');
  });

  it('sets background color for joined participation status', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'joined', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.style.backgroundColor).toBe('#bbf7d0');
  });

  it('sets background color for handed_back participation status', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.style.backgroundColor).toBe('#fef08a');
  });

  it('formats pending status text as "pending"', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'pending', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.textContent).toContain('pending');
  });

  it('formats joined status text as "joined"', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'joined', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.textContent).toContain('joined');
  });

  it('formats handed_back status text as "handed back"', () => {
    const players = [
      { name: 'Zara', recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    const container = renderToContainer(
      <PlayerGrid {...defaultProps} players={players} />
    );
    const row = container.querySelector('[data-testid="player-row-Zara"]');
    expect(row.textContent).toContain('handed back');
  });

  it('preserves existing status colors when new statuses are added', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const rows = container.querySelectorAll('[data-testid^="player-row-"]');
    expect(rows[0].style.backgroundColor).toBe('#ffffff'); // playing
    expect(rows[1].style.backgroundColor).toBe('#bbf7d0'); // won
    expect(rows[2].style.backgroundColor).toBe('#fecaca'); // folded
    expect(rows[3].style.backgroundColor).toBe('#fed7aa'); // lost
    expect(rows[4].style.backgroundColor).toBe('#e5e7eb'); // not_playing
  });
});
