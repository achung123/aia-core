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
    { name: 'Alice', recorded: false, status: 'playing' },
    { name: 'Bob', recorded: true, status: 'won' },
    { name: 'Carol', recorded: false, status: 'folded' },
    { name: 'Dave', recorded: false, status: 'lost' },
  ],
  communityRecorded: false,
  onTileSelect: vi.fn(),
  canFinish: false,
  onFinishHand: vi.fn(),
};

describe('PlayerGrid', () => {
  it('renders player name and status text on each tile', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const buttons = container.querySelectorAll('button[data-testid^="player-tile-"]');
    expect(buttons.length).toBe(4);

    expect(buttons[0].textContent).toContain('Alice');
    expect(buttons[0].textContent).toContain('playing');

    expect(buttons[1].textContent).toContain('Bob');
    expect(buttons[1].textContent).toContain('won');

    expect(buttons[2].textContent).toContain('Carol');
    expect(buttons[2].textContent).toContain('folded');

    expect(buttons[3].textContent).toContain('Dave');
    expect(buttons[3].textContent).toContain('lost');
  });

  it('sets background color based on player status', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const buttons = container.querySelectorAll('button[data-testid^="player-tile-"]');

    expect(buttons[0].style.backgroundColor).toBe('#ffffff'); // playing = white
    expect(buttons[1].style.backgroundColor).toBe('#bbf7d0'); // won = green
    expect(buttons[2].style.backgroundColor).toBe('#fecaca'); // folded = red
    expect(buttons[3].style.backgroundColor).toBe('#fed7aa'); // lost = orange
  });

  it('renders tiles with at least 80px min-height', () => {
    const container = renderToContainer(<PlayerGrid {...defaultProps} />);
    const buttons = container.querySelectorAll('button[data-testid^="player-tile-"]');
    for (const btn of buttons) {
      expect(btn.style.minHeight).toBe('80px');
    }
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
    const bobTile = container.querySelector('button[data-testid="player-tile-Bob"]');
    expect(bobTile.textContent).toContain('✅');
  });
});
