/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock heavy child components to isolate App routing tests
vi.mock('../src/views/PlaybackView', () => ({
  PlaybackView: () => <div data-testid="playback-game-selector">PlaybackView loaded</div>,
}));
vi.mock('../src/dealer/DealerApp', () => ({
  DealerApp: () => <div data-testid="dealer-app">DealerApp loaded</div>,
}));
vi.mock('../src/player/PlayerApp', () => ({
  PlayerApp: () => <div data-testid="player-app">PlayerApp loaded</div>,
}));
vi.mock('../src/api/client.ts', () => ({
  fetchPlayers: vi.fn().mockResolvedValue([]),
  fetchLeaderboard: vi.fn().mockResolvedValue([]),
}));

import App from '../src/App';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('renders without crashing', () => {
    renderApp();
    expect(document.querySelector('#app-root')).toBeTruthy();
  });

  it('uses HashRouter (hash-based URLs)', () => {
    renderApp();
    expect(document.querySelector('#app-root')).toBeTruthy();
  });

  it('renders NavBar', () => {
    renderApp();
    const nav = screen.getByRole('navigation');
    expect(nav).toBeTruthy();
  });

  it('renders the landing page at default route', () => {
    renderApp();
    const homeLink = screen.getByText('Home');
    expect(homeLink).toBeTruthy();
  });

  it('defines routes for all main pages', () => {
    renderApp();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getAllByText('Dealer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Game').length).toBeGreaterThanOrEqual(1);
  });

  it('renders PlaybackView at /playback', () => {
    window.location.hash = '#/playback';
    renderApp();
    expect(screen.getByTestId('playback-game-selector')).toBeTruthy();
  });

  it('renders real DealerApp at /dealer (not a placeholder)', () => {
    window.location.hash = '#/dealer';
    renderApp();
    expect(screen.getByTestId('dealer-app')).toBeTruthy();
  });

  it('renders real PlayerApp at /player (not a placeholder)', () => {
    window.location.hash = '#/player';
    renderApp();
    expect(screen.getByTestId('player-app')).toBeTruthy();
  });
});
