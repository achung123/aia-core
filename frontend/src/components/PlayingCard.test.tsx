/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PlayingCard } from './PlayingCard.tsx';

describe('PlayingCard', () => {
  it('renders rank and suit symbol for a hearts card', () => {
    const { container } = render(<PlayingCard code="Ah" />);
    const el = container.firstElementChild!;
    expect(el.textContent).toBe('A♥');
  });

  it('renders rank and suit symbol for a spades card', () => {
    const { container } = render(<PlayingCard code="Ks" />);
    expect(container.firstElementChild!.textContent).toBe('K♠');
  });

  it('renders rank and suit symbol for a diamonds card', () => {
    const { container } = render(<PlayingCard code="9d" />);
    expect(container.firstElementChild!.textContent).toBe('9♦');
  });

  it('renders rank and suit symbol for a clubs card', () => {
    const { container } = render(<PlayingCard code="Jc" />);
    expect(container.firstElementChild!.textContent).toBe('J♣');
  });

  it('renders 10 correctly', () => {
    const { container } = render(<PlayingCard code="10h" />);
    expect(container.firstElementChild!.textContent).toBe('10♥');
  });

  it('renders dash for null code', () => {
    const { container } = render(<PlayingCard code={null} />);
    expect(container.firstElementChild!.textContent).toBe('—');
  });

  it('renders dash for empty string code', () => {
    const { container } = render(<PlayingCard code="" />);
    expect(container.firstElementChild!.textContent).toBe('—');
  });

  it('uses red color for hearts and diamonds', () => {
    const { container } = render(<PlayingCard code="Ah" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#dc2626');
  });

  it('uses dark color for spades and clubs', () => {
    const { container } = render(<PlayingCard code="As" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.color).toBe('#1e293b');
  });

  it('passes through data-testid', () => {
    const { container } = render(<PlayingCard code="Ah" testId="my-card" />);
    expect(container.querySelector('[data-testid="my-card"]')).not.toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<PlayingCard code="Ah" onClick={onClick} />);
    fireEvent.click(container.firstElementChild!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a button element', () => {
    const { container } = render(<PlayingCard code="Ah" />);
    expect(container.firstElementChild!.tagName).toBe('BUTTON');
  });

  it('has white background to look like a physical card', () => {
    const { container } = render(<PlayingCard code="Ah" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).toBe('#ffffff');
  });
});
