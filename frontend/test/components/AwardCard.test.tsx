/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AwardCard } from '../../src/components/AwardCard.tsx';

describe('AwardCard', () => {
  it('renders emoji, award name, winner name, stat value, and stat label', () => {
    render(
      <AwardCard
        emoji="🏆"
        awardName="Biggest Winner"
        winnerName="Alice"
        statValue={250}
        statLabel="profit"
      />
    );
    expect(screen.getByText('🏆')).toBeTruthy();
    expect(screen.getByText('Biggest Winner')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('$250.00')).toBeTruthy();
    expect(screen.getByText('profit')).toBeTruthy();
  });

  it('renders string stat value', () => {
    render(
      <AwardCard
        emoji="🎯"
        awardName="Best Accuracy"
        winnerName="Bob"
        statValue="92%"
        statLabel="accuracy"
      />
    );
    expect(screen.getByText('92%')).toBeTruthy();
  });

  it('renders dash placeholder for null statValue', () => {
    render(
      <AwardCard
        emoji="💰"
        awardName="Most Pots Won"
        winnerName="Charlie"
        statValue={null}
        statLabel="pots"
      />
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders zero statValue with muted style', () => {
    render(
      <AwardCard
        emoji="📊"
        awardName="Hands Won"
        winnerName="Dana"
        statValue={0}
        statLabel="hands"
      />
    );
    const valueEl = screen.getByText('0');
    expect(valueEl).toBeTruthy();
    expect((valueEl as HTMLElement).style.color).toBe('#9ca3af');
  });

  it('applies muted style for null statValue', () => {
    const { container } = render(
      <AwardCard
        emoji="🃏"
        awardName="Bluffs"
        winnerName="Eve"
        statValue={null}
        statLabel="bluffs"
      />
    );
    const spans = container.querySelectorAll('span');
    const valueSpan = Array.from(spans).find(s => s.textContent === '—') as HTMLElement;
    expect(valueSpan).toBeTruthy();
    expect(valueSpan.style.color).toBe('#9ca3af');
  });

  it('renders all required fields when provided', () => {
    const { container } = render(
      <AwardCard
        emoji="🔥"
        awardName="Hot Streak"
        winnerName="Frank"
        statValue={7}
        statLabel="wins in a row"
      />
    );
    expect(container.firstElementChild).toBeTruthy();
  });

  it('formats dollar values for profit stat_label', () => {
    render(
      <AwardCard
        emoji="💰"
        awardName="Big Stack"
        winnerName="Alice"
        statValue={250.5}
        statLabel="profit"
      />
    );
    expect(screen.getByText('$250.50')).toBeTruthy();
  });

  it('formats dollar values for loss stat_label', () => {
    render(
      <AwardCard
        emoji="🎰"
        awardName="Degen"
        winnerName="Bob"
        statValue={-80.5}
        statLabel="loss"
      />
    );
    expect(screen.getByText('-$80.50')).toBeTruthy();
  });

  it('does not add dollar sign for non-monetary stat_labels', () => {
    const { container } = render(
      <AwardCard
        emoji="🔥"
        awardName="Hot Streak"
        winnerName="Frank"
        statValue={7}
        statLabel="wins in a row"
      />
    );
    const statSpans = container.querySelectorAll('span');
    const valueSpan = Array.from(statSpans).find(s => s.textContent === '7');
    expect(valueSpan).toBeTruthy();
    // Should not contain a dollar sign anywhere in this card
    expect(container.textContent).not.toContain('$');
  });
});
