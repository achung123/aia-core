import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchSessions } from '../api/client';
import type { GameSessionListItem } from '../api/types';

export function GameListPage() {
  const { data: games, isLoading, isError } = useQuery<GameSessionListItem[], Error>({
    queryKey: ['gameSessions'],
    queryFn: fetchSessions,
  });

  if (isLoading) {
    return (
      <div data-testid="game-list-loading" style={{ padding: '1rem' }}>
        <div style={{ height: '1.5rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '0.75rem', width: '60%' }} />
        <div style={{ height: '1rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '0.5rem' }} />
        <div style={{ height: '1rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '0.5rem' }} />
        <div style={{ height: '1rem', background: '#e0e0e0', borderRadius: 4, marginBottom: '0.5rem' }} />
      </div>
    );
  }

  if (isError) {
    return <div data-testid="game-list-error" style={{ padding: '1rem', color: 'red' }}>Failed to load games.</div>;
  }

  if (!games || games.length === 0) {
    return <div style={{ padding: '1rem' }}>No games found.</div>;
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 600, margin: '0 auto' }}>
      <h1>Games</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {games.map((game) => (
          <li key={game.game_id} style={{ borderBottom: '1px solid #ddd', padding: '0.75rem 0' }}>
            <Link to={`/games/${game.game_id}/recap`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ fontWeight: 'bold' }}>{game.game_date}</div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                {game.player_count} players &middot; {game.hand_count} hands
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
