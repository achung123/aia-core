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

vi.mock('../api/client.js', () => ({
  fetchEquity: vi.fn(() => Promise.resolve({ equities: [] })),
}));

import { createPokerScene } from '../scenes/pokerScene.js';
import { fetchEquity } from '../api/client.js';
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
    fetchEquity.mockResolvedValue({ equities: [] });
  });

  it('renders a toggle button that defaults to collapsed', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle.textContent).toContain('Show Table');
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeNull();
    cleanup(container);
  });

  it('expands to show canvas when toggle is clicked', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    expect(toggle.textContent).toContain('Hide Table');
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    cleanup(container);
  });

  it('creates poker scene when expanded', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    const [canvas, options] = createPokerScene.mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(options.seatCount).toBe(2);
    cleanup(container);
  });

  it('calls update when community cards change', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    mockUpdate.mockClear();

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    act(() => { render(<DealerPreview {...defaultProps} community={updatedCommunity} />, container); });

    expect(mockUpdate).toHaveBeenCalled();
    cleanup(container);
  });

  it('calls update when player hole cards change', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    mockUpdate.mockClear();

    const updatedPlayers = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    act(() => { render(<DealerPreview {...defaultProps} players={updatedPlayers} />, container); });

    expect(mockUpdate).toHaveBeenCalled();
    cleanup(container);
  });

  it('calls dispose when unmounted', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    cleanup(container);
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('collapses back and disposes on second toggle click', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    act(() => { toggle.click(); });
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toContain('Show Table');
    expect(container.querySelector('canvas')).toBeNull();
    cleanup(container);
  });

  it('canvas container has responsive width style', () => {
    const container = renderToContainer(<DealerPreview {...defaultProps} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    const wrapper = container.querySelector('[data-testid="preview-canvas-wrapper"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe('100%');
    cleanup(container);
  });

  it('passes correct seatCount based on players length', () => {
    const threePlayers = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Carol', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    const container = renderToContainer(<DealerPreview {...defaultProps} players={threePlayers} />);
    const toggle = container.querySelector('[data-testid="preview-toggle"]');
    act(() => { toggle.click(); });
    const [, options] = createPokerScene.mock.calls[0];
    expect(options.seatCount).toBe(3);
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
    fetchEquity.mockResolvedValue({ equities: [] });
  });

  it('fetches equity when >=2 players have hole cards', async () => {
    fetchEquity.mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.65 },
        { player_name: 'Bob', equity: 0.35 },
      ],
    });

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();

    expect(fetchEquity).toHaveBeenCalledWith(1, 1);
    const badges = container.querySelector('[data-testid="equity-badges"]');
    expect(badges).toBeTruthy();
    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 65%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 35%');
    cleanup(container);
  });

  it('does not fetch equity when <2 players have cards', async () => {
    const oneCardPlayer = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];

    const container = renderToContainer(
      <DealerPreview community={community} players={oneCardPlayer} gameId={1} handNumber={1} />,
    );
    await flush();

    expect(fetchEquity).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();
    cleanup(container);
  });

  it('hides badges when fetchEquity fails', async () => {
    fetchEquity.mockRejectedValue(new Error('Server error'));

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();

    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();
    cleanup(container);
  });

  it('re-fetches equity when community cards change', async () => {
    fetchEquity.mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.65 },
        { player_name: 'Bob', equity: 0.35 },
      ],
    });

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    expect(fetchEquity).toHaveBeenCalledTimes(1);

    fetchEquity.mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.72 },
        { player_name: 'Bob', equity: 0.28 },
      ],
    });

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    act(() => { render(<DealerPreview community={updatedCommunity} players={twoCardPlayers} gameId={1} handNumber={1} />, container); });
    await flush();

    expect(fetchEquity).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 72%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 28%');
    cleanup(container);
  });

  it('rounds equity percentages to nearest integer', async () => {
    fetchEquity.mockResolvedValue({
      equities: [
        { player_name: 'Alice', equity: 0.6549 },
        { player_name: 'Bob', equity: 0.3451 },
      ],
    });

    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();

    expect(container.querySelector('[data-testid="equity-badge-Alice"]').textContent).toBe('Alice: 65%');
    expect(container.querySelector('[data-testid="equity-badge-Bob"]').textContent).toBe('Bob: 35%');
    cleanup(container);
  });

  it('does not fetch equity when gameId or handNumber is missing', async () => {
    const container = renderToContainer(
      <DealerPreview community={community} players={twoCardPlayers} />,
    );
    await flush();

    expect(fetchEquity).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="equity-badges"]')).toBeNull();
    cleanup(container);
  });
});
