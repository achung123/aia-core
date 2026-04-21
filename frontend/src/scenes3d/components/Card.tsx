import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  computePlaneUVsForAtlas,
  getTexture,
  resolveCardUV,
  BACK_KEY,
  getUVById,
} from './CardAtlas';
import type { QualityTier } from '../types';

// ---------------------------------------------------------------------------
// Shared material
//
// Per acceptance criterion 3 (T-006), every `<Card>` on the table must share
// a single material reference. We achieve that by baking per-card UVs into
// the plane geometry (see `computePlaneUVsForAtlas`) so the material's
// `map.offset` / `map.repeat` never have to vary per card.
// ---------------------------------------------------------------------------

const materialCache = new Map<QualityTier, THREE.MeshStandardMaterial>();

export function getSharedCardMaterial(
  tier: QualityTier = 'medium',
): THREE.MeshStandardMaterial {
  const cached = materialCache.get(tier);
  if (cached) return cached;
  const mat = new THREE.MeshStandardMaterial({
    map: getTexture(tier),
    roughness: 0.65,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  mat.name = `card-material-${tier}`;
  materialCache.set(tier, mat);
  return mat;
}

export function clearCardMaterialCache(): void {
  for (const mat of materialCache.values()) mat.dispose();
  materialCache.clear();
}

// ---------------------------------------------------------------------------
// <Card>
// ---------------------------------------------------------------------------

export interface CardProps {
  /**
   * Canonical card id (e.g. `'Ah'`, `'10d'`, `'back'`). When `null`,
   * `undefined`, empty, or unresolvable, the back cell is rendered —
   * never throws.
   */
  id?: string | null;
  /** Whether the card is face-up. Defaults to true. */
  faceUp?: boolean;
  /** Quality tier (selects which atlas texture is used). Defaults to 'medium'. */
  tier?: QualityTier;
  /** World position of the card center. */
  position?: [number, number, number];
  /** World rotation (Euler, radians). Defaults to lying flat on the table. */
  rotation?: [number, number, number];
  /** Plane size in world units, `[width, height]`. Defaults to standard poker proportions. */
  size?: [number, number];
}

// Standard playing-card proportions: 63mm × 88mm ≈ 0.72:1. Sized to
// approximately match the legacy scene's hole cards.
const DEFAULT_SIZE: [number, number] = [0.42, 0.58];
// Lying flat on the felt: face-up means the textured side points to +Y.
const DEFAULT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const DEFAULT_POSITION: [number, number, number] = [0, 0, 0];

/**
 * Resolve an id → the atlas-canonical id string we'll stamp onto the mesh
 * for debug/inspection. Returns `'back'` for null / unknown / faceDown.
 */
function resolveCanonicalId(id: string | null | undefined, faceUp: boolean): string {
  if (!faceUp) return BACK_KEY;
  if (!id) return BACK_KEY;
  return getUVById(id) ? id : BACK_KEY;
}

/**
 * A single playing card rendered as a textured plane. All cards at a given
 * quality tier share one `MeshStandardMaterial`; per-card UVs are baked onto
 * the plane's uv attribute so the shared material's `map.offset/repeat` is
 * never touched.
 *
 * Props changes (id / faceUp / tier) update the uv attribute in place
 * without recreating the geometry or material (per acceptance criterion 4).
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function Card({
  id = null,
  faceUp = true,
  tier = 'medium',
  position = DEFAULT_POSITION,
  rotation = DEFAULT_ROTATION,
  size = DEFAULT_SIZE,
}: CardProps) {
  const [w, h] = size;
  const material = getSharedCardMaterial(tier);
  const canonicalId = resolveCanonicalId(id, faceUp);

  // One plane geometry per card instance. Re-created only when physical
  // size changes — id / faceUp / tier updates mutate the uv attribute in
  // place via the layout effect below.
  const geometry = useMemo(() => new THREE.PlaneGeometry(w, h, 1, 1), [w, h]);
  const geometryRef = useRef(geometry);

  useLayoutEffect(() => {
    geometryRef.current = geometry;
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Bake the atlas UVs for the resolved card onto the geometry's uv
  // attribute, flip-corrected for the texture's flipY setting. Runs on
  // every prop change without recreating anything.
  useLayoutEffect(() => {
    const uv = resolveCardUV(id, faceUp);
    const tex = getTexture(tier);
    const uvs = computePlaneUVsForAtlas(uv, tex.flipY);
    const attr = geometry.getAttribute('uv') as THREE.BufferAttribute;
    attr.array.set(uvs);
    attr.needsUpdate = true;
  }, [id, faceUp, tier, geometry]);

  return (
    <mesh
      name="card"
      position={position}
      rotation={rotation}
      geometry={geometry}
      material={material}
      data-card-id={canonicalId}
      data-face-up={String(faceUp)}
      data-testid={faceUp ? 'card-face-up' : 'card-face-down'}
      userData={{ cardId: canonicalId, faceUp, tier }}
      castShadow
      receiveShadow
    />
  );
}
/* eslint-enable react/no-unknown-property */

export default Card;
