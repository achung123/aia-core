// T-027 — Quality-tier mapping module.
//
// Canonical per-tier settings consumed by `<PokerTable>` children and by the
// auto-degrade hook (T-028). Values mirror
// `specs/table-3d-revamp-010/plan.md` § "Quality Tiers & Performance Budget"
// exactly — any drift defeats the reason tier settings were hoisted into
// plan.md (see Cycle 38 review § M-1).
//
// Additions here land tier flags first; migrating T-014's inline env-map and
// shadow-map values in `PokerTable.tsx` / `Table.tsx` to read from this module
// is scoped to T-038 + t4dp per the T-014 close notes.

import type { QualityTier } from '../types';

export const QUALITY_TIER_NAMES: ReadonlyArray<QualityTier> = ['low', 'medium', 'high'];

export type AntiAliasingMode = 'off' | 'msaa4x';
export type EnvMapMode = 'none' | 'baked' | 'preset';
export type PBRMode = 'lambert' | 'pbr-no-env' | 'pbr-env';

export interface ShadowSettings {
  enabled: boolean;
  /** Square shadow-map dimension in texels. 0 when disabled. */
  mapSize: number;
  /** PCF-soft shadows (High tier only per plan.md). */
  soft: boolean;
}

export interface EnvMapSettings {
  mode: EnvMapMode;
  /** Baked resolution in texels; `null` for `none` or `preset` (drei default). */
  resolution: number | null;
}

export interface QualityTierSettings {
  dprCap: number;
  antiAliasing: AntiAliasingMode;
  shadows: ShadowSettings;
  envMap: EnvMapSettings;
  pbr: PBRMode;
  cardAtlasResolution: number;
  chipCap: number;
  showdownGlow: boolean;
  seatPulse: boolean;
  cinematicAutoOrbit: boolean;
}

/**
 * Per-tier setting table.
 *
 * Source of truth: plan.md § "Quality Tiers & Performance Budget" table.
 * Do NOT edit these values without a corresponding plan.md update.
 */
export const QUALITY_TIER_SETTINGS: Readonly<Record<QualityTier, QualityTierSettings>> = {
  low: {
    dprCap: 1.0,
    antiAliasing: 'off',
    shadows: { enabled: false, mapSize: 0, soft: false },
    envMap: { mode: 'none', resolution: null },
    pbr: 'lambert',
    cardAtlasResolution: 1024,
    chipCap: 10,
    showdownGlow: false,
    seatPulse: true,
    cinematicAutoOrbit: false,
  },
  medium: {
    dprCap: 1.5,
    antiAliasing: 'off',
    shadows: { enabled: true, mapSize: 512, soft: false },
    envMap: { mode: 'baked', resolution: 256 },
    pbr: 'pbr-no-env',
    cardAtlasResolution: 2048,
    chipCap: 15,
    showdownGlow: true,
    seatPulse: true,
    cinematicAutoOrbit: true,
  },
  high: {
    dprCap: 2.0,
    antiAliasing: 'msaa4x',
    shadows: { enabled: true, mapSize: 1024, soft: true },
    envMap: { mode: 'preset', resolution: null },
    pbr: 'pbr-env',
    cardAtlasResolution: 2048,
    chipCap: 20,
    showdownGlow: true,
    seatPulse: true,
    cinematicAutoOrbit: true,
  },
};

/** Viewport breakpoint (inclusive) for mobile-vs-desktop default selection. */
export const MOBILE_BREAKPOINT_PX = 768;
export const DEFAULT_QUALITY_TIER_DESKTOP: QualityTier = 'high';
export const DEFAULT_QUALITY_TIER_MOBILE: QualityTier = 'medium';

/**
 * Resolve the initial `qualityTier` for a fresh session (tasks.md T-027 AC-1).
 * Viewports ≤ `MOBILE_BREAKPOINT_PX` get `medium`; anything wider gets `high`.
 * Falls back to `high` in environments without a `window` (SSR / node).
 */
export function resolveDefaultQualityTier(viewport?: { width: number }): QualityTier {
  const width =
    viewport?.width ??
    (typeof window !== 'undefined' ? window.innerWidth : Number.POSITIVE_INFINITY);
  return width <= MOBILE_BREAKPOINT_PX
    ? DEFAULT_QUALITY_TIER_MOBILE
    : DEFAULT_QUALITY_TIER_DESKTOP;
}

/** Drop one step: high → medium → low, low stays low. */
export function nextLowerTier(t: QualityTier): QualityTier {
  if (t === 'high') return 'medium';
  if (t === 'medium') return 'low';
  return 'low';
}

/** Raise one step: low → medium → high, high stays high. */
export function nextHigherTier(t: QualityTier): QualityTier {
  if (t === 'low') return 'medium';
  if (t === 'medium') return 'high';
  return 'high';
}
