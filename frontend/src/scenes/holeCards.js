import * as THREE from 'three';
import { createCard } from './cards.js';

// Card layout per seat: 2 cards, slightly offset from each other
const CARD_OFFSET_X = 0.25;   // left/right spread
const CARD_OFFSET_Y = 0.01;   // above table surface
const CARD_OFFSET_Z = -0.30;  // inward toward table center from seat

function createFoldSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FOLD', 64, 16);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  // aspect ratio 128/32 = 4; scale width=0.5, height=0.125
  sprite.scale.set(0.5, 0.125, 1);
  return sprite;
}

export function createHoleCards(scene, seatPositions) {
  // Map<seatIndex, { cards: Mesh[], sprite: Sprite|null, playerHand: object|null }>
  const seatData = new Map();
  const winnerGlowTimers = new Set();

  function disposeCards(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    for (const card of data.cards) {
      card.cancelFlip();
      scene.remove(card);
      card.geometry.dispose();
      const mat = card.material;
      if (mat.map) mat.map.dispose();
      mat.dispose();
    }
    data.cards = [];
  }

  function removeSprite(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data || !data.sprite) return;
    scene.remove(data.sprite);
    if (data.sprite.material.map) data.sprite.material.map.dispose();
    data.sprite.material.dispose();
    data.sprite = null;
  }

  function placeCards(seatIndex, rank0, suit0, rank1, suit1, faceUp) {
    const seatPos = seatPositions[seatIndex];
    const card0 = createCard(rank0, suit0, faceUp);
    const card1 = createCard(rank1, suit1, faceUp);

    // Direction from seat toward table center (origin)
    const dirX = -seatPos.x;
    const dirZ = -seatPos.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    // Perpendicular for left/right spread
    const px = -nz;
    const pz = nx;

    const inwardDist = 0.45; // how far inward from seat toward center
    const baseX = seatPos.x + nx * inwardDist;
    const baseZ = seatPos.z + nz * inwardDist;

    card0.position.set(
      baseX - px * CARD_OFFSET_X,
      CARD_OFFSET_Y,
      baseZ - pz * CARD_OFFSET_X
    );
    card1.position.set(
      baseX + px * CARD_OFFSET_X,
      CARD_OFFSET_Y,
      baseZ + pz * CARD_OFFSET_X
    );

    scene.add(card0);
    scene.add(card1);

    const data = seatData.get(seatIndex);
    data.cards = [card0, card1];
  }

  function dimCards(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    for (const card of data.cards) {
      card.material.opacity = 0.5;
      card.material.transparent = true;
    }
  }

  function glowWinnerCards(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    for (const card of data.cards) {
      card.material.emissive = new THREE.Color(0xffd700);
      card.material.emissiveIntensity = 0.4;
    }
  }

  function addFoldSprite(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    const seatPos = seatPositions[seatIndex];
    const sprite = createFoldSprite();
    sprite.position.set(seatPos.x, 0.5, seatPos.z);
    scene.add(sprite);
    data.sprite = sprite;
  }

  return {
    /**
     * Set up hole card state for a new hand.
     * @param {object} handData - has .player_hands: [{player_name, hole_cards: [{rank,suit},{rank,suit}]|null, result: 'win'|'loss'|'fold'}]
     * @param {object} seatPlayerMap - { seatIndex: playerName }
     */
    initHand(handData, seatPlayerMap) {
      winnerGlowTimers.forEach(id => clearTimeout(id));
      winnerGlowTimers.clear();
      // Clean up any previous state
      for (const [seatIndex] of seatData) {
        disposeCards(seatIndex);
        removeSprite(seatIndex);
      }
      seatData.clear();

      // Build seat entries from seatPlayerMap
      for (const [seatIdx, playerName] of Object.entries(seatPlayerMap)) {
        const idx = parseInt(seatIdx, 10);
        const playerHand = (handData?.player_hands ?? []).find(ph => ph.player_name === playerName) || null;
        seatData.set(idx, { cards: [], sprite: null, playerHand });
      }

      // Place real hole cards face-up at each active seat
      for (const [seatIndex, data] of seatData) {
        const ph = data.playerHand;
        if (ph && ph.hole_cards) {
          const [c0, c1] = ph.hole_cards;
          placeCards(seatIndex, c0.rank, c0.suit, c1.rank, c1.suit, true);
        } else {
          // No hole card data — show face-down placeholders
          placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
        }
      }
    },

    goToShowdown() {
      for (const [seatIndex, data] of seatData) {
        const playerHand = data.playerHand;

        // AC3: Fold dimming + FOLD sprite
        if (playerHand && playerHand.result === 'fold') {
          dimCards(seatIndex);
          addFoldSprite(seatIndex);
          continue;
        }

        // AC2: Flip face-down cards face-up for non-folded players
        let didFlip = false;
        if (playerHand && playerHand.hole_cards && data.cards.length === 2) {
          const isFaceDown = data.cards[0].material instanceof THREE.MeshBasicMaterial;
          if (isFaceDown) {
            const [c0, c1] = playerHand.hole_cards;
            disposeCards(seatIndex);
            placeCards(seatIndex, c0.rank, c0.suit, c1.rank, c1.suit, false);
            data.cards[0].flip();
            data.cards[1].flip();
            didFlip = true;
          }
        }

        // AC4: Winner glow — delayed if cards were flipped
        if (playerHand && playerHand.result === 'win') {
          if (didFlip) {
            const timer = setTimeout(() => glowWinnerCards(seatIndex), 300);
            winnerGlowTimers.add(timer);
          } else {
            glowWinnerCards(seatIndex);
          }
        }
      }
    },

    /**
     * Scrub back to Pre-Flop: restore face-down placeholder cards.
     */
    goToPreFlop() {
      winnerGlowTimers.forEach(id => clearTimeout(id));
      winnerGlowTimers.clear();
      for (const [seatIndex, data] of seatData) {
        removeSprite(seatIndex);
        disposeCards(seatIndex);
        placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
      }
    },

    dispose() {
      winnerGlowTimers.forEach(id => clearTimeout(id));
      winnerGlowTimers.clear();
      for (const [seatIndex] of seatData) {
        disposeCards(seatIndex);
        removeSprite(seatIndex);
      }
      seatData.clear();
    },
  };
}
