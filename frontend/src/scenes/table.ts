import * as THREE from 'three';
import { DEFAULT_OVERHEAD_POSITION } from './seatCamera.ts';

export interface InitSceneResult {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dispose: () => void;
}

export function initScene(canvasElement: HTMLCanvasElement): InitSceneResult {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  const w = canvasElement.clientWidth || canvasElement.parentElement?.clientWidth || 800;
  const h = canvasElement.clientHeight || canvasElement.parentElement?.clientHeight || 600;
  renderer.setSize(w, h);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(
    45,
    w / h,
    0.1,
    1000,
  );
  camera.position.copy(DEFAULT_OVERHEAD_POSITION);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x606060);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

  // Resize handler
  function onResize(): void {
    const rw = canvasElement.clientWidth;
    const rh = canvasElement.clientHeight;
    renderer.setSize(rw, rh);
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // Animation loop
  let rafId: number;
  function animate(): void {
    rafId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  function dispose(): void {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
  }

  // Self-heal initial size in case canvas wasn't laid out yet
  onResize();

  return { renderer, scene, camera, dispose };
}
