/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CameraPresetToolbar } from '../../src/scenes3d/components/CameraPresetToolbar';
import { CAMERA_PRESET_NAMES } from '../../src/scenes3d/animations/cameraPresets';

afterEach(() => cleanup());

describe('<CameraPresetToolbar>', () => {
  it('renders three buttons, one per preset (AC 1)', () => {
    const { getAllByRole } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} />,
    );
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(3);
    const presets = buttons.map((b) => b.getAttribute('data-preset'));
    expect(presets).toEqual([...CAMERA_PRESET_NAMES]);
  });

  it('marks the active preset with aria-pressed="true" (AC 1)', () => {
    const { getByRole } = render(
      <CameraPresetToolbar value="topDown" onChange={() => {}} />,
    );
    const toolbar = getByRole('toolbar');
    const active = toolbar.querySelector('[data-preset="topDown"]')!;
    const other = toolbar.querySelector('[data-preset="default"]')!;
    expect(active.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('exposes the toolbar role + accessible name for assistive tech', () => {
    const { getByRole } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} />,
    );
    const toolbar = getByRole('toolbar');
    expect(toolbar.getAttribute('aria-label')).toMatch(/camera/i);
  });

  it('invokes onChange with the clicked preset name', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <CameraPresetToolbar value="default" onChange={onChange} />,
    );
    const toolbar = getByRole('toolbar');
    fireEvent.click(toolbar.querySelector('[data-preset="cinematic"]')!);
    expect(onChange).toHaveBeenCalledWith('cinematic');
  });

  it('each button meets the 44x44 tap-target minimum (AC 4)', () => {
    const { getAllByRole } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} />,
    );
    for (const btn of getAllByRole('button')) {
      const s = (btn as HTMLButtonElement).style;
      const minW = parseInt(s.minWidth, 10);
      const minH = parseInt(s.minHeight, 10);
      expect(minW).toBeGreaterThanOrEqual(44);
      expect(minH).toBeGreaterThanOrEqual(44);
    }
  });

  it('renders nothing when hidden (player-mode lockout — T-022 coordination)', () => {
    const { container } = render(
      <CameraPresetToolbar value="default" onChange={() => {}} hidden />,
    );
    expect(container.firstChild).toBeNull();
  });
});
