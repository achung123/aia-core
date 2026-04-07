import * as THREE from 'three';
import { initRouter } from './router.js';

console.log('Three.js r' + THREE.REVISION);

function renderPlayback(container) {
  const canvas = document.createElement('canvas');
  canvas.id = 'three-canvas';
  container.appendChild(canvas);
}

function renderData(container) {
  container.innerHTML = '<h1>Data</h1>';
}

initRouter({
  '#/playback': renderPlayback,
  '#/data': renderData,
});
