import * as THREE from 'three';
import { createCard } from './cards.ts';

const CARD_SPACING = 0.52;
const START_OFFSET = -2 * CARD_SPACING; // leftmost card x offset from center
const OFF_TABLE_Z = 5;
const ANIM_DURATION = 500; // ms

export interface CardData {
  rank: string;
  suit: string;
}

export interface CommunityHandData {
  flop: CardData[] | null;
  turn: CardData | null;
  river: CardData | null;
}

export interface CommunityCards {
  goToStreet: (streetIndex: number) => void;
  dispose: () => void;
}

function cardPosition(slotIndex: number): THREE.Vector3 {
  return new THREE.Vector3(
    START_OFFSET + slotIndex * CARD_SPACING,
    0.01,
    0,
  );
}

function animateCard(
  mesh: THREE.Mesh,
  targetPos: THREE.Vector3,
  duration: number,
  onComplete: (() => void) | null,
): () => void {
  let cancelled = false;
  const startPos = mesh.position.clone();
  const startTime = performance.now();

  function step(now: number): void {
    if (cancelled) return;
    const t = Math.min((now - startTime) / duration, 1);
    mesh.position.lerpVectors(startPos, targetPos, t);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  }
  requestAnimationFrame(step);
  return () => { cancelled = true; };
}

function disposeMesh(mesh: THREE.Mesh): void {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m: THREE.Material) => {
      if ('map' in m && (m as THREE.MeshLambertMaterial).map) {
        (m as THREE.MeshLambertMaterial).map!.dispose();
      }
      m.dispose();
    });
  } else {
    const mat = mesh.material as THREE.MeshLambertMaterial;
    if (mat.map) mat.map.dispose();
    mat.dispose();
  }
}

export function createCommunityCards(scene: THREE.Scene, handData: CommunityHandData): CommunityCards {
  const cards: (THREE.Mesh | null)[] = [null, null, null, null, null];
  const visibleSlots = new Set<number>();
  const inflightRemovals = new Set<THREE.Mesh>();
  const cancelHandles: Record<number, (() => void) | null> = {};

  function slotCardData(slotIndex: number): CardData | null {
    if (slotIndex <= 2) {
      return handData.flop ? handData.flop[slotIndex] : null;
    }
    if (slotIndex === 3) {
      return handData.turn || null;
    }
    return handData.river || null;
  }

  function slotsForStreet(streetIndex: number): Set<number> {
    if (streetIndex <= 0) return new Set();
    if (streetIndex === 1) return new Set([0, 1, 2]);
    if (streetIndex === 2) return new Set([0, 1, 2, 3]);
    return new Set([0, 1, 2, 3, 4]); // River and Showdown
  }

  function addCard(slotIndex: number): void {
    if (cancelHandles[slotIndex]) { cancelHandles[slotIndex]!(); cancelHandles[slotIndex] = null; }
    const data = slotCardData(slotIndex);
    if (!data) return;

    const mesh = createCard(data.rank, data.suit, true);
    const target = cardPosition(slotIndex);
    mesh.position.set(target.x, target.y, OFF_TABLE_Z);
    scene.add(mesh);
    cards[slotIndex] = mesh;
    visibleSlots.add(slotIndex);
    cancelHandles[slotIndex] = animateCard(mesh, target, ANIM_DURATION, null);
  }

  function removeCard(slotIndex: number): void {
    const mesh = cards[slotIndex];
    if (!mesh) return;

    // Mark as gone immediately so rapid goToStreet calls stay consistent
    cards[slotIndex] = null;
    visibleSlots.delete(slotIndex);

    if (cancelHandles[slotIndex]) { cancelHandles[slotIndex]!(); cancelHandles[slotIndex] = null; }
    inflightRemovals.add(mesh);

    const stagingPos = new THREE.Vector3(mesh.position.x, mesh.position.y, OFF_TABLE_Z);
    cancelHandles[slotIndex] = animateCard(mesh, stagingPos, ANIM_DURATION, () => {
      inflightRemovals.delete(mesh);
      scene.remove(mesh);
      disposeMesh(mesh);
    });
  }

  function goToStreet(streetIndex: number): void {
    const targetSlots = slotsForStreet(streetIndex);

    for (let i = 0; i < 5; i++) {
      const shouldBeVisible = targetSlots.has(i);
      const isVisible = visibleSlots.has(i);

      if (shouldBeVisible && !isVisible) {
        addCard(i);
      } else if (!shouldBeVisible && isVisible) {
        removeCard(i);
      }
    }
  }

  function dispose(): void {
    Object.keys(cancelHandles).forEach(k => { const handle = cancelHandles[Number(k)]; if (handle) handle(); });
    for (let i = 0; i < 5; i++) {
      const mesh = cards[i];
      if (mesh) {
        scene.remove(mesh);
        disposeMesh(mesh);
        cards[i] = null;
      }
    }
    inflightRemovals.forEach(mesh => {
      scene.remove(mesh);
      disposeMesh(mesh);
    });
    inflightRemovals.clear();
    visibleSlots.clear();
  }

  return { goToStreet, dispose };
}
