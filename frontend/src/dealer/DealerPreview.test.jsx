/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'preact';
import { act } from 'preact/test-utils';

// Track createPokerScene calls
const mockUpdate = vi.fn();
const mockDispose = vi.fn();
const mockSetSize = vi.fn();
const mockUpdateProjectionMatrix = vi.fn();

vi.mock('../scenes/pokerScene.js', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: { aspect: 1, updateProjectionMatrix: mockUpdateProjectionMatrix },
    renderer: { setSize: mockSetSize },
    seatPositions: [],
    dispose: mockDispose,
    update: mockUpdate,
  })),
}));

vi.mock('../poker/evaluator.js', () => ({
  calculateEquity: vi.fn(() => []),
}));

import { createPokerScene } from '../scenes/pokerScene.js';
import { calculateEquity } from '../poker/evaluator';
import { DealerPreview } from './DealerPreview.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(vnode, container);
  return container;
}

function cleanup(container) {
  render(null, container);
  container.remove();
}

// Flush microtasks and re-render cycles
async function flush(n = 3) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe('DealerPreview', () => {
  const defaultProps = {
    community: { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false },
    players: [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    calculateEquity.mockReturnValue([]);
  });

  it('renders collapsed by default with Show Table button', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toContain('Show Table');
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeNull();
    cleanup(container);
  });

  it('expands to show Hide Table when toggle is clicked', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    expect(toggle.textContent).toContain('Hide Table');
    expect(container.querySelector('canvas')).toBeTruthy();
    cleanup(container);
  });

  it('creates poker scene after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    expect(createPokerScene).not.toHaveBeenCalled();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    const [canvas, options] = createPokerScene.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(options.seatCount).toBe(2);
    cleanup(container);
  });

  it('calls update when community cards change after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    mockUpdate.mockClear();

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    act(() => { render(<DealerPreview {...defaultProps} community={updatedCommunity} />, container); });

    expect(mockUpdate).toHaveBeenCalled();
    cleanup(container);
  });

  it('calls update when player hole cards change after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    mockUpdate.mockClear();

    const updatedPlayers = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    act(() => { render(<DealerPreview {...defaultProps} players={updatedPlayers} />, container); });

    expect(mockUpdate).toHaveBeenCalled();
    cleanup(container);
  });

  it('calls dispose when unmounted after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    cleanup(container);
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('expands, collapses, and re-expands with correct dispose/create', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    // Expand
    act(() => { toggle.click(); });
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toContain('Hide Table');
    // Collapse
    act(() => { toggle.click(); });
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toContain('Show Table');
    expect(container.querySelector('canvas')).toBeNull();
    // Re-expand
    act(() => { toggle.click(); });
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(2);
    expect(toggle.textContent).toContain('Hide Table');
    cleanup(container);
  });

  it('canvas container has responsive width style after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    const wrapper = container.querySelector('[data-testid="preview-canvas-wrapper"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe('100%');
    cleanup(container);
  });

  it('passes correct seatCount based on players length after expanding', async () => {
    const threePlayers = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Carol', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    const container = renderToContainer(<DealerPreview {...defaultProps} players={threePlayers} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    const [, options] = createPokerScene.mock.calls[0];
    expect(options.seatCount).toBe(3);
    cleanup(container);
  });

  it('creates seat labels for each player after expanding', async () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    const label0 = container.querySelector('[data-testid="seat-label-0"]');
    const label1 = container.querySelector('[data-testid="seat-label-1"]');
    expect(label0).toBeTruthy();
    expect(label0.textContent).toBe('Alice');
    expect(label1).toBeTruthy();
    expect(label1.textContent).toBe('Bob');
    cleanup(container);
  });
});

describe('DealerPreview equity overlay', () => {
  const twoCardPlayers = [
    { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
    { name: 'Bob', card1: '2c', card2: '7s', recorded: true, status: 'playing' },
  ];
  const community = { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false };

  beforeEach(() => {
    vi.clearAllMocks();
    calculateEquity.mockReturnValue([]);
  });

  it('calculates equity when >=2 players have hole cards after expanding', async () => {
    calculateEquity.mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();

    expect(calculateEquity).toHaveBeenCalled();
    const badges = container.querySelector('[data-testid="equity-badges"]');
    expect(badges).toBeTruthy();
    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 65%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 35%');
    cleanup(container);
  });

  it('does not calculate equity when <2 players have cards', async () => {
    const oneCardPlayer = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];

    const container = renderToContainer(
      <DealerPreview community={community} players={oneCardPlayer} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();

    expect(calculateEquity).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();
    cleanup(container);
  });

  it('hides badges when calculateEquity throws', async () => {
    calculateEquity.mockImplementation(() => { throw new Error('eval error'); });

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();

    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();
    cleanup(container);
  });

  it('recalculates equity when community cards change', async () => {
    calculateEquity.mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();
    const callsBefore = calculateEquity.mock.calls.length;

    calculateEquity.mockReturnValue([
      { equity: 0.72 },
      { equity: 0.28 },
    ]);

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    act(() => { render(<DealerPreview community={updatedCommunity} players={twoCardPlayers} gameId={1} handNumber={1} />, container); });
    await flush();

    expect(calculateEquity.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 72%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 28%');
    cleanup(container);
  });

  it('rounds equity percentages to nearest integer', async () => {
    calculateEquity.mockReturnValue([
      { equity: 0.6549 },
      { equity: 0.3451 },
    ]);

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();

    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 65%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 35%');
    cleanup(container);
  });

  it('equity badges only visible when table is expanded', async () => {
    calculateEquity.mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();

    // Collapsed by default — badges should NOT be visible
    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();

    // Expand
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    await flush();

    // Expanded — badges should be visible
    expect(container.querySelector('[data-testid="equity-badges"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 65%');

    // Collapse
    act(() => { toggle.click(); });
    await flush();

    // Collapsed — badges should NOT be visible
    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();

    // Re-expand
    act(() => { toggle.click(); });
    await flush();

    // Expanded again — badges should be visible
    expect(container.querySelector('[data-testid="equity-badges"]')).not.toBeNull();

    cleanup(container);
  });
});
