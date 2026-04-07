import * as THREE from 'three';
import { createCard } from './cards.js';

// Card layout per seat: 2 cards, slightly offset from each other
const CARD_OFFSET_X = 0.22;   // left/right spread
const CARD_OFFSET_Y = 0.02;   // above table
const CARD_OFFSET_Z = 0.15;   // toward viewer from seat position

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

  function disposeCards(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    for (const card of data.cards) {
      scene.remove(card);
      card.geometry.dispose();
      if (Array.isArray(card.material)) {
        card.material.forEach(m => m.dispose());
      } else {
        card.material.dispose();
      }
    }
    data.cards = [];
  }

  function removeSprite(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data || !data.sprite) return;
    scene.remove(data.sprite);
    data.sprite.material.dispose();
    data.sprite = null;
  }

  function placeCards(seatIndex, rank0, suit0, rank1, suit1, faceUp) {
    const seatPos = seatPositions[seatIndex];
    const card0 = createCard(rank0, suit0, faceUp);
    const card1 = createCard(rank1, suit1, faceUp);

    card0.position.set(
      seatPos.x - CARD_OFFSET_X,
      CARD_OFFSET_Y,
      seatPos.z + CARD_OFFSET_Z
    );
    card1.position.set(
      seatPos.x + CARD_OFFSET_X,
      CARD_OFFSET_Y,
      seatPos.z + CARD_OFFSET_Z
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
      for (const mat of card.material) {
        mat.opacity = 0.5;
        mat.transparent = true;
      }
    }
  }

  function glowWinnerCards(seatIndex) {
    const data = seatData.get(seatIndex);
    if (!data) return;
    for (const card of data.cards) {
      // Front face is material index 4 (post-flip it holds faceMat)
      const frontMat = card.material[4];
      frontMat.emissive = new THREE.Color(0xffd700);
      frontMat.emissiveIntensity = 0.4;
    }
  }

  function addFoldSprite(seatIndex) {
    const seatPos = seatPositions[seatIndex];
    const sprite = createFoldSprite();
    sprite.position.set(seatPos.x, seatPos.y + 0.6, seatPos.z);
    scene.add(sprite);
    const data = seatData.get(seatIndex);
    data.sprite = sprite;
  }

  return {
    /**
     * Set up hole card state for a new hand.
     * @param {object} handData - has .player_hands: [{player_name, hole_cards: [{rank,suit},{rank,suit}]|null, result: 'win'|'loss'|'fold'}]
     * @param {object} seatPlayerMap - { seatIndex: playerName }
     */
    initHand(handData, seatPlayerMap) {
      // Clean up any previous state
      for (const [seatIndex] of seatData) {
        disposeCards(seatIndex);
        removeSprite(seatIndex);
      }
      seatData.clear();

      // Build seat entries from seatPlayerMap
      for (const [seatIdx, playerName] of Object.entries(seatPlayerMap)) {
        const idx = parseInt(seatIdx, 10);
        const playerHand = handData.player_hands.find(ph => ph.player_name === playerName) || null;
        seatData.set(idx, { cards: [], sprite: null, playerHand });
      }

      // AC1: Two face-down cards at each active seat (Pre-Flop display)
      for (const [seatIndex] of seatData) {
        placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
      }
    },

    /**
     * AC2-4: Reveal cards at showdown. Flip all, dim folds, glow winner.
     */
    goToShowdown() {
      for (const [seatIndex, data] of seatData) {
        const playerHand = data.playerHand;

        if (playerHand && playerHand.hole_cards) {
          // Replace placeholder with real cards (face-down), then flip to reveal
          disposeCards(seatIndex);
          const [c0, c1] = playerHand.hole_cards;
          placeCards(seatIndex, c0.rank, c0.suit, c1.rank, c1.suit, false);
          for (const card of data.cards) {
            card.flip();
          }
        }
        // AC5: null hole_cards — leave face-down placeholder cards as-is

        // AC3: Fold dimming + FOLD sprite
        if (playerHand && playerHand.result === 'fold') {
          dimCards(seatIndex);
          addFoldSprite(seatIndex);
        }

        // AC4: Winner glow — apply after flip animation completes (300ms)
        if (playerHand && playerHand.result === 'win') {
          const capturedIdx = seatIndex;
          setTimeout(() => glowWinnerCards(capturedIdx), 350);
        }
      }
    },

    /**
     * Scrub back to Pre-Flop: restore face-down placeholder cards.
     */
    goToPreFlop() {
      for (const [seatIndex, data] of seatData) {
        removeSprite(seatIndex);
        disposeCards(seatIndex);
        placeCards(seatIndex, 'A', 'S', 'A', 'S', false);
      }
    },

    dispose() {
      for (const [seatIndex] of seatData) {
        disposeCards(seatIndex);
        removeSprite(seatIndex);
      }
      seatData.clear();
    },
  };
}
