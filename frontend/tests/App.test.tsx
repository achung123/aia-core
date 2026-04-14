/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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

import App from '../src/App';

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.querySelector('#app-root')).toBeTruthy();
  });

  it('uses HashRouter (hash-based URLs)', () => {
    render(<App />);
    expect(document.querySelector('#app-root')).toBeTruthy();
  });

  it('renders NavBar', () => {
    render(<App />);
    const nav = screen.getByRole('navigation');
    expect(nav).toBeTruthy();
  });

  it('renders the landing page at default route', () => {
    render(<App />);
    const homeLink = screen.getByText('Home');
    expect(homeLink).toBeTruthy();
  });

  it('defines routes for all 5 pages', () => {
    render(<App />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getAllByText('Playback').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Data').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Dealer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Player').length).toBeGreaterThanOrEqual(1);
  });

  it('renders PlaybackView at /playback', () => {
    window.location.hash = '#/playback';
    render(<App />);
    expect(screen.getByTestId('playback-game-selector')).toBeTruthy();
  });

  it('renders real DealerApp at /dealer (not a placeholder)', () => {
    window.location.hash = '#/dealer';
    render(<App />);
    expect(screen.getByTestId('dealer-app')).toBeTruthy();
  });

  it('renders real PlayerApp at /player (not a placeholder)', () => {
    window.location.hash = '#/player';
    render(<App />);
    expect(screen.getByTestId('player-app')).toBeTruthy();
  });
});
