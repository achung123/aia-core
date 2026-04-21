import { Canvas } from '@react-three/fiber';
import type { ReactNode } from 'react';
import { useTableStore } from './state/tableStore';

export interface PokerCanvasProps {
  children?: ReactNode;
  /**
   * Device pixel ratio cap. Defaults to [1, 2] — never exceeds 2 even on
   * high-DPI displays. Quality-tier slice may override via tableStore later.
   */
  dpr?: [number, number] | number;
  /** Optional className forwarded to the Canvas root. */
  className?: string;
}

/**
 * Root R3F `<Canvas>` wrapper for the 3D poker scene.
 *
 * Provides baseline camera, lighting, and renderer defaults. Actual scene
 * content (table, seats, cards, chips, cameraRig) is composed by `<PokerTable>`
 * as children.
 *
 * Defaults:
 *   - `PerspectiveCamera` at [0, 6, 8], fov 45
 *   - Ambient light @ 0.4 + directional light @ 1.0 from above-right
 *   - `dpr` capped at [1, 2]
 *   - `antialias: true`, `powerPreference: 'high-performance'`
 *   - `shadows` enabled only when `useTableStore.qualityTier === 'high'`
 *     (T-038 Item-1 — closes Cycle 38 M-2: gives the `<directionalLight
 *     castShadow={qualityTier === 'high'}>` gate set in T-014 runtime effect
 *     instead of being a dead signal).
 */
export function PokerCanvas({
  children,
  dpr = [1, 2],
  className,
}: PokerCanvasProps) {
  const qualityTier = useTableStore((s) => s.qualityTier);
  const shadowsEnabled = qualityTier === 'high';
  return (
    <Canvas
      className={className}
      dpr={dpr}
      camera={{ position: [0, 6, 8], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      {...(shadowsEnabled ? { shadows: true } : {})}
    >
      {/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.0} />
      {/* eslint-enable react/no-unknown-property */}
      {children}
    </Canvas>
  );
}

export default PokerCanvas;
