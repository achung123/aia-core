/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { EquityOverlay } from '../../src/../src/components/EquityOverlay.tsx';

afterEach(() => cleanup());

describe('EquityOverlay', () => {
  it('renders badges for each seat', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={3}
        equityMap={{ Alice: 0.65, Bob: 0.35 }}
        seatPlayerMap={{ 0: 'Alice', 1: 'Bob' }}
      />,
    );
    const badges = container.querySelectorAll('.equity-badge');
    expect(badges.length).toBe(3);
  });

  it('shows percentage for mapped seats', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={2}
        equityMap={{ Alice: 0.65, Bob: 0.35 }}
        seatPlayerMap={{ 0: 'Alice', 1: 'Bob' }}
      />,
    );
    const badges = container.querySelectorAll('.equity-badge');
    expect(badges[0].textContent).toBe('65.0%');
    expect(badges[1].textContent).toBe('35.0%');
  });

  it('hides badges for unmapped seats', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={3}
        equityMap={{ Alice: 0.65 }}
        seatPlayerMap={{ 0: 'Alice' }}
      />,
    );
    const badges = container.querySelectorAll('.equity-badge');
    expect((badges[0] as HTMLElement).style.display).not.toBe('none');
    expect((badges[1] as HTMLElement).style.display).toBe('none');
    expect((badges[2] as HTMLElement).style.display).toBe('none');
  });

  it('applies hue-based background color', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={1}
        equityMap={{ Alice: 1.0 }}
        seatPlayerMap={{ 0: 'Alice' }}
      />,
    );
    const badge = container.querySelector('.equity-badge') as HTMLElement;
    // equity=1.0 → hue=120 (green)
    expect(badge.style.background).toContain('120');
  });

  it('applies seat positions when provided', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={2}
        equityMap={{ Alice: 0.5, Bob: 0.5 }}
        seatPlayerMap={{ 0: 'Alice', 1: 'Bob' }}
        seatPositions={[
          { x: 100, y: 200 },
          { x: 300, y: 400 },
        ]}
      />,
    );
    const badges = container.querySelectorAll('.equity-badge') as NodeListOf<HTMLElement>;
    expect(badges[0].style.left).toBe('100px');
    expect(badges[0].style.top).toBe('200px');
    expect(badges[1].style.left).toBe('300px');
    expect(badges[1].style.top).toBe('400px');
  });

  it('hides all badges when equityMap is empty', () => {
    const { container } = render(
      <EquityOverlay
        seatCount={2}
        equityMap={{}}
        seatPlayerMap={{ 0: 'Alice', 1: 'Bob' }}
      />,
    );
    const badges = container.querySelectorAll('.equity-badge') as NodeListOf<HTMLElement>;
    badges.forEach(badge => {
      expect(badge.style.display).toBe('none');
    });
  });
});
