import { useLayoutEffect, useRef } from 'react';
import { useChipInstancesRegistry } from './ChipInstances';

export interface ChipStackProps {
  /** Dollar amount this stack represents. */
  amount: number;
  /** World-space base position (x, y, z). */
  position?: [number, number, number];
  /** Per-denomination cap (max chips visible for any one denom). */
  cap?: number;
  /**
   * Render opacity in `(0, 1]`. `1` (default) routes the stack through
   * the primary opaque InstancedMesh pool; any value `< 1` routes it
   * through `<ChipInstances>`'s transparent "dimmed" pool with the
   * pool's material opacity set to this value — used by `<PokerTable>`
   * to dim folded seats' committed-chip stacks (T-018 AC 1 / Cycle 29
   * H-1). Clamped to `(0, 1]` at the registry — values `<= 0` are
   * treated as `1` (no dim).
   */
  opacity?: number;
}

let _stackIdCounter = 0;
function nextStackId(): string {
  _stackIdCounter += 1;
  return `chip-stack-${_stackIdCounter}`;
}

/**
 * A logical stack of chips rendered by the ancestor `<ChipInstances>`
 * container. Does not render any geometry of its own — instead it
 * registers with the container, which allocates instance indices across
 * the shared `InstancedMesh` objects and writes the matrices.
 *
 * Mount / unmount / amount / position / opacity changes all route
 * through the registry; no meshes are ever recreated.
 *
 * When rendered outside of `<ChipInstances>` it becomes a no-op rather
 * than throwing, so consumers can mount individual stacks in isolation
 * (e.g. in a storybook or a test).
 */
export function ChipStack({
  amount,
  position = [0, 0, 0],
  cap,
  opacity = 1,
}: ChipStackProps) {
  const registry = useChipInstancesRegistry();
  const idRef = useRef<string | null>(null);
  if (idRef.current === null) idRef.current = nextStackId();
  const id = idRef.current;

  // Normalise: non-positive / non-finite opacities render as opaque.
  const safeOpacity = Number.isFinite(opacity) && opacity > 0 ? opacity : 1;

  // Register on mount, unregister on unmount. Update on every render to
  // pick up prop changes (amount / position / cap / opacity).
  useLayoutEffect(() => {
    if (!registry) return;
    registry.register(id, {
      amount,
      position,
      cap: cap ?? 20,
      opacity: safeOpacity,
    });
    return () => {
      registry.unregister(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount only
  }, [registry, id]);

  const px = position[0];
  const py = position[1];
  const pz = position[2];
  useLayoutEffect(() => {
    if (!registry) return;
    registry.update(id, {
      amount,
      position: [px, py, pz],
      cap: cap ?? 20,
      opacity: safeOpacity,
    });
  }, [registry, id, amount, px, py, pz, cap, safeOpacity]);

  return null;
}

export default ChipStack;
