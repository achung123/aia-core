import type React from 'react';
import {
  resultOverlayStyle as overlayStyle,
  resultHeaderStyle as headerStyle,
  resultTitleStyle as titleStyle,
  resultDismissButtonStyle as dismissStyle,
  resultTableStyle as tableStyle,
  resultHeadRowStyle as headRowStyle,
  resultHeaderCellStyle as thStyle,
  resultDataCellStyle as tdStyle,
} from '../styles/resultOverlayStyles';

const SUIT_SYMBOLS: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };

export interface Card {
  rank: string;
  suit: string;
}

export interface PlayerHandResult {
  player_name: string;
  hole_cards?: Card[];
  result?: string | null;
  profit_loss?: number | null;
}

export interface ResultHandData {
  player_hands?: PlayerHandResult[];
}

export interface ResultOverlayProps {
  handData: ResultHandData | null;
  visible: boolean;
  onDismiss: () => void;
}

function formatCard(card: Card): string {
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  return `${card.rank}${symbol}`;
}

function formatPL(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

function CardSpan({ card }: { card: Card }) {
  const isRed = card.suit === 'H' || card.suit === 'D';
  return <span style={{ color: isRed ? '#ff6666' : '#f0f0f0' }}>{formatCard(card)}</span>;
}

function PlayerRow({ player, isWinner }: { player: PlayerHandResult; isWinner: boolean }) {
  const rowStyle: React.CSSProperties = isWinner
    ? { background: '#b8860b', fontWeight: 'bold' }
    : {};

  const hasCards = player.hole_cards && player.hole_cards.length > 0;

  return (
    <tr style={rowStyle}>
      <td style={tdStyle}>{player.player_name}</td>
      <td style={tdStyle}>
        {hasCards
          ? player.hole_cards!.map((card, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <CardSpan card={card} />
              </span>
            ))
          : '—'}
      </td>
      <td style={{ ...tdStyle, textTransform: 'capitalize' }}>{player.result || '—'}</td>
      <td
        style={{
          ...tdStyle,
          ...(player.profit_loss != null
            ? { color: player.profit_loss >= 0 ? '#66ff99' : '#ff6666' }
            : {}),
        }}
      >
        {formatPL(player.profit_loss)}
      </td>
    </tr>
  );
}

export function ResultOverlay({ handData, visible, onDismiss }: ResultOverlayProps) {
  if (!visible) return null;

  const players = handData?.player_hands ?? [];

  return (
    <div className="result-overlay" style={overlayStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Showdown Results</span>
        <button style={dismissStyle} onClick={onDismiss}>
          ✕ Dismiss
        </button>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr style={headRowStyle}>
            {['Player', 'Cards', 'Result', 'P/L'].map(label => (
              <th key={label} style={thStyle}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(player => (
            <PlayerRow
              key={player.player_name}
              player={player}
              isWinner={player.result === 'win'}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
