import * as THREE from 'three';

export function initScene(canvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(
    45,
    canvasElement.clientWidth / canvasElement.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 8, 5);
  camera.lookAt(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

  // Resize handler
  function onResize() {
    const w = canvasElement.clientWidth;
    const h = canvasElement.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // Animation loop
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  function dispose() {
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
  }

  // Self-heal initial size in case canvas wasn't laid out yet
  onResize();

  return { renderer, scene, camera, dispose };
}
