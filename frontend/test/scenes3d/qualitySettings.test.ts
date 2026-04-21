/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import {
  QUALITY_TIER_NAMES,
  QUALITY_TIER_SETTINGS,
  MOBILE_BREAKPOINT_PX,
  DEFAULT_QUALITY_TIER_DESKTOP,
  DEFAULT_QUALITY_TIER_MOBILE,
  nextLowerTier,
  nextHigherTier,
  resolveDefaultQualityTier,
} from '../../src/scenes3d/state/qualitySettings';
import type { QualityTier } from '../../src/scenes3d/types';

describe('qualitySettings (T-027 tier mapping module)', () => {
  it('exposes the three canonical tier names in ascending order', () => {
    expect(QUALITY_TIER_NAMES).toEqual(['low', 'medium', 'high']);
  });

  it('defaults: desktop=high, mobile=medium (tasks.md T-027 AC-1)', () => {
    expect(DEFAULT_QUALITY_TIER_DESKTOP).toBe('high');
    expect(DEFAULT_QUALITY_TIER_MOBILE).toBe('medium');
    expect(MOBILE_BREAKPOINT_PX).toBe(768);
  });

  it('resolveDefaultQualityTier picks medium for viewports ≤ 768px, high above', () => {
    expect(resolveDefaultQualityTier({ width: 360 })).toBe('medium');
    expect(resolveDefaultQualityTier({ width: 768 })).toBe('medium');
    expect(resolveDefaultQualityTier({ width: 769 })).toBe('high');
    expect(resolveDefaultQualityTier({ width: 1440 })).toBe('high');
  });

  it('resolveDefaultQualityTier reads window.innerWidth when no argument given', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    expect(resolveDefaultQualityTier()).toBe('medium');
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
    expect(resolveDefaultQualityTier()).toBe('high');
  });

  describe('QUALITY_TIER_SETTINGS matches plan.md § Quality Tiers & Performance Budget', () => {
    // plan.md canonical table — these values must not drift.
    const expected: Record<QualityTier, Record<string, unknown>> = {
      low: {
        dprCap: 1.0,
        antiAliasing: 'off',
        shadowsEnabled: false,
        shadowMapSize: 0,
        shadowsSoft: false,
        envMapMode: 'none',
        envMapResolution: null,
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
        shadowsEnabled: true,
        shadowMapSize: 512,
        shadowsSoft: false,
        envMapMode: 'baked',
        envMapResolution: 256,
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
        shadowsEnabled: true,
        shadowMapSize: 1024,
        shadowsSoft: true,
        envMapMode: 'preset',
        envMapResolution: null,
        pbr: 'pbr-env',
        cardAtlasResolution: 2048,
        chipCap: 20,
        showdownGlow: true,
        seatPulse: true,
        cinematicAutoOrbit: true,
      },
    };

    for (const tier of ['low', 'medium', 'high'] as const) {
      it(`tier=${tier}`, () => {
        const s = QUALITY_TIER_SETTINGS[tier];
        const e = expected[tier];
        expect(s.dprCap).toBe(e.dprCap);
        expect(s.antiAliasing).toBe(e.antiAliasing);
        expect(s.shadows.enabled).toBe(e.shadowsEnabled);
        expect(s.shadows.mapSize).toBe(e.shadowMapSize);
        expect(s.shadows.soft).toBe(e.shadowsSoft);
        expect(s.envMap.mode).toBe(e.envMapMode);
        expect(s.envMap.resolution).toBe(e.envMapResolution);
        expect(s.pbr).toBe(e.pbr);
        expect(s.cardAtlasResolution).toBe(e.cardAtlasResolution);
        expect(s.chipCap).toBe(e.chipCap);
        expect(s.showdownGlow).toBe(e.showdownGlow);
        expect(s.seatPulse).toBe(e.seatPulse);
        expect(s.cinematicAutoOrbit).toBe(e.cinematicAutoOrbit);
      });
    }
  });

  it('Cycle 38 M-1: Medium env map is 256 and High uses drei preset (resolution=null)', () => {
    // Closes Cycle 38 M-1 transitively: canonical mapping matches plan.md exactly.
    expect(QUALITY_TIER_SETTINGS.medium.envMap).toEqual({ mode: 'baked', resolution: 256 });
    expect(QUALITY_TIER_SETTINGS.high.envMap).toEqual({ mode: 'preset', resolution: null });
    expect(QUALITY_TIER_SETTINGS.low.envMap).toEqual({ mode: 'none', resolution: null });
  });

  describe('nextLowerTier / nextHigherTier', () => {
    it('nextLowerTier: high→medium→low, low stays low (floor)', () => {
      expect(nextLowerTier('high')).toBe('medium');
      expect(nextLowerTier('medium')).toBe('low');
      expect(nextLowerTier('low')).toBe('low');
    });

    it('nextHigherTier: low→medium→high, high stays high (ceiling)', () => {
      expect(nextHigherTier('low')).toBe('medium');
      expect(nextHigherTier('medium')).toBe('high');
      expect(nextHigherTier('high')).toBe('high');
    });
  });
});
