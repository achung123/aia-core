import './style.css';
import * as THREE from 'three';
import { h, render } from 'preact';
import { initRouter } from './router.js';
import { renderDataView } from './views/dataView.js';
import { MobilePlaybackView } from './views/MobilePlaybackView.jsx';
import { LandingPage } from './views/LandingPage.jsx';
import { DealerApp } from './dealer/DealerApp.jsx';
import { PlayerApp } from './player/PlayerApp.jsx';

console.log('Three.js r' + THREE.REVISION);

initRouter({
  '#/': container => {
    render(h(LandingPage), container);
    return () => render(null, container);
  },
  '#/playback': container => {
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
