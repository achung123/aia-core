import * as THREE from 'three';
import { addPokerTable, computeSeatPositions } from './tableGeometry.js';
import { createChipStacks } from './chipStacks.js';
import { createCommunityCards } from './communityCards.js';
import { createHoleCards } from './holeCards.js';

const DEFAULTS = {
  width: 800,
  height: 600,
  seatCount: 10,
  antialias: true,
};

/**
 * Create a reusable Three.js poker scene.
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.width=800]
 * @param {number} [options.height=600]
 * @param {number} [options.seatCount=10]
 * @param {boolean} [options.antialias=true]
 * @returns {{ scene, camera, renderer, seatPositions, chipStacks, holeCards, dispose, update }}
 */
export function createPokerScene(canvas, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias });
  renderer.setPixelRatio(window.devicePixelRatio);
  const w = canvas.clientWidth || canvas.parentElement?.clientWidth || opts.width;
  const h = canvas.clientHeight || canvas.parentElement?.clientHeight || opts.height;
  renderer.setSize(w, h);

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  camera.position.set(0, 8, 5);
  camera.lookAt(0, 0, 0);

  // --- Lighting ---
  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

  // --- Poker table geometry ---
  addPokerTable(scene);

  // --- Seat positions ---
  const seatPositions = computeSeatPositions(opts.seatCount);

  // --- Chip stacks ---
  const chipStacks = createChipStacks(scene, seatPositions, {});

  // --- Hole cards ---
  const holeCards = createHoleCards(scene, seatPositions);

  // --- Community cards (swapped per hand) ---
  let activeCommunityCards = null;

  // --- Resize handler ---
  function onResize() {
    const rw = canvas.clientWidth;
    const rh = canvas.clientHeight;
    renderer.setSize(rw, rh);
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // --- Animation loop ---
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  // Self-heal initial size
  onResize();

  // --- update(handState) ---
  function update(handState) {
    const { cardData, seatPlayerMap, plMap, streetIndex } = handState;

    // Community cards — recreate per hand
    if (activeCommunityCards) {
      activeCommunityCards.dispose();
      activeCommunityCards = null;
    }
    if (cardData) {
      activeCommunityCards = createCommunityCards(scene, cardData);
      if (streetIndex !== undefined) {
        activeCommunityCards.goToStreet(streetIndex);
      }
    }

    // Hole cards
    if (cardData && seatPlayerMap) {
      if (streetIndex === 4) {
        holeCards.initHand(cardData, seatPlayerMap);
        holeCards.goToShowdown();
      } else {
        holeCards.initHand(cardData, seatPlayerMap);
      }
    }

    // Chip stacks
    if (plMap !== undefined) {
      chipStacks.updateChipStacks(plMap, seatPlayerMap);
    }
  }

  // --- dispose ---
  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    chipStacks.dispose();
    holeCards.dispose();
    if (activeCommunityCards) {
      activeCommunityCards.dispose();
      activeCommunityCards = null;
    }
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    seatPositions,
    chipStacks,
    holeCards,
    get communityCards() { return activeCommunityCards; },
    dispose,
    update,
  };
}
