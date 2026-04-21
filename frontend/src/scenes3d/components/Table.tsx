import {
  TABLE_RADIUS_X,
  TABLE_RADIUS_Z,
  TABLE_THICKNESS,
  TABLE_RAIL_WIDTH,
  TABLE_TOP_Y,
} from './tableLayout';
import { getTableMaterialTextures } from './tableMaterials';
import type { QualityTier } from '../types';
import { QUALITY_TIER_SETTINGS } from '../state/qualitySettings';

export interface TableProps {
  /** Felt color (CSS color or hex). Defaults to the poker-green used in the legacy scene. */
  feltColor?: string;
  /** Rail (rim) color. Defaults to a deep wood tone. */
  railColor?: string;
  /**
   * Quality tier controls whether normal/roughness maps are attached to the
   * PBR materials. On the Low tier we drop the texture maps and the normal
   * scale falls to zero so the renderer can skip sampling — keeps the cheap
   * end cheap. Env map and shadow toggles live on the parent `<PokerTable>`
   * (T-014 AC-4). Defaults to `'medium'`.
   */
  qualityTier?: QualityTier;
}

/**
 * Declarative R3F replacement for the felt + rail geometry from
 * the imperative `addPokerTable` helper (removed in T-033).
 *
 * Renders two meshes:
 *   1. A flat elliptical felt disc (inner playing surface) — fine-grained
 *      PBR cloth: high roughness, zero metalness, subtle tiling normal +
 *      roughness maps so it responds to the scene's key light.
 *   2. A thin outer ring ("rail") sitting flush around the felt — visually
 *      distinct PBR leather/wood: lower roughness, slight metalness, coarser
 *      normal map for highlight break-up.
 *
 * T-014 AC mapping:
 *   - AC-1 (felt has normal + roughness map, responds to light direction) →
 *     `<meshStandardMaterial name="felt-pbr" normalMap roughnessMap />`.
 *   - AC-2 (rail visually distinct) → separate material with lower roughness,
 *     higher metalness, different normal map, and different tint.
 *   - AC-3 (≤ 500 KB gz added assets) → textures are procedural DataTextures
 *     built at runtime; zero bytes shipped.
 *   - AC-4 (Medium tier: shadows + env map gated) → enforced on `<PokerTable>`.
 */
/* eslint-disable react/no-unknown-property -- R3F JSX intrinsics */
export function Table({
  feltColor = '#1a7a1a',
  railColor = '#3b2414',
  qualityTier = 'medium',
}: TableProps = {}) {
  const { feltNormalMap, feltRoughnessMap, railNormalMap } =
    getTableMaterialTextures();
  const railHeight = TABLE_THICKNESS * 1.2;
  const feltCenterY = TABLE_TOP_Y - TABLE_THICKNESS / 2;
  const railCenterY = TABLE_TOP_Y - railHeight / 2;

  // T-038 Item-2 (Cycle 39 L-2): drop the inline `qualityTier !== 'low'`
  // literal; read the canonical PBR mode from QUALITY_TIER_SETTINGS instead.
  // Low tier uses 'lambert' → strip map sampling. Medium ('pbr-no-env') and
  // High ('pbr-env') keep the maps.
  const mapsEnabled = QUALITY_TIER_SETTINGS[qualityTier].pbr !== 'lambert';
  const feltNormalScale = mapsEnabled ? 1 : 0;
  const railNormalScaleValue = mapsEnabled ? 0.6 : 0;

  return (
    <group name="table">
      <mesh
        name="table-rail"
        position={[0, railCenterY, 0]}
        scale={[TABLE_RADIUS_X + TABLE_RAIL_WIDTH, 1, TABLE_RADIUS_Z + TABLE_RAIL_WIDTH]}
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, railHeight, 64]} />
        <meshStandardMaterial
          name="rail-pbr"
          color={railColor}
          roughness={0.55}
          metalness={0.1}
          normalMap={mapsEnabled ? railNormalMap : null}
          normalScale={[railNormalScaleValue, railNormalScaleValue]}
        />
      </mesh>
      <mesh
        name="table-felt"
        position={[0, feltCenterY, 0]}
        scale={[TABLE_RADIUS_X, 1, TABLE_RADIUS_Z]}
        receiveShadow
      >
        <cylinderGeometry args={[1, 1, TABLE_THICKNESS, 64]} />
        <meshStandardMaterial
          name="felt-pbr"
          color={feltColor}
          roughness={0.92}
          metalness={0.0}
          normalMap={mapsEnabled ? feltNormalMap : null}
          roughnessMap={mapsEnabled ? feltRoughnessMap : null}
          normalScale={[feltNormalScale, feltNormalScale]}
        />
      </mesh>
    </group>
  );
}
/* eslint-enable react/no-unknown-property */

export default Table;
