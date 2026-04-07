import * as THREE from 'three';

const DISC_COUNT = 5;
const DISC_RADIUS = 0.18;
const DISC_THICKNESS = 0.04;
const BASE_GAP = 0.005;
const MAX_STACK_HEIGHT = 0.6;
const NEUTRAL_HEIGHT = 0.3;
const ANIM_DURATION = 400;

const COLOR_NORMAL = 0xf5e6b2;
const COLOR_NEGATIVE = 0xc44e4e;
const COLOR_NEUTRAL = 0x999999;

// Natural height of a stack (DISC_COUNT discs + gaps, unscaled)
const NATURAL_HEIGHT = DISC_COUNT * (DISC_THICKNESS + BASE_GAP) - BASE_GAP;

export function createChipStack(scene, position) {
  const group = new THREE.Group();
  const materials = [];

  const discGeom = new THREE.CylinderGeometry(DISC_RADIUS, DISC_RADIUS, DISC_THICKNESS, 16);

  for (let i = 0; i < DISC_COUNT; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: COLOR_NEUTRAL });
    materials.push(mat);
    const disc = new THREE.Mesh(discGeom, mat);
    disc.position.y = i * (DISC_THICKNESS + BASE_GAP) + DISC_THICKNESS / 2;
    group.add(disc);
  }

  group.position.set(position.x, position.y + 0.05, position.z);
  group.scale.y = NEUTRAL_HEIGHT / NATURAL_HEIGHT;
  scene.add(group);

  let animId = null;

  function setHeight(targetHeight, color, duration = ANIM_DURATION) {
    const col = new THREE.Color(color);
    materials.forEach((m) => m.color.set(col));

    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    const startScaleY = group.scale.y;
    const targetScaleY = targetHeight / NATURAL_HEIGHT;
    const startTime = performance.now();

    function animate(now) {
      const t = Math.min((now - startTime) / duration, 1);
      group.scale.y = startScaleY + (targetScaleY - startScaleY) * t;
      if (t < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        animId = null;
      }
    }

    animId = requestAnimationFrame(animate);
  }

  function dispose() {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    discGeom.dispose();
    materials.forEach((m) => m.dispose());
    scene.remove(group);
  }

  return { group, setHeight, dispose };
}

export function createChipStacks(scene, seatPositions, seatPlayerMap = {}) {
  const stacks = seatPositions.map((pos) => createChipStack(scene, pos));
  let _seatPlayerMap = { ...seatPlayerMap };

  function updateChipStacks(playerPLMap, newSeatPlayerMap) {
    if (newSeatPlayerMap) {
      _seatPlayerMap = { ...newSeatPlayerMap };
    }

    // Normalize playerPLMap to a plain object
    const plObj = {};
    if (playerPLMap instanceof Map) {
      playerPLMap.forEach((v, k) => {
        plObj[k] = v;
      });
    } else {
      Object.assign(plObj, playerPLMap);
    }

    // Find max positive P/L and max absolute negative P/L for scaling
    let maxPL = 0;
    let maxLoss = 0;
    Object.values(plObj).forEach((v) => {
      if (v !== null && v !== undefined) {
        if (v > maxPL) maxPL = v;
        if (v < 0 && Math.abs(v) > maxLoss) maxLoss = Math.abs(v);
      }
    });

    stacks.forEach((stack, seatIndex) => {
      const playerName = _seatPlayerMap[seatIndex];

      if (!playerName) {
        // Inactive seat — show neutral stack
        stack.setHeight(NEUTRAL_HEIGHT, COLOR_NEUTRAL);
        return;
      }

      const pl = plObj[playerName];

      if (pl === null || pl === undefined) {
        // No P/L data — neutral half-height stack
        stack.setHeight(NEUTRAL_HEIGHT, COLOR_NEUTRAL);
      } else if (pl < 0) {
        // Negative P/L — smaller red-tinted stack
        // Scale from NEUTRAL_HEIGHT (at 0 loss) down to NEUTRAL_HEIGHT * 0.3 (at maxLoss)
        const ratio = maxLoss > 0 ? Math.abs(pl) / maxLoss : 1;
        const height = Math.max(NEUTRAL_HEIGHT * (1 - ratio * 0.7), 0.05);
        stack.setHeight(height, COLOR_NEGATIVE);
      } else {
        // Non-negative P/L — scale from NEUTRAL_HEIGHT (at 0) to MAX_STACK_HEIGHT (at maxPL)
        const ratio = maxPL > 0 ? pl / maxPL : 0;
        const height = NEUTRAL_HEIGHT + (MAX_STACK_HEIGHT - NEUTRAL_HEIGHT) * ratio;
        stack.setHeight(height, COLOR_NORMAL);
      }
    });
  }

  function dispose() {
    stacks.forEach((s) => s.dispose());
  }

  return { updateChipStacks, dispose };
}
