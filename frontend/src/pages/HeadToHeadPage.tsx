import { useState, useEffect, useCallback } from 'react';
import { PlayerSelector } from '../components/PlayerSelector';
import { ShowdownRecord } from '../components/ShowdownRecord';
import { FoldBehaviorChart } from '../components/FoldBehaviorChart';
import { StreetRivalryChart } from '../components/StreetRivalryChart';
import { useHeadToHead } from '../hooks/useAnalytics';

const STORAGE_KEY = 'h2h-recent-pairs';
const MAX_RECENT = 5;

function loadRecentPairs(): [string, string][] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentPair(p1: string, p2: string) {
  const pairs = loadRecentPairs();
  const key = `${p1}|${p2}`;
  const filtered = pairs.filter((pair) => `${pair[0]}|${pair[1]}` !== key);
  filtered.unshift([p1, p2]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
}

export function HeadToHeadPage() {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [recentPairs, setRecentPairs] = useState<[string, string][]>(loadRecentPairs);

  const bothSelected = !!player1 && !!player2;
  const { data, isLoading } = useHeadToHead(player1, player2);

  useEffect(() => {
    if (bothSelected) {
      saveRecentPair(player1, player2);
      setRecentPairs(loadRecentPairs());
    }
  }, [player1, player2, bothSelected]);

  const handleSwap = useCallback(() => {
    setPlayer1(player2);
    setPlayer2(player1);
  }, [player1, player2]);

  function handleQuickPick(p1: string, p2: string) {
    setPlayer1(p1);
    setPlayer2(p2);
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
      <h1>Head-to-Head</h1>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <PlayerSelector onSelect={setPlayer1} value={player1} placeholder="Player 1" />
        </div>
        <button
          data-testid="h2h-swap-btn"
          onClick={handleSwap}
          style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', alignSelf: 'flex-start' }}
          aria-label="Swap players"
        >
          ⇄
        </button>
        <div style={{ flex: 1 }}>
          <PlayerSelector onSelect={setPlayer2} value={player2} placeholder="Player 2" />
        </div>
      </div>

      {recentPairs.length > 0 && (
        <div data-testid="h2h-recent-pairs" style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>Recent: </span>
          {recentPairs.map(([p1, p2]) => (
            <button
              key={`${p1}-${p2}`}
              onClick={() => handleQuickPick(p1, p2)}
              style={{
                marginRight: '0.5rem',
                padding: '4px 8px',
                fontSize: '0.875rem',
                cursor: 'pointer',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: '#f5f5f5',
              }}
            >
              {p1} vs {p2}
            </button>
          ))}
        </div>
      )}

      {!bothSelected && (
        <div data-testid="h2h-placeholder" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
          Select two players to compare head-to-head stats.
        </div>
      )}

      {bothSelected && isLoading && (
        <div data-testid="h2h-loading" style={{ textAlign: 'center', padding: '2rem' }}>
          Loading...
        </div>
      )}

      {bothSelected && data && (
        <div data-testid="h2h-results">
          <h2>{data.player1_name} vs {data.player2_name}</h2>

          <ShowdownRecord
            player1Name={data.player1_name}
            player2Name={data.player2_name}
            player1Wins={data.player1_showdown_wins}
            player2Wins={data.player2_showdown_wins}
            showdownCount={data.showdown_count}
          />

          <FoldBehaviorChart
            player1Name={data.player1_name}
            player2Name={data.player2_name}
            player1FoldRate={data.player1_fold_rate}
            player2FoldRate={data.player2_fold_rate}
          />

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>{data.player1_name}</th>
                <th style={thStyle}>{data.player2_name}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}>Shared Hands</td>
                <td style={tdStyle} colSpan={2}>{data.shared_hands_count}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Showdowns</td>
                <td style={tdStyle} colSpan={2}>{data.showdown_count}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Showdown Wins</td>
                <td style={tdStyle}>{data.player1_showdown_wins}</td>
                <td style={tdStyle}>{data.player2_showdown_wins}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Folds</td>
                <td style={tdStyle}>{data.player1_fold_count}</td>
                <td style={tdStyle}>{data.player2_fold_count}</td>
              </tr>
              <tr>
                <td style={tdStyle}>Fold Rate</td>
                <td style={tdStyle}>{data.player1_fold_rate}%</td>
                <td style={tdStyle}>{data.player2_fold_rate}%</td>
              </tr>
            </tbody>
          </table>

          {data.street_breakdown.length > 0 && (
            <>
              <StreetRivalryChart
                player1Name={data.player1_name}
                player2Name={data.player2_name}
                streetBreakdown={data.street_breakdown}
              />

              <h3>By Street</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Street</th>
                    <th style={thStyle}>Hands Ended</th>
                    <th style={thStyle}>{data.player1_name} Wins</th>
                    <th style={thStyle}>{data.player2_name} Wins</th>
                  </tr>
                </thead>
                <tbody>
                  {data.street_breakdown.map((sb) => (
                    <tr key={sb.street}>
                      <td style={tdStyle}>{sb.street}</td>
                      <td style={tdStyle}>{sb.hands_ended}</td>
                      <td style={tdStyle}>{sb.player1_wins}</td>
                      <td style={tdStyle}>{sb.player2_wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px',
  borderBottom: '2px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
  borderBottom: '1px solid #eee',
};
