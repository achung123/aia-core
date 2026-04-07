import './style.css';
import * as THREE from 'three';
import { initRouter } from './router.js';
import { renderDataView } from './views/dataView.js';
import { renderPlaybackView } from './views/playbackView.js';

console.log('Three.js r' + THREE.REVISION);

initRouter({
  '#/playback': container => renderPlaybackView(container),
  '#/data': container => renderDataView(container),
});
