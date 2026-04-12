import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CardPicker } from './CardPicker.tsx';
import type { CardPickerProps } from './CardPicker.tsx';

afterEach(cleanup);

describe('CardPicker', () => {
  const defaultProps: CardPickerProps = {
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders "Select Card" title', () => {
    render(<CardPicker {...defaultProps} />);
    expect(screen.getByText('Select Card')).toBeDefined();
  });

  it('renders 52 card buttons (4 suits × 13 ranks)', () => {
    render(<CardPicker {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(52);
  });

  it('calls onSelect with card code when a card button is clicked', () => {
    const onSelect = vi.fn();
    render(<CardPicker {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('A♠'));
    expect(onSelect).toHaveBeenCalledWith('As');
  });

  it('calls onSelect with correct code for 10 of hearts', () => {
    const onSelect = vi.fn();
    render(<CardPicker {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('10♥'));
    expect(onSelect).toHaveBeenCalledWith('10h');
  });

  it('calls onClose when overlay background is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<CardPicker {...defaultProps} onClose={onClose} />);
    const overlay = container.firstElementChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(<CardPicker {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('Select Card'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders all four suits', () => {
    const { container } = render(<CardPicker {...defaultProps} />);
    expect(container.textContent).toContain('♠');
    expect(container.textContent).toContain('♥');
    expect(container.textContent).toContain('♦');
    expect(container.textContent).toContain('♣');
  });

  it('spade buttons have dark color', () => {
    render(<CardPicker {...defaultProps} />);
    const btn = screen.getByText('A♠');
    expect(btn.style.color).toBe('#1e293b');
  });

  it('heart buttons have red color', () => {
    render(<CardPicker {...defaultProps} />);
    const btn = screen.getByText('A♥');
    expect(btn.style.color).toBe('#dc2626');
  });
});
