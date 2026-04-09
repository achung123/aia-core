/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';
import { EquityRow } from './EquityRow.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

describe('EquityRow', () => {
  it('renders nothing when equityMap is null', () => {
    const container = renderToContainer(<EquityRow equityMap={null} />);
    expect(container.querySelector('[data-testid="equity-row"]')).toBeNull();
  });

  it('renders nothing when equityMap is empty', () => {
    const container = renderToContainer(<EquityRow equityMap={{}} />);
    expect(container.querySelector('[data-testid="equity-row"]')).toBeNull();
  });

  it('renders one card per player', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.65, Bob: 0.35 }} />
    );
    const cards = container.querySelectorAll('[data-testid="equity-card"]');
    expect(cards.length).toBe(2);
  });

  it('shows player name and equity percentage', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.654 }} />
    );
    const card = container.querySelector('[data-testid="equity-card"]');
    expect(card.textContent).toContain('Alice');
    expect(card.textContent).toContain('65.4%');
  });

  it('uses green color for equity >= 50%', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.75 }} />
    );
    const card = container.querySelector('[data-testid="equity-card"]');
    const eqEl = card.querySelectorAll('div')[1]; // second div is the equity value
    expect(eqEl.style.color).toBe('#4ade80');
  });

  it('uses yellow color for equity 25-49%', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.35 }} />
    );
    const card = container.querySelector('[data-testid="equity-card"]');
    const eqEl = card.querySelectorAll('div')[1];
    expect(eqEl.style.color).toBe('#facc15');
  });

  it('uses red color for equity < 25%', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.1 }} />
    );
    const card = container.querySelector('[data-testid="equity-card"]');
    const eqEl = card.querySelectorAll('div')[1];
    expect(eqEl.style.color).toBe('#f87171');
  });

  it('has card-style rounded styling', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5 }} />
    );
    const card = container.querySelector('[data-testid="equity-card"]');
    expect(card.style.borderRadius).toBe('8px');
  });

  it('renders as horizontal scrollable row', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5, Bob: 0.3, Charlie: 0.2 }} />
    );
    const row = container.querySelector('[data-testid="equity-row"]');
    expect(row.style.display).toBe('flex');
    expect(row.style.overflowX).toBe('auto');
  });

  it('shows loading indicator when loading prop is true', () => {
    const container = renderToContainer(<EquityRow equityMap={null} loading={true} />);
    const row = container.querySelector('[data-testid="equity-row"]');
    expect(row).toBeTruthy();
    const loadingEl = container.querySelector('[data-testid="equity-loading"]');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.textContent).toContain('Loading');
  });

  it('does not show loading indicator when loading is false', () => {
    const container = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5 }} loading={false} />
    );
    expect(container.querySelector('[data-testid="equity-loading"]')).toBeNull();
    expect(container.querySelector('[data-testid="equity-card"]')).toBeTruthy();
  });
});
