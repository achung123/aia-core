/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { StreetScrubber, STREETS } from '../../src/../src/components/StreetScrubber.tsx';

afterEach(() => cleanup());

const FULL_HAND = {
  flop_1: 'AH',
  flop_2: 'KD',
  flop_3: 'QC',
  turn: 'JS',
  river: 'TH',
};

const FLOP_ONLY = {
  flop_1: 'AH',
  flop_2: 'KD',
  flop_3: 'QC',
  turn: null,
  river: null,
};

describe('StreetScrubber', () => {
  it('exports STREETS array', () => {
    expect(STREETS).toEqual(['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown']);
  });

  it('renders all five street buttons', () => {
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={() => {}} />,
    );
    expect(screen.getByTestId('street-scrubber')).toBeTruthy();
    expect(screen.getAllByRole('button').length).toBe(5);
  });

  it('highlights the active street', () => {
    render(
      <StreetScrubber currentStreet="Flop" handData={FULL_HAND} onStreetChange={() => {}} />,
    );
    const flopBtn = screen.getByTestId('street-flop');
    expect(flopBtn.style.background).toBe('#3a3a6e');
    expect(flopBtn.style.color).toBe('#fff');
  });

  it('disables turn button when turn is null', () => {
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY} onStreetChange={() => {}} />,
    );
    expect(screen.getByTestId('street-turn')).toBeDisabled();
  });

  it('disables river button when river is null', () => {
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY} onStreetChange={() => {}} />,
    );
    expect(screen.getByTestId('street-river')).toBeDisabled();
  });

  it('calls onStreetChange when a street button is clicked', () => {
    const spy = vi.fn();
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FULL_HAND} onStreetChange={spy} />,
    );
    fireEvent.click(screen.getByTestId('street-flop'));
    expect(spy).toHaveBeenCalledWith('Flop');
  });

  it('does not call onStreetChange when disabled button is clicked', () => {
    const spy = vi.fn();
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY} onStreetChange={spy} />,
    );
    fireEvent.click(screen.getByTestId('street-turn'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('dims disabled buttons', () => {
    render(
      <StreetScrubber currentStreet="Pre-Flop" handData={FLOP_ONLY} onStreetChange={() => {}} />,
    );
    expect(screen.getByTestId('street-turn').style.opacity).toBe('0.35');
  });
});
