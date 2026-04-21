/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  getTableMaterialTextures,
  __resetTableMaterialTexturesForTest,
} from '../../src/scenes3d/components/tableMaterials';

afterEach(() => {
  __resetTableMaterialTexturesForTest();
});

describe('getTableMaterialTextures (T-014)', () => {
  it('returns DataTexture instances for felt normal, felt roughness, and rail normal', () => {
    const { feltNormalMap, feltRoughnessMap, railNormalMap } = getTableMaterialTextures();
    expect(feltNormalMap).toBeInstanceOf(THREE.DataTexture);
    expect(feltRoughnessMap).toBeInstanceOf(THREE.DataTexture);
    expect(railNormalMap).toBeInstanceOf(THREE.DataTexture);
  });

  it('configures tiling wrap + repeat on every texture', () => {
    const { feltNormalMap, feltRoughnessMap, railNormalMap } = getTableMaterialTextures();
    for (const t of [feltNormalMap, feltRoughnessMap, railNormalMap]) {
      expect(t.wrapS).toBe(THREE.RepeatWrapping);
      expect(t.wrapT).toBe(THREE.RepeatWrapping);
    }
    // Felt tiles denser than the rail (finer cloth weave).
    expect(feltNormalMap.repeat.x).toBeGreaterThan(railNormalMap.repeat.x);
    expect(feltRoughnessMap.repeat.x).toBeGreaterThan(railNormalMap.repeat.x);
  });

  it('caches — repeated calls return the same instances', () => {
    const a = getTableMaterialTextures();
    const b = getTableMaterialTextures();
    expect(a.feltNormalMap).toBe(b.feltNormalMap);
    expect(a.feltRoughnessMap).toBe(b.feltRoughnessMap);
    expect(a.railNormalMap).toBe(b.railNormalMap);
  });

  it('rebuilds after __resetTableMaterialTexturesForTest()', () => {
    const a = getTableMaterialTextures();
    __resetTableMaterialTexturesForTest();
    const b = getTableMaterialTextures();
    expect(a.feltNormalMap).not.toBe(b.feltNormalMap);
  });

  it('writes non-empty pixel data (deterministic, no Math.random)', () => {
    const { feltNormalMap } = getTableMaterialTextures();
    const img = feltNormalMap.image as { data: Uint8Array; width: number; height: number };
    expect(img.width).toBeGreaterThan(0);
    expect(img.height).toBeGreaterThan(0);
    // Not all-zero, not all-255.
    let min = 255;
    let max = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] < min) min = img.data[i];
      if (img.data[i] > max) max = img.data[i];
    }
    expect(max).toBeGreaterThan(min);
  });
});
