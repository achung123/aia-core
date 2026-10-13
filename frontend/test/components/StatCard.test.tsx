/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../../src/components/StatCard.tsx';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Hands Played" value={42} />);
    expect(screen.getByText('Hands Played')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders string value', () => {
    render(<StatCard label="Win Rate" value="65%" />);
    expect(screen.getByText('Win Rate')).toBeTruthy();
    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('renders dash placeholder for null value', () => {
    render(<StatCard label="Avg Pot" value={null} />);
    expect(screen.getByText('Avg Pot')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders zero with muted style', () => {
    const { container } = render(<StatCard label="Wins" value={0} />);
    const valueEl = screen.getByText('0');
    expect(valueEl).toBeTruthy();
    expect((valueEl as HTMLElement).style.color).toBe('#9ca3af');
  });

  it('renders up trend indicator', () => {
    const { container } = render(<StatCard label="Profit" value={100} trend="up" />);
    expect(container.textContent).toContain('▲');
  });

  it('renders down trend indicator', () => {
    const { container } = render(<StatCard label="Losses" value={5} trend="down" />);
    expect(container.textContent).toContain('▼');
  });

  it('renders neutral trend indicator', () => {
    const { container } = render(<StatCard label="Streak" value={3} trend="neutral" />);
    expect(container.textContent).toContain('●');
  });

  it('renders without trend when not provided', () => {
    const { container } = render(<StatCard label="Hands" value={10} />);
    expect(container.textContent).not.toContain('▲');
    expect(container.textContent).not.toContain('▼');
  });

  it('applies muted style for null value', () => {
    const { container } = render(<StatCard label="Test" value={null} />);
    const spans = container.querySelectorAll('span');
    const valueSpan = spans[1] as HTMLElement;
    expect(valueSpan.textContent).toBe('—');
    expect(valueSpan.style.color).toBe('#9ca3af');
  });
});
