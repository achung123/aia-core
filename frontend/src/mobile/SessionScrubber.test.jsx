/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';
import { SessionScrubber } from './SessionScrubber.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

describe('SessionScrubber', () => {
  it('renders with correct label', () => {
    const container = renderToContainer(
      <SessionScrubber current={3} total={10} onchange={() => {}} />
    );
    const label = container.querySelector('[data-testid="session-label"]');
    expect(label.textContent).toBe('Hand 3 / 10');
  });

  it('disables prev button on first hand', () => {
    const container = renderToContainer(
      <SessionScrubber current={1} total={5} onchange={() => {}} />
    );
    const prev = container.querySelector('[data-testid="session-prev"]');
    expect(prev.disabled).toBe(true);
  });

  it('disables next button on last hand', () => {
    const container = renderToContainer(
      <SessionScrubber current={5} total={5} onchange={() => {}} />
    );
    const next = container.querySelector('[data-testid="session-next"]');
    expect(next.disabled).toBe(true);
  });

  it('calls onchange with previous index when prev clicked', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <SessionScrubber current={3} total={5} onchange={spy} />
    );
    container.querySelector('[data-testid="session-prev"]').click();
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('calls onchange with next index when next clicked', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <SessionScrubber current={3} total={5} onchange={spy} />
    );
    container.querySelector('[data-testid="session-next"]').click();
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('does not call onchange when prev clicked at index 1', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <SessionScrubber current={1} total={5} onchange={spy} />
    );
    container.querySelector('[data-testid="session-prev"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call onchange when next clicked at last index', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <SessionScrubber current={5} total={5} onchange={spy} />
    );
    container.querySelector('[data-testid="session-next"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('has 48px min touch targets', () => {
    const container = renderToContainer(
      <SessionScrubber current={2} total={5} onchange={() => {}} />
    );
    const prev = container.querySelector('[data-testid="session-prev"]');
    const next = container.querySelector('[data-testid="session-next"]');
    expect(prev.style.minHeight).toBe('48px');
    expect(prev.style.minWidth).toBe('48px');
    expect(next.style.minHeight).toBe('48px');
    expect(next.style.minWidth).toBe('48px');
  });

  it('uses indigo palette styling', () => {
    const container = renderToContainer(
      <SessionScrubber current={2} total={5} onchange={() => {}} />
    );
    const prev = container.querySelector('[data-testid="session-prev"]');
    expect(prev.style.background).toBe('#4f46e5');
    expect(prev.style.borderRadius).toBe('8px');
  });
});
