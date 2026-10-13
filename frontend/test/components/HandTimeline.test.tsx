/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { HandTimeline } from '../../src/components/HandTimeline';
import type { HandResponse } from '../../src/api/types';

afterEach(() => cleanup());

const baseHand = (overrides: Partial<HandResponse> = {}): HandResponse => ({
  hand_id: 1,
  game_id: 1,
  hand_number: 1,
  flop_1: null,
  flop_2: null,
  flop_3: null,
  turn: null,
  river: null,
  source_upload_id: null,
  sb_player_name: null,
  bb_player_name: null,
  pot: 0,
  side_pots: [],
  created_at: '2025-04-01T12:00:00Z',
  player_hands: [],
  ...overrides,
});

describe('HandTimeline', () => {
  it('renders a timeline card for each hand', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1 }),
      baseHand({ hand_id: 2, hand_number: 2 }),
      baseHand({ hand_id: 3, hand_number: 3 }),
    ];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1')).toBeTruthy();
    expect(screen.getByTestId('timeline-card-2')).toBeTruthy();
    expect(screen.getByTestId('timeline-card-3')).toBeTruthy();
  });

  it('displays hand number on each card', () => {
    const hands = [baseHand({ hand_id: 1, hand_number: 7 })];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1').textContent).toContain('Hand 7');
  });

  it('displays winner name on the card', () => {
    const hands = [
      baseHand({
        hand_id: 1,
        hand_number: 1,
        player_hands: [
          { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'AH', card_2: 'KH', result: 'won', profit_loss: 50, outcome_street: 'river', winning_hand_description: 'Flush' },
          { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '9D', card_2: '8D', result: 'lost', profit_loss: -25, outcome_street: 'river', winning_hand_description: null },
        ],
      }),
    ];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1').textContent).toContain('Alice');
  });

  it('renders community cards via CardIcon when flop exists', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1, flop_1: 'AH', flop_2: 'KD', flop_3: '3C' }),
    ];
    render(<HandTimeline hands={hands} />);
    const card = screen.getByTestId('timeline-card-1');
    // CardIcon renders suit symbols
    expect(card.textContent).toContain('A♥');
    expect(card.textContent).toContain('K♦');
    expect(card.textContent).toContain('3♣');
  });

  it('renders turn card when present', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1, flop_1: 'AH', flop_2: 'KD', flop_3: '3C', turn: '7S' }),
    ];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1').textContent).toContain('7♠');
  });

  it('renders river card when present', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1, flop_1: 'AH', flop_2: 'KD', flop_3: '3C', turn: '7S', river: 'QH' }),
    ];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1').textContent).toContain('Q♥');
  });

  it('does not render community cards section when no flop exists', () => {
    const hands = [baseHand({ hand_id: 1, hand_number: 1 })];
    render(<HandTimeline hands={hands} />);
    expect(screen.queryByTestId('community-cards-1')).toBeNull();
  });

  it('does not render turn slot when turn is null', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1, flop_1: '2H', flop_2: '3D', flop_3: '4C', turn: null }),
    ];
    render(<HandTimeline hands={hands} />);
    const communityCards = screen.getByTestId('community-cards-1');
    // Only 3 CardIcon children (the flop cards)
    const cardSpans = communityCards.querySelectorAll('span');
    expect(cardSpans.length).toBe(3);
  });

  it('clicking a card expands it to show player details', () => {
    const hands = [
      baseHand({
        hand_id: 1,
        hand_number: 1,
        player_hands: [
          { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'AH', card_2: 'KH', result: 'won', profit_loss: 50, outcome_street: 'river', winning_hand_description: 'Flush' },
          { player_hand_id: 2, hand_id: 1, player_id: 2, player_name: 'Bob', card_1: '9D', card_2: '8D', result: 'folded', profit_loss: -25, outcome_street: 'flop', winning_hand_description: null },
        ],
      }),
    ];
    render(<HandTimeline hands={hands} />);

    // Details not visible before click
    expect(screen.queryByTestId('hand-details-1')).toBeNull();

    // Click the card
    fireEvent.click(screen.getByTestId('timeline-card-1'));

    // Details now visible
    const details = screen.getByTestId('hand-details-1');
    expect(details).toBeTruthy();
    expect(details.textContent).toContain('Alice');
    expect(details.textContent).toContain('Bob');
    expect(details.textContent).toContain('A♥');
    expect(details.textContent).toContain('K♥');
    expect(details.textContent).toContain('9♦');
    expect(details.textContent).toContain('8♦');
    expect(details.textContent).toContain('won');
    expect(details.textContent).toContain('folded');
    expect(details.textContent).toContain('river');
    expect(details.textContent).toContain('flop');
  });

  it('clicking an expanded card collapses it', () => {
    const hands = [
      baseHand({
        hand_id: 1,
        hand_number: 1,
        player_hands: [
          { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'AH', card_2: 'KH', result: 'won', profit_loss: 50, outcome_street: 'river', winning_hand_description: null },
        ],
      }),
    ];
    render(<HandTimeline hands={hands} />);

    fireEvent.click(screen.getByTestId('timeline-card-1'));
    expect(screen.getByTestId('hand-details-1')).toBeTruthy();

    fireEvent.click(screen.getByTestId('timeline-card-1'));
    expect(screen.queryByTestId('hand-details-1')).toBeNull();
  });

  it('highlights the selected/expanded card', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1 }),
      baseHand({ hand_id: 2, hand_number: 2 }),
    ];
    render(<HandTimeline hands={hands} />);

    fireEvent.click(screen.getByTestId('timeline-card-1'));
    const card1 = screen.getByTestId('timeline-card-1');
    expect(card1.getAttribute('data-selected')).toBe('true');

    const card2 = screen.getByTestId('timeline-card-2');
    expect(card2.getAttribute('data-selected')).toBe('false');
  });

  it('renders the timeline container as scrollable', () => {
    const hands = [baseHand({ hand_id: 1, hand_number: 1 })];
    render(<HandTimeline hands={hands} />);
    const container = screen.getByTestId('hand-timeline');
    expect(container).toBeTruthy();
  });

  it('renders connector lines between cards', () => {
    const hands = [
      baseHand({ hand_id: 1, hand_number: 1 }),
      baseHand({ hand_id: 2, hand_number: 2 }),
    ];
    render(<HandTimeline hands={hands} />);
    // Connector exists between cards (not before first or after last)
    const connectors = screen.getByTestId('hand-timeline').querySelectorAll('[data-testid^="timeline-connector-"]');
    expect(connectors.length).toBe(1);
  });

  it('shows winning hand description in expanded details when present', () => {
    const hands = [
      baseHand({
        hand_id: 1,
        hand_number: 1,
        player_hands: [
          { player_hand_id: 1, hand_id: 1, player_id: 1, player_name: 'Alice', card_1: 'AH', card_2: 'KH', result: 'won', profit_loss: 50, outcome_street: 'river', winning_hand_description: 'Royal Flush' },
        ],
      }),
    ];
    render(<HandTimeline hands={hands} />);
    fireEvent.click(screen.getByTestId('timeline-card-1'));
    expect(screen.getByTestId('hand-details-1').textContent).toContain('Royal Flush');
  });

  it('renders empty state when hands array is empty', () => {
    render(<HandTimeline hands={[]} />);
    expect(screen.getByTestId('hand-timeline-empty')).toBeTruthy();
  });

  it('shows pot amount on the card', () => {
    const hands = [baseHand({ hand_id: 1, hand_number: 1, pot: 250 })];
    render(<HandTimeline hands={hands} />);
    expect(screen.getByTestId('timeline-card-1').textContent).toContain('$250');
  });
});
