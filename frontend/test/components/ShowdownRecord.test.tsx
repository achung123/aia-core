/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ShowdownRecord } from '../../src/components/ShowdownRecord';

afterEach(cleanup);

describe('ShowdownRecord', () => {
  it('renders player names in the hero section', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={6}
        player2Wins={4}
        showdownCount={10}
      />,
    );
    expect(screen.getByTestId('showdown-hero')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('displays win/loss tally', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={6}
        player2Wins={4}
        showdownCount={10}
      />,
    );
    expect(screen.getByTestId('p1-wins').textContent).toBe('6');
    expect(screen.getByTestId('p2-wins').textContent).toBe('4');
  });

  it('renders a split gauge showing win ratio', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={6}
        player2Wins={4}
        showdownCount={10}
      />,
    );
    const gauge = screen.getByTestId('showdown-gauge');
    expect(gauge).toBeTruthy();
    // Player1 has 60% = 6/10
    const p1Bar = screen.getByTestId('gauge-p1');
    expect(p1Bar.style.width).toBe('60%');
  });

  it('shows rivalry verdict when one player dominates (>60%)', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={8}
        player2Wins={2}
        showdownCount={10}
      />,
    );
    const verdict = screen.getByTestId('rivalry-verdict');
    expect(verdict).toBeTruthy();
    expect(verdict.textContent).toContain('Alice');
    expect(verdict.textContent?.toLowerCase()).toContain('dominat');
  });

  it('does not show rivalry verdict when win rate is ≤60%', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={6}
        player2Wins={4}
        showdownCount={10}
      />,
    );
    expect(screen.queryByTestId('rivalry-verdict')).toBeNull();
  });

  it('shows rivalry verdict for player2 dominance', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={2}
        player2Wins={8}
        showdownCount={10}
      />,
    );
    const verdict = screen.getByTestId('rivalry-verdict');
    expect(verdict.textContent).toContain('Bob');
  });

  it('handles zero showdowns gracefully', () => {
    render(
      <ShowdownRecord
        player1Name="Alice"
        player2Name="Bob"
        player1Wins={0}
        player2Wins={0}
        showdownCount={0}
      />,
    );
    expect(screen.getByTestId('showdown-hero')).toBeTruthy();
    expect(screen.getByTestId('p1-wins').textContent).toBe('0');
    expect(screen.getByTestId('p2-wins').textContent).toBe('0');
  });
});
