const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json();
}

export function fetchSessions() {
  return request('/games');
}

export function fetchHands(sessionId) {
  return request(`/games/${sessionId}/hands`);
}

export function fetchPlayerStats(playerName) {
  return request(`/stats/players/${encodeURIComponent(playerName)}`);
}

export function fetchGameStats(gameId) {
  return request(`/stats/games/${gameId}`);
}

export function fetchLeaderboard() {
  return request('/stats/leaderboard');
}

export function fetchPlayers() {
  return request('/players');
}

export function createSession(data) {
  return request('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createPlayer(data) {
  return request('/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createHand(sessionId, data) {
  return request(`/games/${sessionId}/hands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateHolecards(gameId, handNumber, playerName, data) {
  return request(`/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCommunityCards(gameId, handNumber, data) {
  return request(`/games/${gameId}/hands/${handNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
