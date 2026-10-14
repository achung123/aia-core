/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
  TABLE_STORE_PERSIST_KEY,
} from '../../src/scenes3d/state/tableStore';
import type { QualityTier } from '../../src/scenes3d/types';

const resetStore = () => {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: 'high',
    manualOverride: false,
  });
  window.localStorage.clear();
};

describe('useTableStore — quality-tier slice (T-027)', () => {
  beforeEach(() => resetStore());

  it('exposes a qualityTier with one of the three canonical values', () => {
    const t = useTableStore.getState().qualityTier;
    expect(['low', 'medium', 'high']).toContain(t);
  });

  it('manualOverride defaults to false (auto-degrade allowed on fresh session)', () => {
    expect(useTableStore.getState().manualOverride).toBe(false);
  });

  it('setTier replaces the tier value (plan.md § State Shape)', () => {
    const s = useTableStore.getState();
    s.setTier('low');
    expect(useTableStore.getState().qualityTier).toBe('low');
    useTableStore.getState().setTier('medium');
    expect(useTableStore.getState().qualityTier).toBe('medium');
    useTableStore.getState().setTier('high');
    expect(useTableStore.getState().qualityTier).toBe('high');
  });

  it('setTier does NOT auto-flip manualOverride (caller owns that signal)', () => {
    // plan.md pseudocode calls store.setTier(...) from the auto-degrade path
    // WITHOUT flipping manualOverride — the flag is a separate action so the
    // auto-degrade hook can operate independently of user intent.
    useTableStore.setState({ manualOverride: false });
    useTableStore.getState().setTier('low');
    expect(useTableStore.getState().manualOverride).toBe(false);
    useTableStore.setState({ manualOverride: true });
    useTableStore.getState().setTier('high');
    expect(useTableStore.getState().manualOverride).toBe(true);
  });

  it('setManualOverride flips the flag independently of setTier', () => {
    useTableStore.getState().setManualOverride(true);
    expect(useTableStore.getState().manualOverride).toBe(true);
    useTableStore.getState().setManualOverride(false);
    expect(useTableStore.getState().manualOverride).toBe(false);
  });

  it('persists qualityTier and manualOverride (plan.md § State Shape partialize)', () => {
    useTableStore.getState().setTier('low');
    useTableStore.getState().setManualOverride(true);
    const raw = window.localStorage.getItem(TABLE_STORE_PERSIST_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.qualityTier).toBe('low');
    expect(parsed.state.manualOverride).toBe(true);
    // theme co-persisted, replay still excluded
    expect(parsed.state.theme).toBeDefined();
    expect(parsed.state.replay).toBeUndefined();
  });

  it('partialize whitelist: ONLY theme, qualityTier, manualOverride are persisted', () => {
    useTableStore.getState().setTier('medium');
    useTableStore.getState().setManualOverride(true);
    useTableStore.getState().setReplayStreetIndex(3);
    const raw = window.localStorage.getItem(TABLE_STORE_PERSIST_KEY);
    const parsed = JSON.parse(raw!);
    expect(Object.keys(parsed.state).sort()).toEqual(
      ['manualOverride', 'qualityTier', 'theme'].sort(),
    );
  });

  it('notifies subscribers on setTier (no remount needed — AC-2 "without page reload")', () => {
    let calls = 0;
    const unsub = useTableStore.subscribe(() => {
      calls += 1;
    });
    useTableStore.getState().setTier('medium');
    useTableStore.getState().setTier('low');
    unsub();
    expect(calls).toBe(2);
  });

  it('setTier accepts all three QualityTier values with stable typing', () => {
    const tiers: QualityTier[] = ['low', 'medium', 'high'];
    for (const t of tiers) {
      useTableStore.getState().setTier(t);
      expect(useTableStore.getState().qualityTier).toBe(t);
    }
  });
});
