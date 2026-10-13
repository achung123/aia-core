import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { addPokerTable, computeSeatPositions } from './tableGeometry.ts';
import { createChipStacks } from './chipStacks.ts';
import { createCommunityCards } from './communityCards.ts';
import { createHoleCards } from './holeCards.ts';
import { DEFAULT_OVERHEAD_POSITION } from './seatCamera.ts';

export interface PokerSceneOptions {
  width?: number;
  height?: number;
  seatCount?: number;
  antialias?: boolean;
  externalResize?: boolean;
}

export interface HandState {
  cardData?: {
    flop: { rank: string; suit: string }[] | null;
    turn: { rank: string; suit: string } | null;
    river: { rank: string; suit: string } | null;
    player_hands: {
      player_name: string;
      hole_cards: { rank: string; suit: string }[] | null;
      result: 'win' | 'loss' | 'fold';
    }[];
  };
  seatPlayerMap?: Record<number, string>;
  plMap?: Record<string, number>;
  streetIndex?: number;
}

export interface PokerSceneResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  seatPositions: THREE.Vector3[];
  chipStacks: ReturnType<typeof createChipStacks>;
  holeCards: ReturnType<typeof createHoleCards>;
  communityCards: ReturnType<typeof createCommunityCards> | null;
  dispose: () => void;
  update: (handState: HandState) => void;
}

const DEFAULTS: Required<PokerSceneOptions> = {
  width: 800,
  height: 600,
  seatCount: 10,
  antialias: true,
  externalResize: false,
};

/**
 * Create a reusable Three.js poker scene.
 */
export function createPokerScene(
  canvas: HTMLCanvasElement,
  options: PokerSceneOptions = {},
): PokerSceneResult {
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
  camera.position.set(DEFAULT_OVERHEAD_POSITION.x, DEFAULT_OVERHEAD_POSITION.y, DEFAULT_OVERHEAD_POSITION.z);
  camera.lookAt(0, 0, 0);

  // --- OrbitControls (touch-enabled) ---
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.minDistance = 8;
  controls.maxDistance = 30;
  controls.touches = {
    ONE: THREE.TOUCH?.ROTATE ?? 0,
    TWO: THREE.TOUCH?.DOLLY_ROTATE ?? 3,
  };
  controls.saveState();

  // --- Context menu suppression ---
  function onContextMenu(e: Event): void { e.preventDefault(); }
  canvas.addEventListener('contextmenu', onContextMenu);

  // --- Double-tap to reset camera ---
  let lastTapTime = 0;
  const DOUBLE_TAP_MS = 300;
  function onTouchEnd(e: TouchEvent): void {
    // Ignore multi-finger lifts (e.g. pinch-zoom ending)
    if (e.touches.length > 0 || e.changedTouches.length > 1) return;
    const now = Date.now();
    if (now - lastTapTime < DOUBLE_TAP_MS) {
      controls.reset();
      lastTapTime = 0;
    } else {
      lastTapTime = now;
    }
  }
  canvas.addEventListener('touchend', onTouchEnd);

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
  let activeCommunityCards: ReturnType<typeof createCommunityCards> | null = null;

  // --- Resize handler ---
  function onResize(): void {
    const rw = canvas.clientWidth;
    const rh = canvas.clientHeight;
    renderer.setSize(rw, rh);
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
  }
  if (!opts.externalResize) {
    window.addEventListener('resize', onResize);
  }

  // --- Animation loop ---
  let rafId: number;
  function animate(): void {
    rafId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Self-heal initial size
  if (!opts.externalResize) {
    onResize();
  }

  // --- update(handState) ---
  function update(handState: HandState): void {
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
  function dispose(): void {
    cancelAnimationFrame(rafId);
    if (!opts.externalResize) {
      window.removeEventListener('resize', onResize);
    }
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('touchend', onTouchEnd);
    controls.dispose();
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
    controls,
    seatPositions,
    chipStacks,
    holeCards,
    get communityCards() { return activeCommunityCards; },
    dispose,
    update,
  };
}
