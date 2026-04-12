/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { SessionScrubber } from './SessionScrubber.tsx';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderToContainer(element: React.ReactElement): HTMLDivElement {
  container = document.createElement('div');
  root = createRoot(container);
  act(() => { root!.render(element); });
  return container;
}

afterEach(() => {
  if (root) {
    act(() => { root!.unmount(); });
    root = null;
  }
  container = null;
});

describe('SessionScrubber', () => {
  it('renders with correct label', () => {
    const c = renderToContainer(
      <SessionScrubber current={3} total={10} onchange={() => {}} />
    );
    const label = c.querySelector('[data-testid="session-label"]');
    expect(label!.textContent).toBe('Hand 3 / 10');
  });

  it('disables prev button on first hand', () => {
    const c = renderToContainer(
      <SessionScrubber current={1} total={5} onchange={() => {}} />
    );
    const prev = c.querySelector('[data-testid="session-prev"]') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it('disables next button on last hand', () => {
    const c = renderToContainer(
      <SessionScrubber current={5} total={5} onchange={() => {}} />
    );
    const next = c.querySelector('[data-testid="session-next"]') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it('calls onchange with previous index when prev clicked', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <SessionScrubber current={3} total={5} onchange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="session-prev"]')!.click(); });
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('calls onchange with next index when next clicked', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <SessionScrubber current={3} total={5} onchange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="session-next"]')!.click(); });
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('does not call onchange when prev clicked at index 1', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <SessionScrubber current={1} total={5} onchange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="session-prev"]')!.click(); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call onchange when next clicked at last index', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <SessionScrubber current={5} total={5} onchange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="session-next"]')!.click(); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('has 48px min touch targets', () => {
    const c = renderToContainer(
      <SessionScrubber current={2} total={5} onchange={() => {}} />
    );
    const prev = c.querySelector('[data-testid="session-prev"]') as HTMLElement;
    const next = c.querySelector('[data-testid="session-next"]') as HTMLElement;
    expect(prev.style.minHeight).toBe('48px');
    expect(prev.style.minWidth).toBe('48px');
    expect(next.style.minHeight).toBe('48px');
    expect(next.style.minWidth).toBe('48px');
  });

  it('uses indigo palette styling', () => {
    const c = renderToContainer(
      <SessionScrubber current={2} total={5} onchange={() => {}} />
    );
    const prev = c.querySelector('[data-testid="session-prev"]') as HTMLElement;
    expect(prev.style.background).toBe('#4f46e5');
    expect(prev.style.borderRadius).toBe('8px');
  });
});
