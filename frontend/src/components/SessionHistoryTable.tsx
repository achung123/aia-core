import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerSessionTrend } from '../api/types';

type SortKey = 'game_date' | 'hands_played' | 'hands_won' | 'losses' | 'win_rate' | 'profit_loss';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'game_date', label: 'Date' },
  { key: 'hands_played', label: 'Hands' },
  { key: 'hands_won', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'win_rate', label: 'Win Rate' },
  { key: 'profit_loss', label: 'P&L' },
];

const PAGE_SIZE = 20;

interface Props {
  data: PlayerSessionTrend[];
}

function getValue(row: PlayerSessionTrend, key: SortKey): number | string {
  if (key === 'losses') return row.hands_played - row.hands_won;
  return row[key];
}

export function SessionHistoryTable({ data }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('game_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  if (data.length === 0) {
    return <p style={{ color: '#9ca3af' }}>No session history available.</p>;
  }

  const stickyStyle: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    background: '#1f2937',
    zIndex: 1,
  };

  return (
    <div>
      <div data-testid="session-history-table" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr>
              {COLUMNS.map((col, i) => (
                <th
                  key={col.key}
                  role="columnheader"
                  onClick={() => handleSort(col.key)}
                  style={{
                    ...(i === 0 ? stickyStyle : {}),
                    cursor: 'pointer',
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    borderBottom: '1px solid #374151',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {col.label}
                  {sortKey === col.key ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row) => {
              const losses = row.hands_played - row.hands_won;
              return (
                <tr
                  key={row.game_id}
                  onClick={() => navigate(`/games/${row.game_id}/recap`)}
                  style={{ cursor: 'pointer', borderBottom: '1px solid #374151' }}
                >
                  <td style={{ ...stickyStyle, padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                    {row.game_date}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{row.hands_played}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{row.hands_won}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{losses}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{row.win_rate}%</td>
                  <td
                    style={{
                      padding: '0.5rem 0.75rem',
                      color: row.profit_loss > 0 ? '#22c55e' : row.profit_loss < 0 ? '#ef4444' : undefined,
                    }}
                  >
                    {row.profit_loss}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem' }}>
          <button
            aria-label="Prev"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            style={{ padding: '0.25rem 0.75rem' }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            aria-label="Next"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            style={{ padding: '0.25rem 0.75rem' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
