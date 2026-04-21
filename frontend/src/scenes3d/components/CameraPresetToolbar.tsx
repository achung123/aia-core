import type { CSSProperties } from 'react';
import {
  CAMERA_PRESET_NAMES,
  type CameraPresetName,
} from '../animations/cameraPresets';
import type { ViewerContext } from '../types';

/**
 * Toolbar overlay for T-021 — three buttons that drive the current
 * preset on `<PokerTable>`. Rendered as plain HTML (outside `<Canvas>`)
 * by the view consumer (e.g. `<PlaybackView>`, dealer embed). Mobile tap
 * targets meet the 44×44pt minimum.
 *
 * T-026 — the toolbar auto-hides under `viewer.policy === 'player'` so
 * the player-mode camera cannot be unlocked from the seat-POV preset
 * (AC 4). The explicit `hidden` prop still overrides for spectator
 * callers that want manual lockout.
 */
export interface CameraPresetToolbarProps {
  value: CameraPresetName;
  onChange: (preset: CameraPresetName) => void;
  /** When true, the toolbar renders nothing (T-022 player-mode lockout). */
  hidden?: boolean;
  /**
   * Viewer context — when `viewer.policy === 'player'` the toolbar
   * auto-hides regardless of `hidden` (T-026 AC 4 — camera locked).
   */
  viewer?: ViewerContext;
  className?: string;
  style?: CSSProperties;
}

const PRESET_LABELS: Record<CameraPresetName, string> = {
  default: 'Default',
  topDown: 'Top-Down',
  cinematic: 'Cinematic',
};

/** 44×44pt minimum per iOS HIG / Material touch guidelines (spec AC 4). */
const MIN_TAP_TARGET_PX = 44;

export function CameraPresetToolbar({
  value,
  onChange,
  hidden,
  viewer,
  className,
  style,
}: CameraPresetToolbarProps) {
  // T-026 AC 4 — player policy locks the preset; the toolbar is never
  // rendered so users cannot switch away from seat-POV.
  if (viewer?.policy === 'player') return null;
  if (hidden) return null;
  return (
    <div
      role="toolbar"
      aria-label="Camera preset"
      className={className}
      data-testid="camera-preset-toolbar"
      style={{
        display: 'flex',
        gap: 8,
        ...style,
      }}
    >
      {CAMERA_PRESET_NAMES.map((name) => {
        const active = name === value;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            data-preset={name}
            data-active={active ? 'true' : 'false'}
            onClick={() => onChange(name)}
            style={{
              minWidth: MIN_TAP_TARGET_PX,
              minHeight: MIN_TAP_TARGET_PX,
              padding: '0 12px',
              cursor: 'pointer',
              fontWeight: active ? 600 : 400,
            }}
          >
            {PRESET_LABELS[name]}
          </button>
        );
      })}
    </div>
  );
}

export default CameraPresetToolbar;
