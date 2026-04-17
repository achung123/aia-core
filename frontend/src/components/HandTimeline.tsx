import { useState } from 'react';
import type React from 'react';
import { CardIcon } from './CardIcon';
import type { HandResponse } from '../api/types';

export interface HandTimelineProps {
  hands: HandResponse[];
}

function getWinnerName(hand: HandResponse): string | null {
  const winner = hand.player_hands.find((ph) => ph.result === 'won');
  return winner ? winner.player_name : null;
}

function getCommunityCards(hand: HandResponse): string[] {
  const cards: string[] = [];
  if (hand.flop_1 && hand.flop_2 && hand.flop_3) {
    cards.push(hand.flop_1, hand.flop_2, hand.flop_3);
    if (hand.turn) {
      cards.push(hand.turn);
      if (hand.river) {
        cards.push(hand.river);
      }
    }
  }
  return cards;
}

export function HandTimeline({ hands }: HandTimelineProps) {
  const [selectedHandId, setSelectedHandId] = useState<number | null>(null);

  if (hands.length === 0) {
    return (
      <div data-testid="hand-timeline-empty" style={{ color: '#999' }}>
        No hands to display.
      </div>
    );
  }

  const handleCardClick = (handId: number) => {
    setSelectedHandId((prev) => (prev === handId ? null : handId));
  };

  return (
    <div data-testid="hand-timeline" style={styles.timeline}>
      {hands.map((hand, index) => {
        const isSelected = selectedHandId === hand.hand_id;
        const winnerName = getWinnerName(hand);
        const communityCards = getCommunityCards(hand);

        return (
          <div key={hand.hand_id}>
            {/* Connector line between cards */}
            {index > 0 && (
              <div
                data-testid={`timeline-connector-${index}`}
                style={styles.connector}
              />
            )}

            {/* Timeline card */}
            <div
              data-testid={`timeline-card-${hand.hand_id}`}
              data-hand-number={hand.hand_number}
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => handleCardClick(hand.hand_id)}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
              }}
            >
              <div style={styles.cardHeader}>
                <span style={styles.handNumber}>Hand {hand.hand_number}</span>
                {hand.pot > 0 && <span style={styles.pot}>${hand.pot}</span>}
              </div>

              {communityCards.length > 0 && (
                <div data-testid={`community-cards-${hand.hand_id}`} style={styles.communityCards}>
                  {communityCards.map((card, i) => (
                    <CardIcon key={i} card={card} />
                  ))}
                </div>
              )}

              {winnerName && (
                <div style={styles.winner}>🏆 {winnerName}</div>
              )}
            </div>

            {/* Expanded details */}
            {isSelected && hand.player_hands.length > 0 && (
              <div data-testid={`hand-details-${hand.hand_id}`} style={styles.details}>
                {hand.player_hands.map((ph) => (
                  <div key={ph.player_hand_id} style={styles.playerRow}>
                    <div style={styles.playerName}>{ph.player_name}</div>
                    <div style={styles.playerCards}>
                      {ph.card_1 && <CardIcon card={ph.card_1} />}
                      {ph.card_2 && <CardIcon card={ph.card_2} />}
                    </div>
                    <div style={styles.playerResult}>
                      {ph.result && (
                        <span style={{
                          ...styles.resultBadge,
                          background: ph.result === 'won' ? '#dcfce7' : ph.result === 'folded' ? '#fef3c7' : '#fee2e2',
                          color: ph.result === 'won' ? '#166534' : ph.result === 'folded' ? '#92400e' : '#991b1b',
                        }}>
                          {ph.result}
                        </span>
                      )}
                    </div>
                    {ph.outcome_street && (
                      <div style={styles.outcomeStreet}>{ph.outcome_street}</div>
                    )}
                    {ph.winning_hand_description && (
                      <div style={styles.handDescription}>{ph.winning_hand_description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    overflowY: 'auto',
    maxHeight: '60vh',
    padding: '0.5rem 0',
  },
  connector: {
    width: 2,
    height: 16,
    background: '#cbd5e1',
    margin: '0 auto',
  },
  card: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    background: '#ffffff',
    transition: 'box-shadow 0.15s, border-color 0.15s',
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
  },
  cardSelected: {
    borderColor: '#3b82f6',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.3)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  handNumber: {
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  pot: {
    fontSize: '0.85rem',
    color: '#64748b',
    fontWeight: 500,
  },
  communityCards: {
    display: 'flex',
    gap: '0.25rem',
    marginTop: '0.25rem',
    flexWrap: 'wrap' as const,
  },
  winner: {
    marginTop: '0.35rem',
    fontSize: '0.85rem',
    color: '#166534',
    fontWeight: 500,
  },
  details: {
    borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    borderBottom: '1px solid #e2e8f0',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
    padding: '0.5rem 1rem',
    background: '#f8fafc',
    width: '100%',
    maxWidth: 480,
    margin: '0 auto',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.35rem 0',
    borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap' as const,
  },
  playerName: {
    fontWeight: 600,
    fontSize: '0.85rem',
    minWidth: 60,
  },
  playerCards: {
    display: 'flex',
    gap: '0.15rem',
  },
  playerResult: {
    fontSize: '0.8rem',
  },
  resultBadge: {
    padding: '0.1rem 0.4rem',
    borderRadius: 4,
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  outcomeStreet: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  handDescription: {
    fontSize: '0.75rem',
    color: '#475569',
    fontStyle: 'italic',
  },
};
