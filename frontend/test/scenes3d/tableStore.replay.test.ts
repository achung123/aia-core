/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
  REPLAY_SPEEDS,
  TABLE_STORE_PERSIST_KEY,
} from '../../src/scenes3d/state/tableStore';

const resetStore = () => {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
  });
  window.localStorage.clear();
};

describe('useTableStore — replay slice (T-023)', () => {
  beforeEach(() => resetStore());

  it('exposes the 4 canonical speeds', () => {
    expect(REPLAY_SPEEDS).toEqual([0.5, 1, 2, 4]);
  });

  it('ships a sensible default replay state (paused, hand 0, street 0, 1x)', () => {
    const { replay } = useTableStore.getState();
    expect(replay).toEqual({
      handIndex: 0,
      streetIndex: 0,
      isPlaying: false,
      speed: 1,
    });
  });

  it('setReplayStreetIndex updates only streetIndex', () => {
    useTableStore.getState().setReplayStreetIndex(2);
    const r = useTableStore.getState().replay;
    expect(r.streetIndex).toBe(2);
    expect(r.handIndex).toBe(0);
    expect(r.isPlaying).toBe(false);
  });

  it('setReplayPlaying toggles isPlaying', () => {
    useTableStore.getState().setReplayPlaying(true);
    expect(useTableStore.getState().replay.isPlaying).toBe(true);
    useTableStore.getState().setReplayPlaying(false);
    expect(useTableStore.getState().replay.isPlaying).toBe(false);
  });

  it('setReplaySpeed replaces speed', () => {
    useTableStore.getState().setReplaySpeed(2);
    expect(useTableStore.getState().replay.speed).toBe(2);
    useTableStore.getState().setReplaySpeed(0.5);
    expect(useTableStore.getState().replay.speed).toBe(0.5);
  });

  it('setReplayHandIndex clamps below zero to zero', () => {
    useTableStore.getState().setReplayHandIndex(-3);
    expect(useTableStore.getState().replay.handIndex).toBe(0);
    useTableStore.getState().setReplayHandIndex(5);
    expect(useTableStore.getState().replay.handIndex).toBe(5);
  });

  it('stepReplayStreet advances by 1 and caps at 4', () => {
    const s = useTableStore.getState();
    s.stepReplayStreet();
    expect(useTableStore.getState().replay.streetIndex).toBe(1);
    useTableStore.getState().setReplayStreetIndex(4);
    useTableStore.getState().stepReplayStreet();
    expect(useTableStore.getState().replay.streetIndex).toBe(4);
  });

  it('does NOT persist replay to localStorage (session-scoped)', () => {
    useTableStore.getState().setReplayStreetIndex(3);
    useTableStore.getState().setReplayPlaying(true);
    useTableStore.getState().setReplaySpeed(4);
    // persist middleware writes synchronously via storage listener
    const raw = window.localStorage.getItem(TABLE_STORE_PERSIST_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toBeDefined();
    expect(parsed.state.replay).toBeUndefined();
    expect(parsed.state.theme).toBeDefined();
  });
});
