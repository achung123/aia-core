/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SessionScrubber } from './SessionScrubber.tsx';

afterEach(() => cleanup());

describe('SessionScrubber', () => {
  it('renders with correct label', () => {
    render(<SessionScrubber handCount={10} currentHand={3} onChange={() => {}} />);
    expect(screen.getByText('Hand 3 / 10')).toBeInTheDocument();
  });

  it('disables prev button on first hand', () => {
    render(<SessionScrubber handCount={5} currentHand={1} onChange={() => {}} />);
    expect(screen.getByTestId('session-prev')).toBeDisabled();
  });

  it('disables next button on last hand', () => {
    render(<SessionScrubber handCount={5} currentHand={5} onChange={() => {}} />);
    expect(screen.getByTestId('session-next')).toBeDisabled();
  });

  it('calls onChange with previous index when prev clicked', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={5} currentHand={3} onChange={spy} />);
    fireEvent.click(screen.getByTestId('session-prev'));
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('calls onChange with next index when next clicked', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={5} currentHand={3} onChange={spy} />);
    fireEvent.click(screen.getByTestId('session-next'));
    expect(spy).toHaveBeenCalledWith(4);
  });

  it('does not call onChange when prev clicked at hand 1', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={5} currentHand={1} onChange={spy} />);
    fireEvent.click(screen.getByTestId('session-prev'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call onChange when next clicked at last hand', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={5} currentHand={5} onChange={spy} />);
    fireEvent.click(screen.getByTestId('session-next'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('calls onChange when range slider changes', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={10} currentHand={1} onChange={spy} />);
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '7' } });
    expect(spy).toHaveBeenCalledWith(7);
  });

  it('renders SVG ticks matching hand count', () => {
    const { container } = render(
      <SessionScrubber handCount={4} currentHand={1} onChange={() => {}} />,
    );
    const lines = container.querySelectorAll('svg line');
    expect(lines.length).toBe(4);
  });
});
