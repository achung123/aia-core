/**
 * Single source of truth for the app palette. CSS custom properties in
 * style.css mirror these values; inline-style code and the 3D scene import
 * `theme` so no component hard-codes a colour.
 */
export const theme = {
  // surfaces
  bg: '#0a0a0b',
  surface: '#121214',
  raised: '#1a1a1e',
  raisedHover: '#232328',
  border: '#26262b',
  borderStrong: '#3a3a42',
  // text
  text: '#f4f4f5',
  textSecondary: '#d4d4d8',
  muted: '#a1a1aa',
  faint: '#8b8b94',
  // accent (crimson)
  accent: '#e11d48',
  accentHover: '#f43f5e',
  accentPressed: '#be123c',
  accentText: '#fb7185',
  accentSoft: '#fecdd3',
  accentTint: 'rgba(225, 29, 72, 0.15)',
  accentTintSoft: 'rgba(225, 29, 72, 0.1)',
  accentSurface: '#1c0d12',
  accentSurfaceStrong: '#33101a',
  accentBorder: '#7f1d1d',
  // semantic
  success: '#22c55e',
  successText: '#4ade80',
  warning: '#f59e0b',
  warningText: '#fbbf24',
  danger: '#dc2626',
  dangerText: '#f87171',
  onAccent: '#ffffff',
} as const;

export type Theme = typeof theme;
