import { useMemo } from 'react';
import type React from 'react';

export interface PlayerHandStat {
  player_name: string;
  profit_loss: number | null;
}

export interface HandStat {
  pot?: number | null;
  player_hands?: PlayerHandStat[];
}

export interface StatsSidebarProps {
  hands: HandStat[];
  currentHandIndex: number; // 1-based
}

const sidebarStyle: React.CSSProperties = {
  padding: '12px',
  background: '#1a1a1a',
  minWidth: '200px',
  color: '#ccc',
  fontSize: '13px',
};

const headerStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  color: '#fff',
  fontSize: '15px',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '4px 6px',
  borderBottom: '1px solid #333',
  color: '#fff',
};

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid #222',
};

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
};

const summaryStyle: React.CSSProperties = {
  padding: '6px 6px 2px 6px',
  color: '#aaa',
  fontStyle: 'italic',
};

const summaryRightStyle: React.CSSProperties = {
  ...summaryStyle,
  textAlign: 'right',
};

function formatPL(value: number | null): string {
  if (value === null || value === undefined) return '\u2014';
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

interface PlayerStats {
  name: string;
  total: number;
  allNull: boolean;
}

export function StatsSidebar({ hands, currentHandIndex }: StatsSidebarProps) {
  const { players, handsCompleted, totalPot } = useMemo(() => {
    const sliceEnd = currentHandIndex;
    const playerTotals: Record<string, number> = {};
    const playerAllNull: Record<string, boolean> = {};
    let pot = 0;
    let completed = 0;

    for (let i = 0; i < sliceEnd && i < hands.length; i++) {
      const hand = hands[i];
      completed += 1;
      pot += hand.pot != null ? hand.pot : 0;

      if (hand.player_hands) {
        for (const playerHand of hand.player_hands) {
          const name = playerHand.player_name;
          if (!(name in playerTotals)) {
            playerTotals[name] = 0;
            playerAllNull[name] = true;
          }
          if (playerHand.profit_loss != null) {
            playerTotals[name] += playerHand.profit_loss;
            playerAllNull[name] = false;
          }
        }
      }
    }

    const sorted: PlayerStats[] = Object.keys(playerTotals)
      .map(name => ({ name, total: playerTotals[name], allNull: playerAllNull[name] }))
      .sort((a, b) => {
        if (a.allNull && b.allNull) return 0;
        if (a.allNull) return 1;
        if (b.allNull) return -1;
        return b.total - a.total;
      });

    return { players: sorted, handsCompleted: completed, totalPot: pot };
  }, [hands, currentHandIndex]);

  return (
    <div className="stats-sidebar" style={sidebarStyle}>
      <h3 style={headerStyle}>Stats</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Player</th>
            <th style={thRightStyle}>P/L</th>
          </tr>
        </thead>
        <tbody>
          {players.map(playerStats => (
            <tr key={playerStats.name}>
              <td style={tdStyle}>{playerStats.name}</td>
              <td
                style={{
                  ...tdRightStyle,
                  ...(playerStats.allNull ? {} : { color: playerStats.total >= 0 ? '#4caf50' : '#f44336' }),
                }}
              >
                {playerStats.allNull ? '\u2014' : formatPL(playerStats.total)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={summaryStyle}>Hands: {handsCompleted}</td>
            <td style={summaryRightStyle}>Total pot: ${totalPot.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
