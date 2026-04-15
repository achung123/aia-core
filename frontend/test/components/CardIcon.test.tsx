/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CardIcon } from '../../src/components/CardIcon.tsx';

describe('CardIcon', () => {
  it('renders rank and suit for a hearts card', () => {
    const { container } = render(<CardIcon card="AH" />);
    expect(container.firstElementChild!.textContent).toBe('A♥');
  });

  it('renders rank and suit for a spades card', () => {
    const { container } = render(<CardIcon card="KS" />);
    expect(container.firstElementChild!.textContent).toBe('K♠');
  });

  it('renders rank and suit for a diamonds card', () => {
    const { container } = render(<CardIcon card="9D" />);
    expect(container.firstElementChild!.textContent).toBe('9♦');
  });

  it('renders rank and suit for a clubs card', () => {
    const { container } = render(<CardIcon card="JC" />);
    expect(container.firstElementChild!.textContent).toBe('J♣');
  });

  it('renders 10 correctly', () => {
    const { container } = render(<CardIcon card="10C" />);
    expect(container.firstElementChild!.textContent).toBe('10♣');
  });

  it('handles lowercase input', () => {
    const { container } = render(<CardIcon card="ah" />);
    expect(container.firstElementChild!.textContent).toBe('A♥');
  });

  it('uses red color for hearts', () => {
    const { container } = render(<CardIcon card="AH" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#dc2626');
  });

  it('uses red color for diamonds', () => {
    const { container } = render(<CardIcon card="KD" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#dc2626');
  });

  it('uses dark color for spades', () => {
    const { container } = render(<CardIcon card="AS" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#1e293b');
  });

  it('uses dark color for clubs', () => {
    const { container } = render(<CardIcon card="AC" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#1e293b');
  });

  it('renders nothing for null card', () => {
    const { container } = render(<CardIcon card={null} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('renders nothing for undefined card', () => {
    const { container } = render(<CardIcon card={undefined} />);
    expect(container.firstElementChild).toBeNull();
  });

  it('renders placeholder for invalid card string', () => {
    const { container } = render(<CardIcon card="XY" />);
    const el = container.firstElementChild!;
    expect(el.textContent).toBe('?');
  });

  it('renders placeholder for empty string', () => {
    const { container } = render(<CardIcon card="" />);
    const el = container.firstElementChild!;
    expect(el.textContent).toBe('?');
  });

  it('renders as a span (non-interactive)', () => {
    const { container } = render(<CardIcon card="AH" />);
    expect(container.firstElementChild!.tagName).toBe('SPAN');
  });
});
