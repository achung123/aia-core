/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { QualityToast } from '../../src/scenes3d/components/QualityToast';
import {
  useTableStore,
  DEFAULT_THEME,
  DEFAULT_REPLAY,
} from '../../src/scenes3d/state/tableStore';

function resetStore() {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    replay: { ...DEFAULT_REPLAY },
    qualityTier: 'high',
    manualOverride: false,
    tierToast: null,
  });
}

afterEach(() => cleanup());

describe('<QualityToast>', () => {
  beforeEach(() => resetStore());

  it('renders nothing when tierToast is null', () => {
    const { container } = render(<QualityToast />);
    expect(container.textContent).toBe('');
  });

  it('renders the toast message when tierToast is set', () => {
    act(() => {
      useTableStore.getState().setTierToast('Quality adjusted for smoother playback');
    });
    const { getByRole } = render(<QualityToast />);
    expect(getByRole('status').textContent).toContain(
      'Quality adjusted for smoother playback',
    );
  });

  it('is dismissible via a button (AC-3 "dismissible")', () => {
    act(() => {
      useTableStore.getState().setTierToast('Quality adjusted for smoother playback');
    });
    const { getByRole, queryByRole } = render(<QualityToast />);
    const btn = getByRole('button', { name: /dismiss/i });
    fireEvent.click(btn);
    expect(useTableStore.getState().tierToast).toBeNull();
    expect(queryByRole('status')).toBeNull();
  });
});
