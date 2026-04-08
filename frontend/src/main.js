import './style.css';
import * as THREE from 'three';
import { h, render } from 'preact';
import { initRouter } from './router.js';
import { renderDataView } from './views/dataView.js';
import { renderPlaybackView } from './views/playbackView.js';
import { DealerApp } from './dealer/DealerApp.jsx';

console.log('Three.js r' + THREE.REVISION);

initRouter({
  '#/playback': container => renderPlaybackView(container),
  '#/data': container => renderDataView(container),
  '#/dealer': container => {
    render(h(DealerApp), container);
    return () => render(null, container);
  },
});
