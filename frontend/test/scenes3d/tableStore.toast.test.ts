/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
  TABLE_STORE_PERSIST_KEY,
} from '../../src/scenes3d/state/tableStore';

function resetStore() {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: 'high',
    manualOverride: false,
    tierToast: null,
  });
  window.localStorage.clear();
}

describe('useTableStore — tier-toast slice (T-028)', () => {
  beforeEach(() => resetStore());

  it('tierToast defaults to null', () => {
    expect(useTableStore.getState().tierToast).toBeNull();
  });

  it('setTierToast stores the message; dismissTierToast clears it', () => {
    const s = useTableStore.getState();
    s.setTierToast('Quality adjusted for smoother playback');
    expect(useTableStore.getState().tierToast).toBe(
      'Quality adjusted for smoother playback',
    );
    useTableStore.getState().dismissTierToast();
    expect(useTableStore.getState().tierToast).toBeNull();
  });

  it('tierToast is NOT persisted to localStorage (session-scoped)', () => {
    useTableStore.getState().setTierToast('x');
    const raw = window.localStorage.getItem(TABLE_STORE_PERSIST_KEY);
    // The persist envelope should not include tierToast. It may be null or
    // absent; what matters is we never round-trip the string.
    expect(raw ?? '').not.toContain('"tierToast":"x"');
  });
});
