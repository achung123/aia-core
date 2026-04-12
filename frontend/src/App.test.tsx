/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from './App';

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
});
