interface ShowdownRecordProps {
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  showdownCount: number;
}

export function ShowdownRecord({
  player1Name,
  player2Name,
  player1Wins,
  player2Wins,
  showdownCount,
}: ShowdownRecordProps) {
  const p1Pct = showdownCount > 0 ? (player1Wins / showdownCount) * 100 : 50;
  const p2Pct = showdownCount > 0 ? (player2Wins / showdownCount) * 100 : 50;

  const dominant =
    p1Pct > 60 ? player1Name : p2Pct > 60 ? player2Name : null;

  return (
    <div data-testid="showdown-record" style={{ marginBottom: '1.5rem' }}>
      {/* Hero section */}
      <div
        data-testid="showdown-hero"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          background: '#f9fafb',
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{player1Name}</div>
          <div data-testid="p1-wins" style={{ fontSize: '2rem', fontWeight: 800 }}>
            {player1Wins}
          </div>
        </div>

        <div style={{ fontSize: '1rem', color: '#999', padding: '0 1rem' }}>
          {showdownCount} showdowns
        </div>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{player2Name}</div>
          <div data-testid="p2-wins" style={{ fontSize: '2rem', fontWeight: 800 }}>
            {player2Wins}
          </div>
        </div>
      </div>

      {/* Split gauge */}
      <div
        data-testid="showdown-gauge"
        style={{
          display: 'flex',
          height: 12,
          borderRadius: 6,
          overflow: 'hidden',
          margin: '0.75rem 0',
          background: '#e5e7eb',
        }}
      >
        <div
          data-testid="gauge-p1"
          style={{
            width: `${p1Pct}%`,
            background: '#3b82f6',
            transition: 'width 0.3s ease',
          }}
        />
        <div
          data-testid="gauge-p2"
          style={{
            width: `${p2Pct}%`,
            background: '#ef4444',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Rivalry verdict */}
      {dominant && (
        <div
          data-testid="rivalry-verdict"
          style={{
            textAlign: 'center',
            padding: '0.5rem',
            fontWeight: 600,
            color: '#b45309',
            background: '#fef3c7',
            borderRadius: 6,
          }}
        >
          🏆 {dominant} dominates this rivalry
        </div>
      )}
    </div>
  );
}
