/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from '../src/NavBar';

afterEach(() => {
  cleanup();
});

function renderNavBar(initialEntries: string[] = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NavBar />
    </MemoryRouter>,
  );
}

describe('NavBar', () => {
  it('renders a nav element', () => {
    renderNavBar();
    const nav = screen.getByRole('navigation');
    expect(nav).toBeTruthy();
  });

  it('renders 5 navigation links', () => {
    renderNavBar();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
  });

  it('renders links with correct text', () => {
    renderNavBar();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Playback')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.getByText('Dealer')).toBeTruthy();
    expect(screen.getByText('Player')).toBeTruthy();
  });

  it('links point to correct routes', () => {
    renderNavBar();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/playback');
    expect(hrefs).toContain('/data');
    expect(hrefs).toContain('/dealer');
    expect(hrefs).toContain('/player');
  });

  it('applies active class to current route link', () => {
    renderNavBar(['/']);
    const homeLink = screen.getByText('Home');
    expect(homeLink.className).toContain('active');
  });

  it('does not disable playback link when dealer game is inactive', () => {
    renderNavBar();
    const playbackLink = screen.getByText('Playback');
    expect(playbackLink.className).not.toContain('disabled');
  });
});
