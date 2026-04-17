/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { KeyMomentsSection } from '../../src/components/KeyMomentsSection';
import type { GameHighlight } from '../../src/api/types';

afterEach(() => cleanup());

const makeHighlight = (overrides: Partial<GameHighlight> = {}): GameHighlight => ({
  hand_number: 1,
  highlight_type: 'most_action',
  description: 'Hand 1: 4 players saw action',
  ...overrides,
});

describe('KeyMomentsSection', () => {
  it('returns null and hides section when highlights are empty', () => {
    const { container } = render(<KeyMomentsSection highlights={[]} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByTestId('key-moments-section')).toBeNull();
  });

  it('renders the section when highlights exist', () => {
    render(<KeyMomentsSection highlights={[makeHighlight()]} />);
    expect(screen.getByTestId('key-moments-section')).toBeTruthy();
  });

  it('renders a chip for each highlight', () => {
    const highlights = [
      makeHighlight({ hand_number: 1, description: 'First' }),
      makeHighlight({ hand_number: 3, highlight_type: 'river_showdown', description: 'Second' }),
      makeHighlight({ hand_number: 5, highlight_type: 'streak_start', description: 'Third' }),
    ];
    render(<KeyMomentsSection highlights={highlights} />);
    expect(screen.getByTestId('highlight-chip-0')).toBeTruthy();
    expect(screen.getByTestId('highlight-chip-1')).toBeTruthy();
    expect(screen.getByTestId('highlight-chip-2')).toBeTruthy();
  });

  it('displays description text in each chip', () => {
    const highlights = [
      makeHighlight({ description: 'Hand 2: 5 players saw action' }),
    ];
    render(<KeyMomentsSection highlights={highlights} />);
    expect(screen.getByTestId('highlight-chip-0').textContent).toContain('Hand 2: 5 players saw action');
  });

  it('displays type icon for most_action', () => {
    render(<KeyMomentsSection highlights={[makeHighlight({ highlight_type: 'most_action' })]} />);
    expect(screen.getByTestId('highlight-chip-0').textContent).toContain('🔥');
  });

  it('displays type icon for river_showdown', () => {
    render(<KeyMomentsSection highlights={[makeHighlight({ highlight_type: 'river_showdown' })]} />);
    expect(screen.getByTestId('highlight-chip-0').textContent).toContain('🃏');
  });

  it('displays type icon for streak_start', () => {
    render(<KeyMomentsSection highlights={[makeHighlight({ highlight_type: 'streak_start' })]} />);
    expect(screen.getByTestId('highlight-chip-0').textContent).toContain('🏆');
  });

  it('displays fallback icon for unknown type', () => {
    render(<KeyMomentsSection highlights={[makeHighlight({ highlight_type: 'unknown_type' })]} />);
    expect(screen.getByTestId('highlight-chip-0').textContent).toContain('⭐');
  });

  it('calls onHighlightClick with hand_number when chip is clicked', () => {
    const onClick = vi.fn();
    const highlights = [makeHighlight({ hand_number: 7 })];
    render(<KeyMomentsSection highlights={highlights} onHighlightClick={onClick} />);
    fireEvent.click(screen.getByTestId('highlight-chip-0'));
    expect(onClick).toHaveBeenCalledWith(7);
  });

  it('limits chips to 5 even if more highlights are provided', () => {
    const highlights = Array.from({ length: 7 }, (_, i) =>
      makeHighlight({ hand_number: i + 1, description: `Highlight ${i + 1}` }),
    );
    render(<KeyMomentsSection highlights={highlights} />);
    expect(screen.getByTestId('highlight-chip-4')).toBeTruthy();
    expect(screen.queryByTestId('highlight-chip-5')).toBeNull();
  });
});
