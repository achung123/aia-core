/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initRouter } from './router.js';

const DEALER_STATE_KEY = 'aia_dealer_state';

describe('router nav playback lock', () => {
  let dispose;

  beforeEach(() => {
    sessionStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
  });

  afterEach(() => {
    if (dispose) dispose();
    dispose = null;
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  it('disables playback link when dealer-state-change fires with active game', () => {
    const router = initRouter({
      '#/': () => {},
      '#/playback': () => {},
    });
    dispose = router.dispose;

    // Simulate dealer starting a game (same-tab sessionStorage write)
    sessionStorage.setItem(DEALER_STATE_KEY, JSON.stringify({
      gameId: 1,
      currentStep: 'playerGrid',
    }));
    window.dispatchEvent(new CustomEvent('dealer-state-change'));

    const nav = document.querySelector('nav');
    const playbackLink = nav.querySelector('a[href="#/playback"]');
    expect(playbackLink.classList.contains('disabled')).toBe(true);
  });

  it('re-enables playback link when dealer-state-change fires after game ends', () => {
    // Start with an active game
    sessionStorage.setItem(DEALER_STATE_KEY, JSON.stringify({
      gameId: 1,
      currentStep: 'playerGrid',
    }));

    const router = initRouter({
      '#/': () => {},
      '#/playback': () => {},
    });
    dispose = router.dispose;

    const nav = document.querySelector('nav');
    const playbackLink = nav.querySelector('a[href="#/playback"]');
    expect(playbackLink.classList.contains('disabled')).toBe(true);

    // Game ends — dealer clears sessionStorage
    sessionStorage.removeItem(DEALER_STATE_KEY);
    window.dispatchEvent(new CustomEvent('dealer-state-change'));

    expect(playbackLink.classList.contains('disabled')).toBe(false);
  });
});
