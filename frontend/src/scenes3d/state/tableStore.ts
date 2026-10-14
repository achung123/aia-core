// Zustand slice for `<PokerTable>` theme (T-015).
//
// Only the theme slice lands in T-015. The broader `TableStoreState` sketched
// in plan.md § "State Shape (Zustand Slices)" (qualityTier, cameraPreset,
// replay) is filled in by T-021 / T-027 / T-023b; this file defines the
// persist envelope so those slices can be added without breaking the
// localStorage key or the migration story.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { QualityTier } from '../types';
import { resolveDefaultQualityTier } from './qualitySettings';

// ---------------------------------------------------------------------------
// Theme domain
// ---------------------------------------------------------------------------

export type ThemeMode = 'dark' | 'light';
export const THEME_MODES: ReadonlyArray<ThemeMode> = ['dark', 'light'];

/** Felt color option exposed by the settings panel (AC 1). */
export interface FeltColorOption {
  /** Short stable id used as DOM hook / test-id suffix. */
  id: 'emerald' | 'burgundy' | 'navy';
  /** Human label rendered in the UI. */
  label: string;
  /** CSS hex consumed by `<Table feltColor>`. */
  hex: string;
}

export const FELT_COLORS: ReadonlyArray<FeltColorOption> = [
  // `emerald` matches the pre-T-015 <Table> default (#1a7a1a), so existing
  // persisted states and snapshots keep rendering the same green felt.
  { id: 'emerald', label: 'Emerald', hex: '#1a7a1a' },
  { id: 'burgundy', label: 'Burgundy', hex: '#7a1a3a' },
  { id: 'navy', label: 'Navy', hex: '#1a3a7a' },
];

export type CardBackId = 'classic' | 'modern';

export interface CardBackOption {
  id: CardBackId;
  label: string;
}

export const CARD_BACKS: ReadonlyArray<CardBackOption> = [
  { id: 'classic', label: 'Classic' },
  { id: 'modern', label: 'Modern' },
];

export interface TableTheme {
  mode: ThemeMode;
  /** Hex string, must match one of `FELT_COLORS[].hex`. */
  feltColor: string;
  cardBack: CardBackId;
}

export const DEFAULT_THEME: TableTheme = {
  mode: 'dark',
  feltColor: FELT_COLORS[0].hex,
  cardBack: CARD_BACKS[0].id,
};

// ---------------------------------------------------------------------------
// Replay domain (T-023)
// ---------------------------------------------------------------------------

/** 0=preflop 1=flop 2=turn 3=river 4=showdown — mirrors TableState.streetIndex. */
export type StreetIdx = 0 | 1 | 2 | 3 | 4;

/** The four playback speeds surfaced by `<SessionReplayShell>`. */
export type ReplaySpeed = 0.5 | 1 | 2 | 4;
export const REPLAY_SPEEDS: ReadonlyArray<ReplaySpeed> = [0.5, 1, 2, 4];

/** Session-scoped; NOT persisted (always start a replay at hand 0, paused). */
export interface ReplayState {
  handIndex: number;
  streetIndex: StreetIdx;
  isPlaying: boolean;
  speed: ReplaySpeed;
}

export const DEFAULT_REPLAY: ReplayState = {
  handIndex: 0,
  streetIndex: 0,
  isPlaying: false,
  speed: 1,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface TableStoreState {
  theme: TableTheme;
  setTheme: (partial: Partial<TableTheme>) => void;

  /**
   * Quality tier slice (T-027). Persisted alongside `theme` so a user's pick
   * survives reloads. `manualOverride` gates the auto-degrade hook (T-028):
   * when true, the FPS monitor MUST NOT call `setTier` automatically.
   */
  qualityTier: QualityTier;
  manualOverride: boolean;
  setTier: (t: QualityTier) => void;
  setManualOverride: (b: boolean) => void;

  /**
   * Auto-degrade toast slice (T-028). `tierToast` is session-scoped (NOT
   * persisted): the FPS monitor writes the canonical copy here on a real
   * tier change, and the DOM-side `<QualityToast>` component renders and
   * dismisses it. Never written when `manualOverride=true`, never fired
   * when the tier did not actually change (e.g. already-at-low no-op).
   */
  tierToast: string | null;
  setTierToast: (msg: string) => void;
  dismissTierToast: () => void;

  /** Playback slice (T-023). Not persisted. */
  replay: ReplayState;
  setReplayHandIndex: (i: number) => void;
  setReplayStreetIndex: (i: StreetIdx) => void;
  setReplayPlaying: (b: boolean) => void;
  setReplaySpeed: (s: ReplaySpeed) => void;
  stepReplayStreet: () => void;
}

/** localStorage key for the persist middleware. */
export const TABLE_STORE_PERSIST_KEY = 'aia-table-3d';

export const useTableStore = create<TableStoreState>()(
  persist(
    (set) => ({
      theme: { ...DEFAULT_THEME },
      setTheme: (partial) =>
        set((s) => ({ theme: { ...s.theme, ...partial } })),

      qualityTier: resolveDefaultQualityTier(),
      manualOverride: false,
      setTier: (t) => set({ qualityTier: t }),
      setManualOverride: (b) => set({ manualOverride: b }),

      tierToast: null,
      setTierToast: (msg) => set({ tierToast: msg }),
      dismissTierToast: () => set({ tierToast: null }),

      replay: { ...DEFAULT_REPLAY },
      setReplayHandIndex: (i) =>
        set((s) => ({ replay: { ...s.replay, handIndex: Math.max(0, i | 0) } })),
      setReplayStreetIndex: (i) =>
        set((s) => ({ replay: { ...s.replay, streetIndex: i } })),
      setReplayPlaying: (b) =>
        set((s) => ({ replay: { ...s.replay, isPlaying: b } })),
      setReplaySpeed: (speed) =>
        set((s) => ({ replay: { ...s.replay, speed } })),
      stepReplayStreet: () =>
        set((s) => {
          const next = Math.min(4, s.replay.streetIndex + 1) as StreetIdx;
          return { replay: { ...s.replay, streetIndex: next } };
        }),
    }),
    {
      name: TABLE_STORE_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist `theme`, `qualityTier`, and `manualOverride` per plan.md §
      // "State Shape (Zustand Slices)". `replay` stays session-scoped — the
      // playback entry point always starts at hand 0 — and the tier-related
      // keys survive reloads so the user's quality pick is sticky.
      partialize: (s) => ({
        theme: s.theme,
        qualityTier: s.qualityTier,
        manualOverride: s.manualOverride,
      }),
      version: 1,
    },
  ),
);
