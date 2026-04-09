/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { h } from 'preact';
import { render } from 'preact';
import { StreetScrubber, STREETS } from './StreetScrubber.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

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
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const scrubber = container.querySelector('[data-testid="street-scrubber"]');
    expect(scrubber).toBeTruthy();
    expect(scrubber.querySelectorAll('button').length).toBe(5);
  });

  it('highlights the active street', () => {
    const container = renderToContainer(
      <StreetScrubber currentStreet="Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const flopBtn = container.querySelector('[data-testid="street-flop"]');
    expect(flopBtn.style.background).toBe('#4f46e5');
    expect(flopBtn.style.color).toBe('#fff');
  });

  it('disables turn button when turn is null', () => {
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={() => {}} />
    );
    const turnBtn = container.querySelector('[data-testid="street-turn"]');
    expect(turnBtn.disabled).toBe(true);
  });

  it('disables river button when river is null', () => {
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={() => {}} />
    );
    const riverBtn = container.querySelector('[data-testid="street-river"]');
    expect(riverBtn.disabled).toBe(true);
  });

  it('calls onStreetChange when a street button is clicked', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={spy} />
    );
    container.querySelector('[data-testid="street-flop"]').click();
    expect(spy).toHaveBeenCalledWith('Flop');
  });

  it('does not call onStreetChange when disabled button is clicked', () => {
    const spy = vi.fn();
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY_HAND} onStreetChange={spy} />
    );
    container.querySelector('[data-testid="street-turn"]').click();
    expect(spy).not.toHaveBeenCalled();
  });

  it('has 48px min touch targets', () => {
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const buttons = container.querySelectorAll('[data-testid="street-scrubber"] button');
    buttons.forEach(btn => {
      expect(btn.style.minHeight).toBe('48px');
      expect(btn.style.minWidth).toBe('48px');
    });
  });

  it('uses indigo palette for active button', () => {
    const container = renderToContainer(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />
    );
    const preflopBtn = container.querySelector('[data-testid="street-preflop"]');
    expect(preflopBtn.style.background).toBe('#4f46e5');
    expect(preflopBtn.style.borderRadius).toBe('8px');
  });

  it('exports STREETS array', () => {
    expect(STREETS).toEqual(['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown']);
  });
});
