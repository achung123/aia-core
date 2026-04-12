import type React from 'react';

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

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)',
  background: 'rgba(0,0,0,0.85)',
  color: '#fff',
  borderRadius: '8px',
  padding: '20px',
  minWidth: '320px',
  zIndex: 100,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '14px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.1em',
  fontWeight: 'bold',
  letterSpacing: '0.04em',
};

const dismissStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid #888',
  color: '#ccc',
  padding: '3px 10px',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.9em',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const headRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #555',
  color: '#aaa',
  fontSize: '0.85em',
};

const thStyle: React.CSSProperties = {
  padding: '4px 10px',
  textAlign: 'left',
  fontWeight: 'normal',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
};

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
