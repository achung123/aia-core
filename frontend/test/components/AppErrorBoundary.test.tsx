/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { AppErrorBoundary } from '../../src/components/AppErrorBoundary.tsx';

function Boom({ explode }: { explode: boolean }) {
  if (explode) throw new Error('bad card data');
  return <p>all fine</p>;
}

beforeEach(() => {
  // React logs the caught error; keep the test output readable
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AppErrorBoundary', () => {
  it('renders the page normally', () => {
    render(
      <AppErrorBoundary>
        <Boom explode={false} />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('all fine')).toBeDefined();
    expect(screen.queryByTestId('app-error')).toBeNull();
  });

  it('replaces a crashing page with a way out and the reason', () => {
    render(
      <AppErrorBoundary>
        <Boom explode />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByTestId('app-error-reload')).toBeDefined();
    expect(screen.getByTestId('app-error-home').getAttribute('href')).toBe('#/');
    expect(screen.getByTestId('app-error-details').textContent).toBe('bad card data');
  });

  it('clears when the route changes', () => {
    const { rerender } = render(
      <AppErrorBoundary resetKey="/dealer">
        <Boom explode />
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId('app-error')).toBeDefined();

    rerender(
      <AppErrorBoundary resetKey="/player">
        <Boom explode={false} />
      </AppErrorBoundary>,
    );
    expect(screen.queryByTestId('app-error')).toBeNull();
    expect(screen.getByText('all fine')).toBeDefined();
  });

  it('stays in the error state if the route has not changed', () => {
    const { rerender } = render(
      <AppErrorBoundary resetKey="/dealer">
        <Boom explode />
      </AppErrorBoundary>,
    );
    rerender(
      <AppErrorBoundary resetKey="/dealer">
        <Boom explode />
      </AppErrorBoundary>,
    );
    expect(screen.getByTestId('app-error')).toBeDefined();
  });
});
