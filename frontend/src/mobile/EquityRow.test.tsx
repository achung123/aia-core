/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EquityRow } from './EquityRow.tsx';

function renderToContainer(element: React.ReactElement): HTMLElement {
  const { container } = render(element);
  return container;
}

afterEach(() => {
  cleanup();
});

describe('EquityRow', () => {
  it('renders nothing when equityMap is null', () => {
    const c = renderToContainer(<EquityRow equityMap={null} />);
    expect(c.querySelector('[data-testid="equity-row"]')).toBeNull();
  });

  it('renders nothing when equityMap is empty', () => {
    const c = renderToContainer(<EquityRow equityMap={{}} />);
    expect(c.querySelector('[data-testid="equity-row"]')).toBeNull();
  });

  it('renders one card per player', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.65, Bob: 0.35 }} />
    );
    const cards = c.querySelectorAll('[data-testid="equity-card"]');
    expect(cards.length).toBe(2);
  });

  it('shows player name and equity percentage', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.654 }} />
    );
    const card = c.querySelector('[data-testid="equity-card"]');
    expect(card!.textContent).toContain('Alice');
    expect(card!.textContent).toContain('65.4%');
  });

  it('uses green color for equity >= 50%', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.75 }} />
    );
    const card = c.querySelector('[data-testid="equity-card"]');
    const eqEl = card!.querySelectorAll('div')[1]; // second div is the equity value
    expect((eqEl as HTMLElement).style.color).toBe('#4ade80');
  });

  it('uses yellow color for equity 25-49%', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.35 }} />
    );
    const card = c.querySelector('[data-testid="equity-card"]');
    const eqEl = card!.querySelectorAll('div')[1];
    expect((eqEl as HTMLElement).style.color).toBe('#facc15');
  });

  it('uses red color for equity < 25%', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.1 }} />
    );
    const card = c.querySelector('[data-testid="equity-card"]');
    const eqEl = card!.querySelectorAll('div')[1];
    expect((eqEl as HTMLElement).style.color).toBe('#f87171');
  });

  it('has card-style rounded styling', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5 }} />
    );
    const card = c.querySelector('[data-testid="equity-card"]') as HTMLElement;
    expect(card.style.borderRadius).toBe('8px');
  });

  it('renders as horizontal scrollable row', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5, Bob: 0.3, Charlie: 0.2 }} />
    );
    const row = c.querySelector('[data-testid="equity-row"]') as HTMLElement;
    expect(row.style.display).toBe('flex');
    expect(row.style.overflowX).toBe('auto');
  });

  it('shows loading indicator when loading prop is true', () => {
    const c = renderToContainer(<EquityRow equityMap={null} loading={true} />);
    const row = c.querySelector('[data-testid="equity-row"]');
    expect(row).toBeTruthy();
    const loadingEl = c.querySelector('[data-testid="equity-loading"]');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl!.textContent).toContain('Loading');
  });

  it('does not show loading indicator when loading is false', () => {
    const c = renderToContainer(
      <EquityRow equityMap={{ Alice: 0.5 }} loading={false} />
    );
    expect(c.querySelector('[data-testid="equity-loading"]')).toBeNull();
    expect(c.querySelector('[data-testid="equity-card"]')).toBeTruthy();
  });
});
