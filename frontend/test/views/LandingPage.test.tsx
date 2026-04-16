/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { LandingPage } from '../../src/../src/views/LandingPage.tsx';
afterEach(() => {
  cleanup();
});

describe('LandingPage', () => {
  it('renders the landing page container', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('landing-page')).toBeTruthy();
  });

  it('renders the title', () => {
    render(<LandingPage />);
    expect(screen.getByText('All In Analytics')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<LandingPage />);
    expect(screen.getByText('Poker session tracking & analysis')).toBeTruthy();
  });

  it('renders analytics navigation card', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('nav-analytics')).toBeTruthy();
  });




});
