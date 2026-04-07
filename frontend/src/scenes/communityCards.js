import { createCard } from './cards.js';

const CARD_SPACING = 0.85;
const START_OFFSET = -2 * CARD_SPACING; // leftmost card x offset from center
const OFF_TABLE_Z = 5;
const ANIM_DURATION = 500; // ms

function cardPosition(slotIndex) {
  return {
    x: START_OFFSET + slotIndex * CARD_SPACING,
    y: 0.02,
    z: 0,
  };
}

function animateCard(card, targetPos, duration, onComplete) {
  const startPos = {
    x: card.position.x,
    y: card.position.y,
    z: card.position.z,
  };
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    card.position.x = startPos.x + (targetPos.x - startPos.x) * t;
    card.position.y = startPos.y + (targetPos.y - startPos.y) * t;
    card.position.z = startPos.z + (targetPos.z - startPos.z) * t;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      if (onComplete) onComplete();
    }
  }
  requestAnimationFrame(step);
}

function disposeMesh(mesh) {
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
  } else {
    if (mesh.material.map) mesh.material.map.dispose();
    mesh.material.dispose();
  }
}

export function createCommunityCards(scene, handData) {
  // handData: { flop: [{rank, suit}, {rank, suit}, {rank, suit}] | null,
  //             turn: {rank, suit} | null,
  //             river: {rank, suit} | null }

  const cards = [null, null, null, null, null];
  const visibleSlots = new Set();

  function slotCardData(slotIndex) {
    if (slotIndex <= 2) {
      return handData.flop ? handData.flop[slotIndex] : null;
    }
    if (slotIndex === 3) {
      return handData.turn || null;
    }
    return handData.river || null;
  }

  function slotsForStreet(streetIndex) {
    if (streetIndex <= 0) return new Set();
    if (streetIndex === 1) return new Set([0, 1, 2]);
    if (streetIndex === 2) return new Set([0, 1, 2, 3]);
    return new Set([0, 1, 2, 3, 4]); // River and Showdown
  }

  function addCard(slotIndex) {
    const data = slotCardData(slotIndex);
    if (!data) return;

    const mesh = createCard(data.rank, data.suit, true);
    const target = cardPosition(slotIndex);
    mesh.position.set(target.x, target.y, OFF_TABLE_Z);
    scene.add(mesh);
    cards[slotIndex] = mesh;
    visibleSlots.add(slotIndex);
    animateCard(mesh, target, ANIM_DURATION, null);
  }

  function removeCard(slotIndex) {
    const mesh = cards[slotIndex];
    if (!mesh) return;

    // Mark as gone immediately so rapid goToStreet calls stay consistent
    cards[slotIndex] = null;
    visibleSlots.delete(slotIndex);

    const stagingPos = { x: mesh.position.x, y: mesh.position.y, z: OFF_TABLE_Z };
    animateCard(mesh, stagingPos, ANIM_DURATION, () => {
      scene.remove(mesh);
      disposeMesh(mesh);
    });
  }

  function goToStreet(streetIndex) {
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

  function dispose() {
    for (let i = 0; i < 5; i++) {
      const mesh = cards[i];
      if (mesh) {
        scene.remove(mesh);
        disposeMesh(mesh);
        cards[i] = null;
      }
    }
    visibleSlots.clear();
  }

  return { goToStreet, dispose };
}
