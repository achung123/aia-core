import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChipPicker } from './ChipPicker.tsx';

afterEach(cleanup);

describe('ChipPicker', () => {
  const defaultProps = {
    onConfirm: vi.fn(),
  };

  it('renders five chip buttons with correct labels', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-0.10')).toBeDefined();
    expect(screen.getByTestId('chip-0.20')).toBeDefined();
    expect(screen.getByTestId('chip-0.30')).toBeDefined();
    expect(screen.getByTestId('chip-0.40')).toBeDefined();
    expect(screen.getByTestId('chip-0.50')).toBeDefined();
  });

  it('displays denomination text on each chip', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByText('$0.10')).toBeDefined();
    expect(screen.getByText('$0.20')).toBeDefined();
    expect(screen.getByText('$0.30')).toBeDefined();
    expect(screen.getByText('$0.40')).toBeDefined();
    expect(screen.getByText('$0.50')).toBeDefined();
  });

  it('chips are color-coded (white, red, green, blue, black)', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-0.10').style.backgroundColor).toBe('#ffffff');
    expect(screen.getByTestId('chip-0.20').style.backgroundColor).toBe('#dc2626');
    expect(screen.getByTestId('chip-0.30').style.backgroundColor).toBe('#16a34a');
    expect(screen.getByTestId('chip-0.40').style.backgroundColor).toBe('#2563eb');
    expect(screen.getByTestId('chip-0.50').style.backgroundColor).toBe('#1a1a2e');
  });

  it('chips have min 56px dimensions for mobile', () => {
    render(<ChipPicker {...defaultProps} />);
    const chip = screen.getByTestId('chip-0.10');
    expect(chip.style.minWidth).toBe('56px');
    expect(chip.style.minHeight).toBe('56px');
  });

  it('displays running total starting at $0.00', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-total').textContent).toBe('$0.00');
  });

  it('tapping a chip adds its denomination to the total', () => {
    render(<ChipPicker {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chip-0.10'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$0.10');
  });

  it('tapping multiple chips accumulates the total', () => {
    render(<ChipPicker {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chip-0.10'));
    fireEvent.click(screen.getByTestId('chip-0.20'));
    fireEvent.click(screen.getByTestId('chip-0.50'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$0.80');
  });

  it('tapping the same chip multiple times accumulates', () => {
    render(<ChipPicker {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chip-0.50'));
    fireEvent.click(screen.getByTestId('chip-0.50'));
    fireEvent.click(screen.getByTestId('chip-0.50'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$1.50');
  });

  it('Clear button resets total to $0.00', () => {
    render(<ChipPicker {...defaultProps} />);
    fireEvent.click(screen.getByTestId('chip-0.50'));
    fireEvent.click(screen.getByTestId('chip-0.50'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$1.00');
    fireEvent.click(screen.getByTestId('chip-clear'));
    expect(screen.getByTestId('chip-total').textContent).toBe('$0.00');
  });

  it('Confirm button calls onConfirm with accumulated amount', () => {
    const onConfirm = vi.fn();
    render(<ChipPicker onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('chip-0.30'));
    fireEvent.click(screen.getByTestId('chip-0.20'));
    fireEvent.click(screen.getByTestId('chip-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(0.5);
  });

  it('Confirm button calls onConfirm with 0 when total is zero', () => {
    const onConfirm = vi.fn();
    render(<ChipPicker onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('chip-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(0);
  });

  it('renders Clear and Confirm buttons', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-clear')).toBeDefined();
    expect(screen.getByTestId('chip-confirm')).toBeDefined();
    expect(screen.getByTestId('chip-clear').textContent).toBe('Clear');
    expect(screen.getByTestId('chip-confirm').textContent).toBe('Confirm');
  });

  it('onCancel callback is triggered by Cancel button when provided', () => {
    const onCancel = vi.fn();
    render(<ChipPicker {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('chip-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not render Cancel button when onCancel is not provided', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.queryByTestId('chip-cancel')).toBeNull();
  });

  it('white chip has dark text for contrast', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-0.10').style.color).toBe('#111827');
  });

  it('non-white chips have white text for contrast', () => {
    render(<ChipPicker {...defaultProps} />);
    expect(screen.getByTestId('chip-0.20').style.color).toBe('#ffffff');
    expect(screen.getByTestId('chip-0.30').style.color).toBe('#ffffff');
    expect(screen.getByTestId('chip-0.40').style.color).toBe('#ffffff');
    expect(screen.getByTestId('chip-0.50').style.color).toBe('#ffffff');
  });

  it('onConfirm receives a precise value after float-prone accumulation', () => {
    const onConfirm = vi.fn();
    render(<ChipPicker onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('chip-0.10'));
    fireEvent.click(screen.getByTestId('chip-0.10'));
    fireEvent.click(screen.getByTestId('chip-0.10'));
    fireEvent.click(screen.getByTestId('chip-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(0.3);
  });
});
