/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from 'react';
import { StreetScrubber, STREETS } from './StreetScrubber.tsx';

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

const FULL_HAND = {
  flop: [{ rank: 'A', suit: '♥' }, { rank: 'K', suit: '♦' }, { rank: 'Q', suit: '♣' }],
  turn: { rank: 'J', suit: '♠' },
  river: { rank: 'T', suit: '♥' },
};

const FLOP_ONLY_HAND = {
  flop: [{ rank: 'A', suit: '♥' }, { rank: 'K', suit: '♦' }, { rank: 'Q', suit: '♣' }],
  turn: null,
  river: null,
};

describe('StreetScrubber', () => {
  it('renders all five street buttons', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const scrubber = c.querySelector('[data-testid="street-scrubber"]');
    expect(scrubber).toBeTruthy();
    expect(scrubber!.querySelectorAll('button').length).toBe(5);
  });

  it('highlights the active street', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const flopBtn = c.querySelector('[data-testid="street-flop"]') as HTMLElement;
    expect(flopBtn.style.background).toBe('#4f46e5');
    expect(flopBtn.style.color).toBe('#fff');
  });

  it('disables turn button when turn is null', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={() => {}} />
    );
    const turnBtn = c.querySelector('[data-testid="street-turn"]') as HTMLButtonElement;
    expect(turnBtn.disabled).toBe(true);
  });

  it('disables river button when river is null', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={() => {}} />
    );
    const riverBtn = c.querySelector('[data-testid="street-river"]') as HTMLButtonElement;
    expect(riverBtn.disabled).toBe(true);
  });

  it('calls onStreetChange when a street button is clicked', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="street-flop"]')!.click(); });
    expect(spy).toHaveBeenCalledWith('Flop');
  });

  it('does not call onStreetChange when disabled button is clicked', () => {
    const spy = vi.fn();
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={spy} />
    );
    act(() => { c.querySelector<HTMLButtonElement>('[data-testid="street-turn"]')!.click(); });
    expect(spy).not.toHaveBeenCalled();
  });

  it('has 48px min touch targets', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const buttons = c.querySelectorAll('[data-testid="street-scrubber"] button');
    buttons.forEach(btn => {
      expect((btn as HTMLElement).style.minHeight).toBe('48px');
      expect((btn as HTMLElement).style.minWidth).toBe('48px');
    });
  });

  it('uses indigo palette for active button', () => {
    const c = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const preflopBtn = c.querySelector('[data-testid="street-preflop"]') as HTMLElement;
    expect(preflopBtn.style.background).toBe('#4f46e5');
    expect(preflopBtn.style.borderRadius).toBe('8px');
  });

  it('exports STREETS array', () => {
    expect(STREETS).toEqual(['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown']);
  });
});
