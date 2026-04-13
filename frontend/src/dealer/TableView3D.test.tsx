/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock poker scene — no WebGL in happy-dom
const mockSceneUpdate = vi.fn();
const mockSceneDispose = vi.fn();
vi.mock('../scenes/pokerScene.ts', () => ({
  createPokerScene: vi.fn(() => ({
    scene: {},
    camera: {
      position: { set: vi.fn(), x: 0, y: 18, z: 6 },
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    renderer: {
      domElement: document.createElement('canvas'),
      setSize: vi.fn(),
    },
    seatPositions: [],
    chipStacks: { updateChipStacks: vi.fn(), dispose: vi.fn() },
    holeCards: { initHand: vi.fn(), goToShowdown: vi.fn(), dispose: vi.fn() },
    communityCards: null,
    controls: {
      target: { set: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      saveState: vi.fn(),
      update: vi.fn(),
      dispose: vi.fn(),
    },
    dispose: mockSceneDispose,
    update: mockSceneUpdate,
  })),
}));

import { createPokerScene } from '../scenes/pokerScene.ts';
import { TableView3D } from './TableView3D.tsx';
import type { TableView3DProps } from './TableView3D.tsx';

const BASE_PROPS: TableView3DProps = {
  hands: [
    {
      hand_id: 1,
      game_id: 42,
      hand_number: 1,
      flop_1: 'Ah',
      flop_2: 'Kd',
      flop_3: '5h',
      turn: 'Js',
      river: null,
      source_upload_id: null,
      sb_player_name: null,
      bb_player_name: null,
      created_at: '2026-04-08T10:00:00Z',
      player_hands: [
        { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'Ah', card_2: 'Kd', result: 'won', profit_loss: 50, outcome_street: 'river' },
        { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: 'Jc', card_2: 'Ts', result: 'lost', profit_loss: -25, outcome_street: 'turn' },
      ],
    },
  ],
};

describe('TableView3D', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders a canvas element on mount', () => {
    render(<TableView3D {...BASE_PROPS} />);
    const container = screen.getByTestId('table-view-3d');
    expect(container).toBeTruthy();
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('calls createPokerScene on mount', () => {
    render(<TableView3D {...BASE_PROPS} />);
    expect(createPokerScene).toHaveBeenCalledTimes(1);
  });

  it('calls dispose on unmount', () => {
    const { unmount } = render(<TableView3D {...BASE_PROPS} />);
    unmount();
    expect(mockSceneDispose).toHaveBeenCalledTimes(1);
  });

  it('calls scene.update with mapped hand state when hands prop is provided', () => {
    render(<TableView3D {...BASE_PROPS} />);
    expect(mockSceneUpdate).toHaveBeenCalled();
    const call = mockSceneUpdate.mock.calls[0][0];
    // Should have cardData with parsed cards
    expect(call.cardData).toBeDefined();
    expect(call.cardData.flop).toHaveLength(3);
    expect(call.cardData.player_hands).toHaveLength(2);
    expect(call.cardData.player_hands[0].player_name).toBe('Alice');
  });

  it('does not call scene.update when hands is empty', () => {
    render(<TableView3D hands={[]} />);
    // createPokerScene is called, but update should not be called with card data
    expect(mockSceneUpdate).not.toHaveBeenCalled();
  });

  it('does not leak WebGL contexts on multiple mount/unmount cycles', () => {
    const { unmount: u1 } = render(<TableView3D {...BASE_PROPS} />);
    u1();
    const { unmount: u2 } = render(<TableView3D {...BASE_PROPS} />);
    u2();
    const { unmount: u3 } = render(<TableView3D {...BASE_PROPS} />);
    u3();
    // Each mount creates one scene, each unmount disposes it
    expect(createPokerScene).toHaveBeenCalledTimes(3);
    expect(mockSceneDispose).toHaveBeenCalledTimes(3);
  });

  it('maps result values correctly from API format to scene format', () => {
    render(<TableView3D {...BASE_PROPS} />);
    const call = mockSceneUpdate.mock.calls[0][0];
    const playerHands = call.cardData.player_hands;
    expect(playerHands[0].result).toBe('win');   // 'won' -> 'win'
    expect(playerHands[1].result).toBe('loss');   // 'lost' -> 'loss'
  });

  it('uses the last hand in the array for the scene', () => {
    const twoHands = {
      hands: [
        { ...BASE_PROPS.hands[0], hand_number: 1, flop_1: '2h', flop_2: '3d', flop_3: '4c' },
        { ...BASE_PROPS.hands[0], hand_number: 2, flop_1: 'Qh', flop_2: 'Jd', flop_3: 'Tc' },
      ],
    };
    render(<TableView3D {...twoHands} />);
    const call = mockSceneUpdate.mock.calls[0][0];
    // Should use the last hand (hand_number: 2)
    expect(call.cardData.flop[0].rank).toBe('Q');
  });

  it('passes externalResize: true to createPokerScene', () => {
    render(<TableView3D {...BASE_PROPS} />);
    const opts = (createPokerScene as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(opts.externalResize).toBe(true);
  });
});
