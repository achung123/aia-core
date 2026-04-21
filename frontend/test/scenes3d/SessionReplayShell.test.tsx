/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import {
  SessionReplayShell,
  useSessionReplayContext,
} from '../../src/scenes3d/SessionReplayShell';
import {
  useTableStore,
  DEFAULT_REPLAY,
  DEFAULT_THEME,
} from '../../src/scenes3d/state/tableStore';
import type {
  GameSessionResponse,
  HandResponse,
  PlayerInfo,
} from '../../src/api/types/game';

function makePlayer(name: string, seat: number): PlayerInfo {
  return {
    name,
    is_active: true,
    seat_number: seat,
    buy_in: 100,
    current_chips: 100,
    rebuy_count: 0,
    total_rebuys: 0,
  };
}

function makeGame(): GameSessionResponse {
  const players = [makePlayer('Alice', 1), makePlayer('Bob', 2)];
  return {
    game_id: 1,
    game_date: '2026-04-21',
    status: 'active',
    created_at: '2026-04-21T00:00:00Z',
    player_names: players.map((p) => p.name),
    players,
    hand_count: 3,
    winners: [],
    default_buy_in: 100,
  };
}

function makeHand(n: number): HandResponse {
  return {
    hand_id: n * 10,
    game_id: 1,
    hand_number: n,
    flop_1: null,
    flop_2: null,
    flop_3: null,
    turn: null,
    river: null,
    source_upload_id: null,
    sb_player_name: null,
    bb_player_name: null,
    pot: 0,
    side_pots: [],
    created_at: '2026-04-21T00:00:00Z',
    player_hands: [],
  };
}

const resetStore = () =>
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
  });

afterEach(() => {
  cleanup();
  resetStore();
  vi.useRealTimers();
});

