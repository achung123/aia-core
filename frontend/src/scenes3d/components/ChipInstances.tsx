import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Denomination scheme (mirrors plan.md § "Chip Instancing")
// ---------------------------------------------------------------------------

export type DenomName = 'White' | 'Red' | 'Green' | 'Black';

export interface Denomination {
  name: DenomName;
  /** Dollar value of one chip. */
  value: number;
  /** Material color (hex). */
  color: number;
}

export const DENOMINATIONS: readonly Denomination[] = [
  { name: 'White', value: 0.1, color: 0xf5f5f5 },
  { name: 'Red', value: 0.25, color: 0xcc2020 },
  { name: 'Green', value: 0.5, color: 0x208020 },
  { name: 'Black', value: 1.0, color: 0x202020 },
] as const;

// Chip mesh geometry constants — mirror the legacy chip-stack values.
const CHIP_RADIUS = 0.18;
const CHIP_THICKNESS = 0.04;
const CHIP_STACK_GAP = 0.005;
const CHIP_STEP = CHIP_THICKNESS + CHIP_STACK_GAP;
const CHIP_BASE_Y = 0.05;

/** Default capacity budget per InstancedMesh. */
const DEFAULT_CAPACITY = 200;
/** Default per-denomination cap within a single <ChipStack>. */
const DEFAULT_CHIP_CAP = 20;

// ---------------------------------------------------------------------------
// Pure decomposition
// ---------------------------------------------------------------------------

/**
 * Decompose a dollar amount into per-denomination chip counts using a
 * greedy, largest-first strategy. Each denomination is capped at `cap`.
 *
 * Internally works in cents to avoid floating-point rounding surprises.
 */
