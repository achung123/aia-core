import { useTableStore, FELT_COLORS, CARD_BACKS, THEME_MODES } from '../state/tableStore';
import { QUALITY_TIER_NAMES } from '../state/qualitySettings';
import type { QualityTier } from '../types';
import type { CSSProperties } from 'react';

/**
 * DOM overlay (not R3F) that edits the persisted theme slice (T-015).
 * Mounted alongside `<PokerCanvas>` by route shells — see `CameraPresetToolbar`
 * for the sibling pattern. Mobile tap targets meet 44×44pt.
 */
export interface TableSettingsPanelProps {
  hidden?: boolean;
  className?: string;
  style?: CSSProperties;
}

const MIN_TAP_TARGET_PX = 44;

const groupStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const legendStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  opacity: 0.75,
};

export function TableSettingsPanel({
  hidden,
  className,
  style,
}: TableSettingsPanelProps) {
  const theme = useTableStore((s) => s.theme);
  const setTheme = useTableStore((s) => s.setTheme);
  // T-038 Item-3 (T-027 AC-4): tier dropdown wires through the quality-tier
  // slice. Selecting a tier flips `manualOverride=true` so the auto-degrade
  // hook (T-028) MUST NOT overwrite the user's pick.
  const qualityTier = useTableStore((s) => s.qualityTier);
  const setTier = useTableStore((s) => s.setTier);
  const setManualOverride = useTableStore((s) => s.setManualOverride);
  const handleTierSelect = (t: QualityTier) => {
    setTier(t);
    setManualOverride(true);
  };

  if (hidden) return null;

  return (
    <section
      role="region"
      aria-label="Table theme settings"
      data-testid="table-settings-panel"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        ...style,
      }}
    >
      <div style={groupStyle}>
        <span id="tsp-felt-label" style={legendStyle}>
          Felt
        </span>
        <div
          role="radiogroup"
          aria-labelledby="tsp-felt-label"
          style={groupStyle}
        >
          {FELT_COLORS.map((opt) => {
            const active = opt.hex === theme.feltColor;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-pressed={active}
                aria-label={opt.label}
                data-testid={`felt-swatch-${opt.id}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => setTheme({ feltColor: opt.hex })}
                style={{
                  minWidth: MIN_TAP_TARGET_PX,
                  minHeight: MIN_TAP_TARGET_PX,
                  borderRadius: 8,
                  border: active ? '2px solid #fff' : '2px solid transparent',
                  background: opt.hex,
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </div>
      </div>

      <div style={groupStyle}>
        <span id="tsp-back-label" style={legendStyle}>
          Card Back
        </span>
        <div
          role="radiogroup"
          aria-labelledby="tsp-back-label"
          style={groupStyle}
        >
          {CARD_BACKS.map((opt) => {
            const active = opt.id === theme.cardBack;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-pressed={active}
                data-testid={`card-back-${opt.id}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => setTheme({ cardBack: opt.id })}
                style={{
                  minWidth: MIN_TAP_TARGET_PX,
                  minHeight: MIN_TAP_TARGET_PX,
                  padding: '0 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={groupStyle}>
        <span id="tsp-tier-label" style={legendStyle}>
          Quality
        </span>
        <div
          role="radiogroup"
          aria-labelledby="tsp-tier-label"
          style={groupStyle}
        >
          {QUALITY_TIER_NAMES.map((tier) => {
            const active = tier === qualityTier;
            return (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={active}
                aria-pressed={active}
                data-testid={`tier-${tier}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => handleTierSelect(tier)}
                style={{
                  minWidth: MIN_TAP_TARGET_PX,
                  minHeight: MIN_TAP_TARGET_PX,
                  padding: '0 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {tier}
              </button>
            );
          })}
        </div>
      </div>

      <div style={groupStyle}>
        <span id="tsp-mode-label" style={legendStyle}>
          Mode
        </span>
        <div
          role="radiogroup"
          aria-labelledby="tsp-mode-label"
          style={groupStyle}
        >
          {THEME_MODES.map((mode) => {
            const active = mode === theme.mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                aria-pressed={active}
                data-testid={`mode-${mode}`}
                data-active={active ? 'true' : 'false'}
                onClick={() => setTheme({ mode })}
                style={{
                  minWidth: MIN_TAP_TARGET_PX,
                  minHeight: MIN_TAP_TARGET_PX,
                  padding: '0 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TableSettingsPanel;
