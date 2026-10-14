/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import {
  HandScrubberPanel,
  streetIndexFromOutcomePhase,
} from '../../src/scenes3d/components/HandScrubberPanel';
import {
  useTableStore,
  DEFAULT_REPLAY,
  DEFAULT_THEME,
} from '../../src/scenes3d/state/tableStore';

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

describe('streetIndexFromOutcomePhase (T-023 AC 3 helper)', () => {
  it.each([
    ['preflop', 0],
    ['flop', 1],
    ['turn', 2],
    ['river', 3],
    ['showdown', 4],
    ['awaiting_cards', 0],
  ] as const)('%s → %i', (phase, idx) => {
    expect(streetIndexFromOutcomePhase(phase)).toBe(idx);
  });

  it('undefined outcome → 4 (all streets reachable)', () => {
    expect(streetIndexFromOutcomePhase(undefined)).toBe(4);
  });
});

describe('<HandScrubberPanel> — uncontrolled / live mode', () => {
  beforeEach(() => resetStore());

  it('renders a play button and 5 street buttons (AC 4 shape)', () => {
    render(<HandScrubberPanel />);
    expect(screen.getByTestId('hand-scrubber-panel')).toBeTruthy();
    expect(screen.getByTestId('scrubber-play-toggle')).toBeTruthy();
    for (const slug of ['preflop', 'flop', 'turn', 'river', 'showdown']) {
      expect(screen.getByTestId(`scrubber-street-${slug}`)).toBeTruthy();
    }
  });

  it('all interactive buttons meet the 44×44 tap target (AC 4)', () => {
    render(<HandScrubberPanel />);
    const play = screen.getByTestId('scrubber-play-toggle');
    expect(play.style.minWidth).toBe('44px');
    expect(play.style.minHeight).toBe('44px');
    for (const slug of ['preflop', 'flop', 'turn', 'river', 'showdown']) {
      const btn = screen.getByTestId(`scrubber-street-${slug}`);
      expect(btn.style.minWidth).toBe('44px');
      expect(btn.style.minHeight).toBe('44px');
    }
  });

  it('defaults to streetIndex=0 and fires onStreetIndexChange on click (AC 1)', () => {
    const spy = vi.fn();
    render(<HandScrubberPanel onStreetIndexChange={spy} />);
    const preflopBtn = screen.getByTestId('scrubber-street-preflop');
    expect(preflopBtn.getAttribute('data-active')).toBe('true');

    fireEvent.click(screen.getByTestId('scrubber-street-flop'));
    expect(spy).toHaveBeenCalledWith(1);
    expect(
      screen.getByTestId('scrubber-street-flop').getAttribute('data-active'),
    ).toBe('true');
  });

  it('disables streets past outcomeStreet and clamps clicks (AC 3)', () => {
    const spy = vi.fn();
    render(
      <HandScrubberPanel outcomeStreet="flop" onStreetIndexChange={spy} />,
    );
    // Flop reachable
    expect(
      screen
        .getByTestId('scrubber-street-flop')
        .getAttribute('data-disabled'),
    ).toBe('false');
    // Turn / River / Showdown disabled
    for (const slug of ['turn', 'river', 'showdown']) {
      const btn = screen.getByTestId(`scrubber-street-${slug}`);
      expect(btn.getAttribute('data-disabled')).toBe('true');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    }
    // Disabled button does not fire
    fireEvent.click(screen.getByTestId('scrubber-street-river'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('clamps current street down when outcomeStreet shrinks (AC 3)', () => {
    const spy = vi.fn();
    const { rerender } = render(
      <HandScrubberPanel initialStreetIndex={3} onStreetIndexChange={spy} />,
    );
    expect(
      screen.getByTestId('scrubber-street-river').getAttribute('data-active'),
    ).toBe('true');

    rerender(
      <HandScrubberPanel
        initialStreetIndex={3}
        outcomeStreet="flop"
        onStreetIndexChange={spy}
      />,
    );
    expect(spy).toHaveBeenLastCalledWith(1);
    expect(
      screen.getByTestId('scrubber-street-flop').getAttribute('data-active'),
    ).toBe('true');
  });

  it('play button toggles aria-pressed and fires onPlayingChange (AC 2)', () => {
    const spy = vi.fn();
    render(<HandScrubberPanel onPlayingChange={spy} />);
    const play = screen.getByTestId('scrubber-play-toggle');
    expect(play.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(play);
    expect(spy).toHaveBeenCalledWith(true);
    expect(play.getAttribute('aria-pressed')).toBe('true');
  });

  it('auto-advances one street per 1.5s at speed=1 (AC 2)', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    render(<HandScrubberPanel onStreetIndexChange={spy} />);
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(spy).toHaveBeenLastCalledWith(1);

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('scales auto-advance period by `speed` prop (AC 2)', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    render(<HandScrubberPanel speed={2} onStreetIndexChange={spy} />);
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));

    // At 2x, one street lands every 750ms
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(spy).toHaveBeenLastCalledWith(1);
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('auto-advance stops at maxStreet and flips isPlaying off (AC 2 + AC 3)', () => {
    vi.useFakeTimers();
    const playSpy = vi.fn();
    render(
      <HandScrubberPanel
        outcomeStreet="flop"
        onPlayingChange={playSpy}
      />,
    );
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));
    expect(playSpy).toHaveBeenLastCalledWith(true);

    // Preflop → Flop at 1500ms, then next tick finds cur>=max and halts.
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Play state flipped back to false.
    expect(playSpy).toHaveBeenLastCalledWith(false);
    expect(
      screen
        .getByTestId('scrubber-play-toggle')
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('pause stops auto-advance (AC 2)', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    render(<HandScrubberPanel onStreetIndexChange={spy} />);
    const play = screen.getByTestId('scrubber-play-toggle');
    fireEvent.click(play);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    fireEvent.click(play); // pause
    spy.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does NOT write to the replay slice in live mode (AC 5)', () => {
    render(<HandScrubberPanel />);
    fireEvent.click(screen.getByTestId('scrubber-street-turn'));
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));
    const r = useTableStore.getState().replay;
    expect(r.streetIndex).toBe(0);
    expect(r.isPlaying).toBe(false);
  });
});

describe('<HandScrubberPanel> — bindToReplay mode', () => {
  beforeEach(() => resetStore());

  it('reads initial state from the replay slice', () => {
    useTableStore.getState().setReplayStreetIndex(2);
    render(<HandScrubberPanel bindToReplay />);
    expect(
      screen.getByTestId('scrubber-street-turn').getAttribute('data-active'),
    ).toBe('true');
  });

  it('clicking a street writes to the replay slice (AC 5)', () => {
    render(<HandScrubberPanel bindToReplay />);
    fireEvent.click(screen.getByTestId('scrubber-street-flop'));
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
  });

  it('play button writes isPlaying to the replay slice', () => {
    render(<HandScrubberPanel bindToReplay />);
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));
    expect(useTableStore.getState().replay.isPlaying).toBe(true);
  });

  it('auto-advance uses replay.speed, not the `speed` prop (AC 2)', () => {
    vi.useFakeTimers();
    useTableStore.getState().setReplaySpeed(4);
    render(<HandScrubberPanel bindToReplay speed={1} />);
    fireEvent.click(screen.getByTestId('scrubber-play-toggle'));
    // At 4x, one street every 375ms.
    act(() => {
      vi.advanceTimersByTime(375);
    });
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
  });

  it('external writes to the replay slice re-render the active street', () => {
    render(<HandScrubberPanel bindToReplay />);
    act(() => {
      useTableStore.getState().setReplayStreetIndex(3);
    });
    expect(
      screen.getByTestId('scrubber-street-river').getAttribute('data-active'),
    ).toBe('true');
  });
});

describe('<HandScrubberPanel> — visibility', () => {
  it('renders nothing when hidden', () => {
    const { container } = render(<HandScrubberPanel hidden />);
    expect(container.firstChild).toBeNull();
  });
});