describe('<SessionReplayShell> — structure', () => {
  beforeEach(() => resetStore());

  it('renders a SessionScrubber whose handCount matches hands.length (AC 1)', () => {
    const hands = [makeHand(1), makeHand(2), makeHand(3)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    expect(screen.getByTestId('session-scrubber')).toBeTruthy();
    expect(screen.getByTestId('session-label').textContent).toContain('1 / 3');
  });

  it('renders a play/pause toggle and four speed buttons (0.5x / 1x / 2x / 4x)', () => {
    const hands = [makeHand(1)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    expect(screen.getByTestId('session-replay-play')).toBeTruthy();
    for (const s of ['0.5x', '1x', '2x', '4x']) {
      expect(screen.getByTestId(`session-replay-speed-${s}`)).toBeTruthy();
    }
  });

  it('highlights the initial speed (initialSpeed=2 → 2x active)', () => {
    const hands = [makeHand(1)];
    render(
      <SessionReplayShell
        gameId={1}
        game={makeGame()}
        hands={hands}
        initialSpeed={2}
      />,
    );
    const b = screen.getByTestId('session-replay-speed-2x');
    expect(b.getAttribute('data-active')).toBe('true');
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(useTableStore.getState().replay.speed).toBe(2);
  });

  it('clicking a speed button writes replay.speed', () => {
    const hands = [makeHand(1)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    fireEvent.click(screen.getByTestId('session-replay-speed-4x'));
    expect(useTableStore.getState().replay.speed).toBe(4);
  });

  it('play button toggles replay.isPlaying (AC 3)', () => {
    const hands = [makeHand(1)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    const play = screen.getByTestId('session-replay-play');
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(play);
    expect(useTableStore.getState().replay.isPlaying).toBe(true);
    expect(play.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('<SessionReplayShell> — auto-advance state machine', () => {
  beforeEach(() => resetStore());

  it('auto-advances one street per 1500ms at speed=1 (AC 2)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1), makeHand(2)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    fireEvent.click(screen.getByTestId('session-replay-play'));
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(2);
  });

  it('speed=2 halves the per-street advance period (AC 7)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1)];
    render(
      <SessionReplayShell
        gameId={1}
        game={makeGame()}
        hands={hands}
        initialSpeed={2}
      />,
    );
    fireEvent.click(screen.getByTestId('session-replay-play'));
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
  });

  it('reaching showdown triggers a 1000ms inter-hand pause, then next hand (AC 2 + AC 7)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1), makeHand(2)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    act(() => {
      useTableStore.getState().setReplayStreetIndex(4);
    });
    fireEvent.click(screen.getByTestId('session-replay-play'));
    // Before 1000ms — still on hand 0, showdown
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(useTableStore.getState().replay.handIndex).toBe(0);
    // 1000ms inter-hand pause elapsed → advance to next hand, streetIndex reset
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useTableStore.getState().replay.handIndex).toBe(1);
    expect(useTableStore.getState().replay.streetIndex).toBe(0);
    expect(useTableStore.getState().replay.isPlaying).toBe(true);
  });

  it('inter-hand pause scales with speed (speed=2 → 500ms)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1), makeHand(2)];
    render(
      <SessionReplayShell
        gameId={1}
        game={makeGame()}
        hands={hands}
        initialSpeed={2}
      />,
    );
    act(() => {
      useTableStore.getState().setReplayStreetIndex(4);
    });
    fireEvent.click(screen.getByTestId('session-replay-play'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(useTableStore.getState().replay.handIndex).toBe(1);
  });

  it('at last hand showdown, inter-hand timeout stops playback (AC 2)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    act(() => {
      useTableStore.getState().setReplayStreetIndex(4);
    });
    fireEvent.click(screen.getByTestId('session-replay-play'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(useTableStore.getState().replay.isPlaying).toBe(false);
    expect(useTableStore.getState().replay.handIndex).toBe(0);
    expect(useTableStore.getState().replay.streetIndex).toBe(4);
  });

  it('pausing freezes the state; resuming continues from the same indices (AC 3)', () => {
    vi.useFakeTimers();
    const hands = [makeHand(1)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    const play = screen.getByTestId('session-replay-play');
    fireEvent.click(play);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
    fireEvent.click(play); // pause
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
    fireEvent.click(play); // resume
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(2);
  });
});

describe('<SessionReplayShell> — scrubbing (AC 4)', () => {
  beforeEach(() => resetStore());

  it('scrubbing the SessionScrubber seeks to that hand and resets streetIndex=0', () => {
    const hands = [makeHand(1), makeHand(2), makeHand(3)];
    render(<SessionReplayShell gameId={1} game={makeGame()} hands={hands} />);
    act(() => {
      useTableStore.getState().setReplayStreetIndex(3);
    });
    const slider = screen.getByTestId('session-slider') as HTMLInputElement;
    fireEvent.input(slider, { target: { value: '3' } });
    const r = useTableStore.getState().replay;
    expect(r.handIndex).toBe(2);
    expect(r.streetIndex).toBe(0);
  });
});

describe('<SessionReplayShell> — derived TableState context (AC 5 / AC 7)', () => {
  beforeEach(() => resetStore());

  it('exposes a TableState whose handId/streetIndex track the replay slice', () => {
    const hands = [makeHand(1), makeHand(2)];
    // Probe renders the context into the DOM; the test reads it back via
    // data attributes so we don't mutate test-scoped variables during render.
    function Probe() {
      const ctx = useSessionReplayContext();
      return (
        <div
          data-testid="ctx-probe"
          data-hand-id={String(ctx.tableState?.handId ?? '')}
          data-street-index={String(ctx.tableState?.streetIndex ?? '')}
          data-phase={String(ctx.tableState?.phase ?? '')}
        />
      );
    }
    render(
      <SessionReplayShell gameId={1} game={makeGame()} hands={hands}>
        <Probe />
      </SessionReplayShell>,
    );
    const probe = () => screen.getByTestId('ctx-probe');
    expect(probe().getAttribute('data-hand-id')).toBe('10');
    expect(probe().getAttribute('data-street-index')).toBe('0');
    expect(probe().getAttribute('data-phase')).toBe('preflop');

    act(() => {
      useTableStore.getState().setReplayStreetIndex(2);
    });
    expect(probe().getAttribute('data-street-index')).toBe('2');
    expect(probe().getAttribute('data-phase')).toBe('turn');

    act(() => {
      useTableStore.getState().setReplayHandIndex(1);
    });
    expect(probe().getAttribute('data-hand-id')).toBe('20');
  });

  it('useSessionReplayContext throws when used outside the shell', () => {
    function Probe() {
      useSessionReplayContext();
      return null;
    }
    // Suppress the expected error boundary noise.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow();
    err.mockRestore();
  });
});


describe('<SessionReplayShell> — per-street tick floor (Cycle 44 M-1)', () => {
  beforeEach(() => resetStore());

  it('at speed=4, 1500/4=375ms is FLOORED to CHIP_SLIDE_DURATION_MS=400ms', async () => {
    const { CHIP_SLIDE_DURATION_MS } = await import(
      '../../src/scenes3d/animations/chipSlides'
    );
    expect(CHIP_SLIDE_DURATION_MS).toBe(400);
    vi.useFakeTimers();
    const hands = [makeHand(1)];
    render(
      <SessionReplayShell
        gameId={1}
        game={makeGame()}
        hands={hands}
        initialSpeed={4}
      />,
    );
    fireEvent.click(screen.getByTestId('session-replay-play'));
    // Just before the floor: 399ms — streetIndex must NOT advance.
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(0);
    // At the floor: one more ms crosses the 400ms boundary.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
  });

  it('the max speed cannot produce a per-street tick below CHIP_SLIDE_DURATION_MS', async () => {
    const { CHIP_SLIDE_DURATION_MS } = await import(
      '../../src/scenes3d/animations/chipSlides'
    );
    const { MS_PER_STREET } = await import(
      '../../src/scenes3d/SessionReplayShell'
    );
    const { REPLAY_SPEEDS } = await import(
      '../../src/scenes3d/state/tableStore'
    );
    const maxSpeed = Math.max(...REPLAY_SPEEDS);
    const floored = Math.max(CHIP_SLIDE_DURATION_MS, MS_PER_STREET / maxSpeed);
    expect(floored).toBeGreaterThanOrEqual(CHIP_SLIDE_DURATION_MS);
  });
});
