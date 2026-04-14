/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock dealerStore before importing component
vi.mock('../../src/stores/dealerStore.ts', () => {
  let state = { gameId: null, currentStep: 'gameSelector' };
  const listeners = new Set<() => void>();
  const useDealerStore = (selector: (s: typeof state) => unknown) => selector(state);
  useDealerStore.getState = () => state;
  useDealerStore.setState = (partial: Partial<typeof state>) => {
    state = { ...state, ...partial };
    listeners.forEach((l) => l());
  };
  useDealerStore.subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  // Expose a test helper to reset state
  (useDealerStore as unknown as Record<string, unknown>).__reset = () => {
    state = { gameId: null, currentStep: 'gameSelector' };
  };
  return { useDealerStore };
});

import { LandingPage } from '../../src/../src/views/LandingPage.tsx';
import { useDealerStore } from '../../src/stores/dealerStore.ts';

beforeEach(() => {
  (useDealerStore as unknown as { __reset: () => void }).__reset();
});

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

  it('renders 4 navigation cards', () => {
    render(<LandingPage />);
    expect(screen.getByTestId('nav-playback')).toBeTruthy();
    expect(screen.getByTestId('nav-dealer')).toBeTruthy();
    expect(screen.getByTestId('nav-player')).toBeTruthy();
    expect(screen.getByTestId('nav-data')).toBeTruthy();
  });

  it('playback card links to #/playback when no game is active', () => {
    render(<LandingPage />);
    const link = screen.getByTestId('nav-playback');
    expect(link.getAttribute('href')).toBe('#/playback');
  });

  it('playback card is disabled when a dealer game is active', () => {
    useDealerStore.setState({ gameId: 42, currentStep: 'dashboard' });
    render(<LandingPage />);
    const link = screen.getByTestId('nav-playback');
    // Should not have a navigable href
    expect(link.getAttribute('href')).toBeNull();
    expect(link.textContent).toContain('Locked');
  });

  it('playback card prevents navigation when game is active', () => {
    useDealerStore.setState({ gameId: 42, currentStep: 'dashboard' });
    render(<LandingPage />);
    const link = screen.getByTestId('nav-playback');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    const prevented = !link.dispatchEvent(event);
    // The onClick handler calls preventDefault
    expect(prevented).toBe(true);
  });

  it('dealer card links to #/dealer', () => {
    render(<LandingPage />);
    const link = screen.getByTestId('nav-dealer');
    expect(link.getAttribute('href')).toBe('#/dealer');
  });

  it('player card links to #/player', () => {
    render(<LandingPage />);
    const link = screen.getByTestId('nav-player');
    expect(link.getAttribute('href')).toBe('#/player');
  });

  it('data card links to #/data', () => {
    render(<LandingPage />);
    const link = screen.getByTestId('nav-data');
    expect(link.getAttribute('href')).toBe('#/data');
  });

  it('playback card re-enables when game is reset', () => {
    useDealerStore.setState({ gameId: 42, currentStep: 'dashboard' });
    const { rerender } = render(<LandingPage />);
    expect(screen.getByTestId('nav-playback').getAttribute('href')).toBeNull();

    useDealerStore.setState({ gameId: null, currentStep: 'gameSelector' });
    rerender(<LandingPage />);
    expect(screen.getByTestId('nav-playback').getAttribute('href')).toBe('#/playback');
  });
});
