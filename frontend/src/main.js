import './style.css';
import * as THREE from 'three';
import { h, render } from 'preact';
import { initRouter } from './router.js';
import { renderDataView } from './views/dataView.js';
import { renderPlaybackView } from './views/playbackView.js';
import { MobilePlaybackView } from './views/MobilePlaybackView.jsx';
import { DealerApp } from './dealer/DealerApp.jsx';
import { PlayerApp } from './player/PlayerApp.jsx';

console.log('Three.js r' + THREE.REVISION);

initRouter({
  '#/playback': container => renderPlaybackView(container),
  '#/playback-mobile': container => {
    render(h(MobilePlaybackView), container);
    return () => render(null, container);
  },
  '#/data': container => renderDataView(container),
  '#/dealer': container => {
    render(h(DealerApp), container);
    return () => render(null, container);
  },
  '#/player': container => {
    render(h(PlayerApp), container);
    return () => render(null, container);
  },
});
