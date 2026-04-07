export function initRouter(routes) {
  const app = document.getElementById('app');
  const nav = document.querySelector('nav') || createNav();

  function navigate() {
    const hash = window.location.hash || '#/playback';
    const render = routes[hash] || routes['#/playback'];
    app.innerHTML = '';
    render(app);
    // Update active link
    nav.querySelectorAll('a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
  }

  window.addEventListener('hashchange', navigate);
  navigate(); // Initial render

  return {
    dispose: () => window.removeEventListener('hashchange', navigate),
  };
}

function createNav() {
  const nav = document.createElement('nav');
  nav.innerHTML = `
    <a href="#/playback">Playback</a>
    <a href="#/data">Data</a>
  `;
  document.body.insertBefore(nav, document.body.firstChild);
  return nav;
}
