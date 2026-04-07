import './style.css';
import * as THREE from 'three';
import { initRouter } from './router.js';
import { renderDataView } from './views/dataView.js';

console.log('Three.js r' + THREE.REVISION);

function renderPlayback(container) {
  const canvas = document.createElement('canvas');
  canvas.id = 'three-canvas';
  container.appendChild(canvas);
}

initRouter({
  '#/playback': renderPlayback,
  '#/data': container => renderDataView(container),
});