export function chipCountsFor(
  amount: number,
  cap: number = DEFAULT_CHIP_CAP,
): Record<DenomName, number> {
  const counts: Record<DenomName, number> = {
    White: 0,
    Red: 0,
    Green: 0,
    Black: 0,
  };
  if (!Number.isFinite(amount) || amount <= 0) return counts;

  let remaining = Math.round(amount * 100);
  // Iterate largest → smallest.
  for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
    const { name, value } = DENOMINATIONS[i];
    const cents = Math.round(value * 100);
    if (cents <= 0) continue;
    const n = Math.min(Math.floor(remaining / cents), cap);
    counts[name] = n;
    remaining -= n * cents;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Registry (imperative, ref-backed — not React state, to avoid re-renders)
// ---------------------------------------------------------------------------

interface StackRef {
  amount: number;
  position: [number, number, number];
  cap: number;
  /**
   * Render opacity in `(0, 1]`. `1` routes the stack through the primary
   * opaque pool; any value `< 1` routes it through the dimmed pool
   * (transparent material with opacity set from this value). T-018 AC 1
   * fold-dim threads through here (Cycle 29 H-1 completion).
   */
  opacity: number;
}

interface Registry {
  register(stackId: string, ref: StackRef): void;
  update(stackId: string, ref: StackRef): void;
  unregister(stackId: string): void;
}

const ChipInstancesContext = createContext<Registry | null>(null);

/** Hook used by `<ChipStack>` to locate the nearest container. */
export function useChipInstancesRegistry(): Registry | null {
  return useContext(ChipInstancesContext);
}

// ---------------------------------------------------------------------------
// Test probe — lets scene-introspection tests read the InstancedMeshes
// without needing a WebGL-backed R3F test renderer. Also used to clear
// state between tests.
// ---------------------------------------------------------------------------

let _latestMeshes: Record<DenomName, THREE.InstancedMesh> | null = null;
let _latestDimmedMeshes: Record<DenomName, THREE.InstancedMesh> | null = null;
let _latestStacks: Map<string, StackRef> | null = null;

export function __getTestProbe() {
  return {
    getMeshes(): Record<DenomName, THREE.InstancedMesh> {
      if (!_latestMeshes) {
        throw new Error(
          '<ChipInstances> has not mounted yet — nothing to inspect.',
        );
      }
      return _latestMeshes;
    },
    /**
     * Dimmed-pool meshes used for folded-seat committed-chip stacks
     * (T-018 AC 1 / Cycle 29 H-1). Same 4-denomination shape as the
     * primary pool; material opacity reflects the latest active dim
     * stack's `opacity`.
     */
    getDimmedMeshes(): Record<DenomName, THREE.InstancedMesh> {
      if (!_latestDimmedMeshes) {
        throw new Error(
          '<ChipInstances> has not mounted yet — nothing to inspect.',
        );
      }
      return _latestDimmedMeshes;
    },
    /**
     * Snapshot of the live `<ChipStack>` registry. Cycle 19 BUG-CYCLE19-01:
     * chip-slide integration tests need per-stack visibility (amount +
     * position) so they can assert that the originating seat stack
     * shrinks and the pot stack grows independently.
     */
    getStacks(): Array<{ id: string; amount: number; position: [number, number, number] }> {
      if (!_latestStacks) return [];
      return Array.from(_latestStacks.entries()).map(([id, ref]) => ({
        id,
        amount: ref.amount,
        position: [ref.position[0], ref.position[1], ref.position[2]],
      }));
    },
    reset(): void {
      _latestMeshes = null;
      _latestDimmedMeshes = null;
      _latestStacks = null;
    },
  };
}

// ---------------------------------------------------------------------------
// <ChipInstances>
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ChipMeshPool — mutable Three.js resource owned by <ChipInstances>.
//
// Wrapped in a class so that property assignments (`mesh.count = n`,
// `instanceMatrix.needsUpdate = true`) happen inside methods instead of
// directly on values returned from `useMemo` / `useState` — the
// `react-hooks/immutability` lint rule otherwise flags them.
// ---------------------------------------------------------------------------

class ChipMeshPool {
  readonly capacity: number;
  readonly variant: 'opaque' | 'dimmed';
  private readonly geometry: THREE.CylinderGeometry;
  private readonly meshes: Record<DenomName, THREE.InstancedMesh>;

  constructor(capacity: number, variant: 'opaque' | 'dimmed' = 'opaque') {
    this.capacity = capacity;
    this.variant = variant;
    this.geometry = new THREE.CylinderGeometry(
      CHIP_RADIUS,
      CHIP_RADIUS,
      CHIP_THICKNESS,
      16,
    );
    const transparent = variant === 'dimmed';
    const out = {} as Record<DenomName, THREE.InstancedMesh>;
    for (const denom of DENOMINATIONS) {
      const material = new THREE.MeshStandardMaterial({
        color: denom.color,
        roughness: 0.6,
        metalness: 0.1,
        transparent,
        opacity: 1,
        depthWrite: !transparent,
      });
      material.name = `chip-material-${variant}-${denom.name}`;
      const mesh = new THREE.InstancedMesh(this.geometry, material, capacity);
      mesh.name = `chip-mesh-${variant}-${denom.name}`;
      mesh.count = 0;
      mesh.userData.denomName = denom.name;
      mesh.userData.capacity = capacity;
      mesh.userData.variant = variant;
      out[denom.name] = mesh;
    }
    this.meshes = out;
  }

  /**
   * Set the shared material opacity for every denomination in this pool.
   * Only meaningful for the `'dimmed'` variant — the opaque pool pins
   * opacity at 1 and ignores calls.
   */
  setOpacity(opacity: number): void {
    if (this.variant !== 'dimmed') return;
    for (const denom of DENOMINATIONS) {
      const mat = this.meshes[denom.name].material as THREE.MeshStandardMaterial;
      if (mat.opacity !== opacity) {
        mat.opacity = opacity;
        mat.needsUpdate = true;
      }
    }
  }

  getMesh(name: DenomName): THREE.InstancedMesh {
    return this.meshes[name];
  }

  getAllMeshes(): Record<DenomName, THREE.InstancedMesh> {
    return this.meshes;
  }

  writeMatrix(name: DenomName, slot: number, matrix: THREE.Matrix4): void {
    this.meshes[name].setMatrixAt(slot, matrix);
  }

  setCount(name: DenomName, count: number): void {
    const mesh = this.meshes[name];
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const denom of DENOMINATIONS) {
      const mesh = this.meshes[denom.name];
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.geometry.dispose();
  }
}

export interface ChipInstancesProps {
  /** Maximum instance count per denomination InstancedMesh. */
  capacity?: number;
  children?: ReactNode;
}

/**
 * Scene-level container that owns one `InstancedMesh` per chip denomination
 * (White / Red / Green / Black). Child `<ChipStack>` components register
 * their `{ amount, position }` and this container is responsible for:
 *
 *   1. Decomposing each stack's dollar amount into per-denom chip counts.
 *   2. Writing an `InstancedMesh.setMatrixAt()` for every chip.
 *   3. Updating `InstancedMesh.count` to reflect the total live chips.
 *
 * The 4 `InstancedMesh` objects are created once and reused across all
 * prop changes — amount/position updates only rewrite matrices, they never
 * recreate the meshes. Draw-call count is therefore fixed at 4 regardless
 * of the number of `<ChipStack>` instances.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function ChipInstances({
  capacity = DEFAULT_CAPACITY,
  children,
}: ChipInstancesProps) {
  // One ChipMeshPool per <ChipInstances> mount. `useState` with a lazy
  // initializer ensures a single instance for the lifetime of the
  // component; capacity changes after mount are intentionally ignored
  // (not supported in this task).
  const [pool] = useState(() => new ChipMeshPool(capacity, 'opaque'));
  const [dimmedPool] = useState(
    () => new ChipMeshPool(capacity, 'dimmed'),
  );

  // Dispose GPU resources on unmount.
  useLayoutEffect(() => {
    return () => {
      pool.dispose();
      dimmedPool.dispose();
    };
  }, [pool, dimmedPool]);

  // Expose the meshes to the test probe.
  useLayoutEffect(() => {
    _latestMeshes = pool.getAllMeshes();
    _latestDimmedMeshes = dimmedPool.getAllMeshes();
  }, [pool, dimmedPool]);

  // The live registry of stacks.
  const stacksRef = useRef<Map<string, StackRef>>(new Map());

  // Expose the registry to the test probe so integration tests can read
  // per-stack amount/position without decoding InstancedMesh matrices.
  useLayoutEffect(() => {
    const stacks = stacksRef.current;
    _latestStacks = stacks;
    return () => {
      if (_latestStacks === stacks) _latestStacks = null;
    };
  }, []);

  const flush = useMemo(() => {
    const scratch = new THREE.Matrix4();
    const scratchPos = new THREE.Vector3();
    const scratchQuat = new THREE.Quaternion();
    const scratchScale = new THREE.Vector3(1, 1, 1);
    const emptyCursor = (): Record<DenomName, number> => ({
      White: 0,
      Red: 0,
      Green: 0,
      Black: 0,
    });
    return () => {
      const opaqueCursors = emptyCursor();
      const dimmedCursors = emptyCursor();
      // The dimmed pool shares a single material per denomination, so
      // its opacity is a scalar. When multiple dimmed stacks are live we
      // take the minimum (most-dimmed wins) — today every caller passes
      // the same `FOLDED_CHIP_STACK_OPACITY`, so this is effectively a
      // constant; the `min` is defence-in-depth for future callers that
      // might dim at different levels.
      let dimmedMaterialOpacity = 1;
      let anyDimmed = false;
      for (const stack of stacksRef.current.values()) {
        const isDim = stack.opacity < 1;
        const targetPool = isDim ? dimmedPool : pool;
        const cursors = isDim ? dimmedCursors : opaqueCursors;
        if (isDim) {
          anyDimmed = true;
          if (stack.opacity < dimmedMaterialOpacity) {
            dimmedMaterialOpacity = stack.opacity;
          }
        }
        const counts = chipCountsFor(stack.amount, stack.cap);
        // Stack order (bottom → top): Black, Green, Red, White — largest
        // denominations at the base, matching real-world poker etiquette.
        let yIndex = 0;
        for (let i = DENOMINATIONS.length - 1; i >= 0; i--) {
          const denom = DENOMINATIONS[i];
          const n = counts[denom.name];
          for (let k = 0; k < n; k++) {
            const slot = cursors[denom.name];
            if (slot >= targetPool.capacity) {
              // Budget exhausted — drop the remaining chips silently.
              yIndex++;
              continue;
            }
            const x = stack.position[0];
            const y =
              stack.position[1] +
              CHIP_BASE_Y +
              yIndex * CHIP_STEP +
              CHIP_THICKNESS / 2;
            const z = stack.position[2];
            scratchPos.set(x, y, z);
            scratch.compose(scratchPos, scratchQuat, scratchScale);
            targetPool.writeMatrix(denom.name, slot, scratch);
            cursors[denom.name] = slot + 1;
            yIndex++;
          }
        }
      }
      for (const denom of DENOMINATIONS) {
        pool.setCount(denom.name, opaqueCursors[denom.name]);
        dimmedPool.setCount(denom.name, dimmedCursors[denom.name]);
      }
      // Only push a non-trivial opacity to the dimmed pool when at
      // least one dimmed stack is live; otherwise leave material state
      // alone (count=0 means nothing draws regardless).
      if (anyDimmed) {
        dimmedPool.setOpacity(dimmedMaterialOpacity);
      }
    };
  }, [pool, dimmedPool]);

  const registry = useMemo<Registry>(
    () => ({
      register(stackId, ref) {
        stacksRef.current.set(stackId, ref);
        flush();
      },
      update(stackId, ref) {
        stacksRef.current.set(stackId, ref);
        flush();
      },
      unregister(stackId) {
        stacksRef.current.delete(stackId);
        flush();
      },
    }),
    [flush],
  );

  return (
    <ChipInstancesContext.Provider value={registry}>
      <group name="chip-instances">
        {DENOMINATIONS.map((denom) => (
          <primitive
            key={denom.name}
            object={pool.getMesh(denom.name)}
            name={`chip-mesh-${denom.name}`}
          />
        ))}
        {DENOMINATIONS.map((denom) => (
          <primitive
            key={`dimmed-${denom.name}`}
            object={dimmedPool.getMesh(denom.name)}
            name={`chip-mesh-dimmed-${denom.name}`}
          />
        ))}
        {children}
      </group>
    </ChipInstancesContext.Provider>
  );
}
/* eslint-enable react/no-unknown-property */

export default ChipInstances;
