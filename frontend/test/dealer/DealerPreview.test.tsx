import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { Mock } from 'vitest';

// Track createPokerScene calls
const mockUpdate = vi.fn();
const mockDispose = vi.fn();
const mockSetSize = vi.fn();
const mockUpdateProjectionMatrix = vi.fn();

vi.mock('../../src/scenes/pokerScene.ts', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: { aspect: 1, updateProjectionMatrix: mockUpdateProjectionMatrix },
    renderer: { setSize: mockSetSize },
    seatPositions: [],
    dispose: mockDispose,
    update: mockUpdate,
  })),
}));

vi.mock('../../src/poker/evaluator', () => ({
  calculateEquity: vi.fn(() => []),
}));

import { createPokerScene } from '../../src/scenes/pokerScene.ts';
import { calculateEquity } from '../../src/poker/evaluator';
import { DealerPreview } from '../../src/../src/dealer/DealerPreview.tsx';
import type { DealerPreviewProps } from '../../src/../src/dealer/DealerPreview.tsx';

afterEach(cleanup);

// Flush microtasks and re-render cycles
async function flush(n = 3) {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

describe('DealerPreview', () => {
  const defaultProps: DealerPreviewProps = {
    community: { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false },
    players: [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (calculateEquity as Mock).mockReturnValue([]);
  });

  it('renders collapsed by default with Show Table button', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    expect(toggle).toBeDefined();
    expect(toggle.textContent).toContain('Show Table');
    expect(screen.queryByRole('canvas')).toBeNull();
  });

  it('expands to show Hide Table when toggle is clicked', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    expect(toggle.textContent).toContain('Hide Table');
    expect(document.querySelector('canvas')).toBeTruthy();
  });

  it('creates poker scene after expanding', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    expect(createPokerScene).not.toHaveBeenCalled();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    const [canvas, options] = (createPokerScene as Mock).mock.calls[0];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(options.seatCount).toBe(2);
  });

  it('calls update when community cards change after expanding', async () => {
    const { rerender } = render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    mockUpdate.mockClear();

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    rerender(<DealerPreview {...defaultProps} community={updatedCommunity} />);

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('calls update when player hole cards change after expanding', async () => {
    const { rerender } = render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    mockUpdate.mockClear();

    const updatedPlayers = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    rerender(<DealerPreview {...defaultProps} players={updatedPlayers} />);

    expect(mockUpdate).toHaveBeenCalled();
  });

  it('calls dispose when unmounted after expanding', async () => {
    const { unmount } = render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('expands, collapses, and re-expands with correct dispose/create', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    // Expand
    fireEvent.click(toggle);
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toContain('Hide Table');
    // Collapse
    fireEvent.click(toggle);
    await flush();
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(toggle.textContent).toContain('Show Table');
    expect(document.querySelector('canvas')).toBeNull();
    // Re-expand
    fireEvent.click(toggle);
    await flush();
    expect(createPokerScene).toHaveBeenCalledTimes(2);
    expect(toggle.textContent).toContain('Hide Table');
  });

  it('canvas container has responsive width style after expanding', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    const wrapper = screen.getByTestId('preview-canvas-wrapper');
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe('100%');
  });

  it('passes correct seatCount based on players length after expanding', async () => {
    const threePlayers = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
      { name: 'Carol', card1: null, card2: null, recorded: false, status: 'playing' },
    ];
    render(<DealerPreview {...defaultProps} players={threePlayers} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    const [, options] = (createPokerScene as Mock).mock.calls[0];
    expect(options.seatCount).toBe(3);
  });

  it('creates seat labels for each player after expanding', async () => {
    render(<DealerPreview {...defaultProps} />);
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    const label0 = document.querySelector('[data-testid="seat-label-0"]');
    const label1 = document.querySelector('[data-testid="seat-label-1"]');
    expect(label0).toBeTruthy();
    expect(label0!.textContent).toBe('Alice');
    expect(label1).toBeTruthy();
    expect(label1!.textContent).toBe('Bob');
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
    (calculateEquity as Mock).mockReturnValue([]);
  });

  it('calculates equity when >=2 players have hole cards after expanding', async () => {
    (calculateEquity as Mock).mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    render(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();

    expect(calculateEquity).toHaveBeenCalled();
    const badges = screen.getByTestId('equity-badges');
    expect(badges).toBeTruthy();
    expect(screen.getByTestId('equity-badge-Alice').textContent).toBe('Alice: 65%');
    expect(screen.getByTestId('equity-badge-Bob').textContent).toBe('Bob: 35%');
  });

  it('does not calculate equity when <2 players have cards', async () => {
    const oneCardPlayer = [
      { name: 'Alice', card1: 'Ah', card2: 'Kd', recorded: true, status: 'playing' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing' },
    ];

    render(
      <DealerPreview community={community} players={oneCardPlayer} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();

    expect(calculateEquity).not.toHaveBeenCalled();
    expect(screen.queryByTestId('equity-badges')).toBeNull();
  });

  it('hides badges when calculateEquity throws', async () => {
    (calculateEquity as Mock).mockImplementation(() => { throw new Error('eval error'); });

    render(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();

    expect(screen.queryByTestId('equity-badges')).toBeNull();
  });

  it('recalculates equity when community cards change', async () => {
    (calculateEquity as Mock).mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    const { rerender } = render(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();
    const callsBefore = (calculateEquity as Mock).mock.calls.length;

    (calculateEquity as Mock).mockReturnValue([
      { equity: 0.72 },
      { equity: 0.28 },
    ]);

    const updatedCommunity = { flop1: 'Ah', flop2: 'Kd', flop3: '5c', turn: null, river: null, recorded: true };
    rerender(<DealerPreview community={updatedCommunity} players={twoCardPlayers} gameId={1} handNumber={1} />);
    await flush();

    expect((calculateEquity as Mock).mock.calls.length).toBeGreaterThan(callsBefore);
    expect(screen.getByTestId('equity-badge-Alice').textContent).toBe('Alice: 72%');
    expect(screen.getByTestId('equity-badge-Bob').textContent).toBe('Bob: 28%');
  });

  it('rounds equity percentages to nearest integer', async () => {
    (calculateEquity as Mock).mockReturnValue([
      { equity: 0.6549 },
      { equity: 0.3451 },
    ]);

    render(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();

    expect(screen.getByTestId('equity-badge-Alice').textContent).toBe('Alice: 65%');
    expect(screen.getByTestId('equity-badge-Bob').textContent).toBe('Bob: 35%');
  });

  it('equity badges only visible when table is expanded', async () => {
    (calculateEquity as Mock).mockReturnValue([
      { equity: 0.65 },
      { equity: 0.35 },
    ]);

    render(
      <DealerPreview community={community} players={twoCardPlayers} gameId={1} handNumber={1} />,
    );
    await flush();

    // Collapsed by default — badges should NOT be visible
    expect(screen.queryByTestId('equity-badges')).toBeNull();

    // Expand
    const toggle = screen.getByTestId('preview-toggle');
    fireEvent.click(toggle);
    await flush();

    // Expanded — badges should be visible
    expect(screen.queryByTestId('equity-badges')).not.toBeNull();
    expect(screen.getByTestId('equity-badge-Alice').textContent).toBe('Alice: 65%');

    // Collapse
    fireEvent.click(toggle);
    await flush();

    // Collapsed — badges should NOT be visible
    expect(screen.queryByTestId('equity-badges')).toBeNull();

    // Re-expand
    fireEvent.click(toggle);
    await flush();

    // Expanded again — badges should be visible
    expect(screen.queryByTestId('equity-badges')).not.toBeNull();
  });
});
