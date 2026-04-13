/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SeatPicker } from './SeatPicker.tsx';
import type { SeatData } from './SeatPicker.tsx';

afterEach(() => {
  cleanup();
});

const SEATS: SeatData[] = [
  { seatNumber: 1, playerName: 'Alice' },
  { seatNumber: 2, playerName: null },
  { seatNumber: 3, playerName: 'Bob' },
  { seatNumber: 4, playerName: null },
  { seatNumber: 5, playerName: null },
  { seatNumber: 6, playerName: null },
  { seatNumber: 7, playerName: 'Charlie' },
  { seatNumber: 8, playerName: null },
  { seatNumber: 9, playerName: null },
  { seatNumber: 10, playerName: null },
];

describe('SeatPicker', () => {
  // AC1: renders 10 seats in an oval
  it('renders 10 seats', () => {
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByTestId(`seat-${i}`)).toBeTruthy();
    }
  });

  // AC1: occupied seats show names and are disabled
  it('occupied seats show player names and are disabled', () => {
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    const seat1 = screen.getByTestId('seat-1') as HTMLButtonElement;
    expect(seat1.textContent).toContain('Alice');
    expect(seat1.disabled).toBe(true);

    const seat3 = screen.getByTestId('seat-3') as HTMLButtonElement;
    expect(seat3.textContent).toContain('Bob');
    expect(seat3.disabled).toBe(true);

    const seat7 = screen.getByTestId('seat-7') as HTMLButtonElement;
    expect(seat7.textContent).toContain('Charlie');
    expect(seat7.disabled).toBe(true);
  });

  // AC1: open seats are tappable
  it('open seats are enabled and show "Open"', () => {
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    const seat2 = screen.getByTestId('seat-2') as HTMLButtonElement;
    expect(seat2.textContent).toContain('Open');
    expect(seat2.disabled).toBe(false);

    const seat4 = screen.getByTestId('seat-4') as HTMLButtonElement;
    expect(seat4.disabled).toBe(false);
  });

  it('calls onSelect when an open seat is clicked', () => {
    const onSelect = vi.fn();
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={onSelect} onSkip={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('seat-4'));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('does not call onSelect when an occupied seat is clicked', () => {
    const onSelect = vi.fn();
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={onSelect} onSkip={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('seat-1'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('highlights the current player seat', () => {
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={3} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    const seat3 = screen.getByTestId('seat-3');
    expect(seat3.style.border).toContain('4f46e5');
  });

  it('calls onSkip when skip button is clicked', () => {
    const onSkip = vi.fn();
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={onSkip} />,
    );
    fireEvent.click(screen.getByTestId('skip-seat-btn'));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('renders 10 seats even when fewer seats are provided', () => {
    const partial: SeatData[] = [
      { seatNumber: 1, playerName: 'Alice' },
      { seatNumber: 5, playerName: 'Bob' },
    ];
    render(
      <SeatPicker seats={partial} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByTestId(`seat-${i}`)).toBeTruthy();
    }
    // Seats not in partial list are open
    expect((screen.getByTestId('seat-2') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('seat-2').textContent).toContain('Open');
  });

  it('has accessible labels for each seat', () => {
    render(
      <SeatPicker seats={SEATS} currentPlayerSeat={null} onSelect={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(screen.getByLabelText('Seat 1: Alice')).toBeTruthy();
    expect(screen.getByLabelText('Seat 2: Open')).toBeTruthy();
  });
});
