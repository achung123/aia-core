const DEALER_STATE_KEY = 'aia_dealer_state';

function hasActiveDealerGame() {
  try {
    const raw = sessionStorage.getItem(DEALER_STATE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    return !!(saved && saved.gameId && saved.currentStep && saved.currentStep !== 'gameSelector');
  } catch { return false; }
}

export function initRouter(routes) {
  const app = document.getElementById('app');
  const nav = document.querySelector('nav') || createNav();
  let cleanup = null;
  let currentPath = null;

  function updateNavState() {
    const gameActive = hasActiveDealerGame();
    const playbackLink = nav.querySelector('a[href="#/playback"]');
    if (playbackLink) {
      playbackLink.classList.toggle('disabled', gameActive);
    }
  }

  function navigate() {
    const hash = window.location.hash || '#/';
    let path = hash.split('?')[0];

    // Only re-render when the route changes, not on query param changes
    if (path === currentPath) return;
    currentPath = path;

    const render = routes[path] || routes['#/'];
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    app.innerHTML = '';
    cleanup = render(app) || null;
    // Update active link + disabled state
    updateNavState();
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === path);
    });
  }

  window.addEventListener('hashchange', navigate);
  // Re-check nav state on storage changes (cross-tab)
  window.addEventListener('storage', updateNavState);
  // Re-check nav state on same-tab dealer state changes
  window.addEventListener('dealer-state-change', updateNavState);
  navigate(); // Initial render

  return {
    dispose: () => {
      window.removeEventListener('hashchange', navigate);
      window.removeEventListener('storage', updateNavState);
      window.removeEventListener('dealer-state-change', updateNavState);
    },
  };
}

function createNav() {
  const nav = document.createElement('nav');
  nav.innerHTML = `
    <a href="#/">Home</a>
    <a href="#/playback">Playback</a>
    <a href="#/data">Data</a>
    <a href="#/dealer">Dealer</a>
    <a href="#/player">Player</a>
  `;
  document.body.insertBefore(nav, document.body.firstChild);
  return nav;
}
