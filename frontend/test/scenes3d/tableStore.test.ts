/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTableStore,
  DEFAULT_THEME,
  FELT_COLORS,
  CARD_BACKS,
  THEME_MODES,
  TABLE_STORE_PERSIST_KEY,
} from '../../src/scenes3d/state/tableStore';

const resetStore = () => {
  useTableStore.setState({ theme: { ...DEFAULT_THEME } });
  window.localStorage.clear();
};

describe('useTableStore (T-015 theme slice)', () => {
  beforeEach(() => resetStore());

  it('ships exactly 3 felt colors, 2 card backs, and 2 modes (AC 1)', () => {
    expect(FELT_COLORS).toHaveLength(3);
    expect(CARD_BACKS).toHaveLength(2);
    expect(THEME_MODES).toEqual(['dark', 'light']);
  });

  it('each felt color is a distinct hex triplet (AC 1)', () => {
    const hexes = FELT_COLORS.map((f) => f.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(3);
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('has a sensible default theme', () => {
    const { theme } = useTableStore.getState();
    expect(theme.mode).toBe('dark');
    expect(FELT_COLORS.some((f) => f.hex === theme.feltColor)).toBe(true);
    expect(CARD_BACKS.some((c) => c.id === theme.cardBack)).toBe(true);
  });

  it('setTheme patches only supplied keys (partial update)', () => {
    const before = useTableStore.getState().theme;
    useTableStore.getState().setTheme({ mode: 'light' });
    const after = useTableStore.getState().theme;
    expect(after.mode).toBe('light');
    expect(after.feltColor).toBe(before.feltColor);
    expect(after.cardBack).toBe(before.cardBack);
  });

  it('setTheme replaces felt color and card back independently', () => {
    const altFelt = FELT_COLORS.find(
      (f) => f.hex !== useTableStore.getState().theme.feltColor,
    )!.hex;
    const altBack = CARD_BACKS.find(
      (c) => c.id !== useTableStore.getState().theme.cardBack,
    )!.id;
    useTableStore.getState().setTheme({ feltColor: altFelt, cardBack: altBack });
    expect(useTableStore.getState().theme.feltColor).toBe(altFelt);
    expect(useTableStore.getState().theme.cardBack).toBe(altBack);
  });

  it('persists theme to localStorage under the documented key (AC 2)', () => {
    useTableStore.getState().setTheme({ mode: 'light' });
    const raw = window.localStorage.getItem(TABLE_STORE_PERSIST_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    // zustand persist wraps in { state, version }
    expect(parsed.state.theme.mode).toBe('light');
  });

  it('subscribers are notified without reconstructing the store (AC 3)', () => {
    // AC 3: theme change applies without remounting the canvas. We assert
    // Zustand's subscribe-based notification, which is the mechanism that
    // lets downstream components re-render in place instead of unmounting.
    let calls = 0;
    const unsub = useTableStore.subscribe(() => {
      calls += 1;
    });
    useTableStore.getState().setTheme({ mode: 'light' });
    useTableStore.getState().setTheme({ mode: 'dark' });
    unsub();
    expect(calls).toBe(2);
  });
});
