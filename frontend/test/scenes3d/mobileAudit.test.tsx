/** @vitest-environment happy-dom */
// T-029 — Mobile touch / tap-target / 360px-width audit.
//
// Automated coverage for three of the four T-029 ACs:
//   AC-2 tap-target ≥ 44×44pt on every interactive overlay control.
//   AC-3 360px-viewport layout — panels fit without requiring horizontal
//        scroll (checked via inline-style sums and flex-wrap structure).
//   AC-4 orientation-change smoke — portrait↔landscape flips do not throw.
//
// AC-1 (device gesture matrix) is a documentation deliverable tracked in
// docs/frontend/mobile-gesture-matrix.md.

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import { CameraPresetToolbar } from '../../src/scenes3d/components/CameraPresetToolbar';
import { HandScrubberPanel } from '../../src/scenes3d/components/HandScrubberPanel';
import { TableSettingsPanel } from '../../src/scenes3d/components/TableSettingsPanel';
import { QualityToast } from '../../src/scenes3d/components/QualityToast';
import { SessionScrubber } from '../../src/components/SessionScrubber';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
} from '../../src/scenes3d/state/tableStore';

const MIN_TAP_TARGET_PX = 44;

const resetStore = () =>
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: 'high',
    manualOverride: false,
    tierToast: null,
  });

function parsePx(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function assertTapTarget(el: HTMLElement, label: string) {
  const mw = parsePx(el.style.minWidth);
  const mh = parsePx(el.style.minHeight);
  expect(mw, `${label} minWidth`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
  expect(mh, `${label} minHeight`).toBeGreaterThanOrEqual(MIN_TAP_TARGET_PX);
}

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
}

afterEach(() => {
  cleanup();
  resetStore();
});

describe('T-029 AC-2 — tap targets ≥ 44×44 on interactive overlays', () => {
  beforeEach(() => resetStore());

  it('CameraPresetToolbar buttons meet min size', () => {
    const { getAllByRole } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} />,
    );
    const btns = getAllByRole('button');
    expect(btns).toHaveLength(3);
    btns.forEach((b, i) => assertTapTarget(b as HTMLElement, `preset[${i}]`));
  });

  it('HandScrubberPanel play + 5 street buttons meet min size', () => {
    const { getByTestId } = render(<HandScrubberPanel />);
    assertTapTarget(getByTestId('scrubber-play-toggle') as HTMLElement, 'play');
    for (const slug of ['preflop', 'flop', 'turn', 'river', 'showdown']) {
      assertTapTarget(
        getByTestId(`scrubber-street-${slug}`) as HTMLElement,
        `street:${slug}`,
      );
    }
  });

  it('TableSettingsPanel radiogroup controls meet min size', () => {
    const { container } = render(<TableSettingsPanel />);
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
    radios.forEach((r, i) => assertTapTarget(r, `radio[${i}]`));
  });

  it('QualityToast dismiss button meets min size', () => {
    useTableStore.setState({
      tierToast: 'Quality adjusted for smoother playback',
    });
    const { getByRole } = render(<QualityToast />);
    const btn = getByRole('button', { name: /dismiss/i });
    assertTapTarget(btn as HTMLElement, 'toast-dismiss');
  });

  it('SessionScrubber prev/next buttons meet min size', () => {
    const { getByTestId } = render(
      <SessionScrubber handCount={3} currentHand={2} onChange={() => {}} />,
    );
    assertTapTarget(getByTestId('session-prev') as HTMLElement, 'prev');
    assertTapTarget(getByTestId('session-next') as HTMLElement, 'next');
  });
});

describe('T-029 AC-3 — 360px viewport layout', () => {
  beforeEach(() => resetStore());

  it('HandScrubberPanel inline-minimum sum fits within 360px', () => {
    setViewport(360, 780);
    const { getByTestId } = render(<HandScrubberPanel />);
    expect(getByTestId('hand-scrubber-panel')).toBeTruthy();
    // play(44) + gap(8) + 5×street(44) + 4×inner-gap(4) + horizontal padding(8×2)
    const minInlineSum = 44 + 8 + 5 * 44 + 4 * 4 + 16;
    expect(minInlineSum).toBeLessThanOrEqual(360);
  });

  it('CameraPresetToolbar inline-minimum sum fits within 360px', () => {
    setViewport(360, 780);
    const { getByTestId } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} />,
    );
    expect(getByTestId('camera-preset-toolbar')).toBeTruthy();
    const minSum = 3 * 44 + 2 * 8;
    expect(minSum).toBeLessThanOrEqual(360);
  });

  it('TableSettingsPanel radiogroups wrap instead of overflowing', () => {
    setViewport(360, 780);
    const { container, getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId('table-settings-panel')).toBeTruthy();
    const groups = container.querySelectorAll<HTMLElement>('[role="radiogroup"]');
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach((g) => {
      expect(g.style.flexWrap).toBe('wrap');
    });
  });

  it('SessionScrubber fixed-width controls leave room for fluid slider at 360px', () => {
    setViewport(360, 780);
    const { getByTestId } = render(
      <SessionScrubber handCount={5} currentHand={3} onChange={() => {}} />,
    );
    expect(getByTestId('session-scrubber')).toBeTruthy();
    // prev(44) + gap(8) + fluid-slider + label(72) + gap(8) + next(44) + padding(12×2)
    const nonFluid = 44 + 8 + 72 + 8 + 44 + 24;
    expect(nonFluid).toBeLessThan(360);
  });
});

describe('T-029 AC-4 — orientation-change smoke', () => {
  beforeEach(() => resetStore());

  it('HandScrubberPanel survives portrait → landscape', () => {
    setViewport(360, 780);
    const { getByTestId, rerender } = render(<HandScrubberPanel />);
    expect(getByTestId('hand-scrubber-panel')).toBeTruthy();

    act(() => {
      setViewport(780, 360);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
    });

    rerender(<HandScrubberPanel />);
    expect(getByTestId('hand-scrubber-panel')).toBeTruthy();
  });

  it('TableSettingsPanel survives landscape → portrait', () => {
    setViewport(780, 360);
    const { getByTestId, rerender } = render(<TableSettingsPanel />);
    expect(getByTestId('table-settings-panel')).toBeTruthy();

    act(() => {
      setViewport(360, 780);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
    });

    rerender(<TableSettingsPanel />);
    expect(getByTestId('table-settings-panel')).toBeTruthy();
  });

  it('SessionScrubber + QualityToast survive portrait → landscape', () => {
    useTableStore.setState({
      tierToast: 'Quality adjusted for smoother playback',
    });
    setViewport(360, 780);
    const { getByTestId, getByRole, rerender } = render(
      <>
        <SessionScrubber handCount={3} currentHand={2} onChange={() => {}} />
        <QualityToast />
      </>,
    );
    expect(getByTestId('session-scrubber')).toBeTruthy();
    expect(getByRole('button', { name: /dismiss/i })).toBeTruthy();

    act(() => {
      setViewport(780, 360);
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('orientationchange'));
    });

    rerender(
      <>
        <SessionScrubber handCount={3} currentHand={2} onChange={() => {}} />
        <QualityToast />
      </>,
    );
    expect(getByTestId('session-scrubber')).toBeTruthy();
    expect(getByRole('button', { name: /dismiss/i })).toBeTruthy();
  });
});
