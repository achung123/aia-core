import * as THREE from 'three';

/**
 * Procedural PBR textures for the <Table> felt + rail (T-014).
 *
 * The whole point of T-014 AC-3 ("total added asset weight ≤ 500KB gzipped")
 * is that visual fidelity must not balloon the bundle. Rather than shipping
 * PNG/JPEG normal and roughness maps, we build small tiling DataTextures at
 * runtime from a deterministic hash — zero bytes shipped over the wire.
 *
 * Textures are built once on first access and cached at module scope. The
 * `__reset...ForTest` hook below disposes and clears the cache so unit
 * tests can verify lazy construction and avoid leaking GPU resources.
 */

const TEX_SIZE = 64;

type TableTextures = {
  /** Fine-grained cloth normal perturbation for the felt surface. */
  feltNormalMap: THREE.DataTexture;
  /** Slight roughness variance for the felt surface (breaks flat look). */
  feltRoughnessMap: THREE.DataTexture;
  /** Coarser leather-like normal perturbation for the rail. */
  railNormalMap: THREE.DataTexture;
};

let cached: TableTextures | null = null;

// Deterministic 2D hash — no Math.random so textures are byte-identical
// between reloads and across tabs (helps both debugging and caching).
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function buildNormalMap(size: number, amplitude: number, freq: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (hash2(x * freq, y * freq) - 0.5) * amplitude;
      const ny = (hash2(x * freq + 17, y * freq + 31) - 0.5) * amplitude;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      const i = (y * size + x) * 4;
      data[i + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function buildRoughnessMap(size: number, center: number, variance: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const r = center + (hash2(i, i * 3 + 7) - 0.5) * variance;
    const v = Math.max(0, Math.min(255, Math.round(r * 255)));
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lazily build and cache the procedural felt + rail textures. Safe to call
 * repeatedly; subsequent calls return the same texture instances so the
 * renderer can reuse uploaded GPU handles.
 */
export function getTableMaterialTextures(): TableTextures {
  if (!cached) {
    const felt = buildNormalMap(TEX_SIZE, 0.15, 1);
    felt.repeat.set(8, 8);
    const feltRoughness = buildRoughnessMap(TEX_SIZE, 0.9, 0.08);
    feltRoughness.repeat.set(8, 8);
    const rail = buildNormalMap(TEX_SIZE, 0.35, 0.3);
    rail.repeat.set(2, 2);
    cached = {
      feltNormalMap: felt,
      feltRoughnessMap: feltRoughness,
      railNormalMap: rail,
    };
  }
  return cached;
}

/** @internal — test hook; disposes GPU resources and clears the cache. */
export function __resetTableMaterialTexturesForTest(): void {
  if (cached) {
    cached.feltNormalMap.dispose();
    cached.feltRoughnessMap.dispose();
    cached.railNormalMap.dispose();
    cached = null;
  }
}
