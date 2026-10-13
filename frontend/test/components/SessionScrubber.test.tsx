/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SessionScrubber } from '../../src/../src/components/SessionScrubber.tsx';

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

  it('injects a style tag with 48px thumb sizing', () => {
    const { container } = render(
      <SessionScrubber handCount={5} currentHand={2} onChange={() => {}} />,
    );
    const styleTag = container.querySelector('style');
    expect(styleTag).toBeTruthy();
    expect(styleTag!.textContent).toContain('48px');
    expect(styleTag!.textContent).toContain('::-webkit-slider-thumb');
    expect(styleTag!.textContent).toContain('::-moz-range-thumb');
  });

  it('slider has data-testid for integration targeting', () => {
    render(<SessionScrubber handCount={5} currentHand={2} onChange={() => {}} />);
    const slider = screen.getByTestId('session-slider');
    expect(slider).toBeInTheDocument();
    expect(slider.getAttribute('type')).toBe('range');
  });

  it('calls onChange on input event for live drag responsiveness', () => {
    const spy = vi.fn();
    render(<SessionScrubber handCount={10} currentHand={1} onChange={spy} />);
    const slider = screen.getByTestId('session-slider');
    fireEvent.input(slider, { target: { value: '5' } });
    expect(spy).toHaveBeenCalledWith(5);
  });
});
