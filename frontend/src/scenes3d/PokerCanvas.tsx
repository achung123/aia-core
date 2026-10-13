import { Canvas } from '@react-three/fiber';
import { Suspense, type ReactNode } from 'react';
import { useTableStore } from './state/tableStore';
import { SceneErrorBoundary } from './components/SceneErrorBoundary';

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
 * Provides baseline camera, lighting, and renderer defaults. Scene content
 * (table, seats, cards, chips, camera rig) is composed by `<PokerTable>` as
 * children, inside a local Suspense + error boundary so a slow font or
 * environment load can never blank the whole canvas.
 *
 * `shadows` is enabled only on the high quality tier.
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
      {/* Wrap children in a local Suspense so any suspending loader
          (drei <Text> font fetch, <Environment> HDR, etc.) does NOT
          collapse R3F's outer Suspense — which would replace the
          ENTIRE scene tree with `null` until the loader resolves and
          produce a black canvas with no DOM error. The empty fallback
          renders nothing while children boot; siblings keep painting. */}
      <Suspense fallback={null}>
        <SceneErrorBoundary>{children}</SceneErrorBoundary>
      </Suspense>
      {/* eslint-enable react/no-unknown-property */}
    </Canvas>
  );
}

export default PokerCanvas;
