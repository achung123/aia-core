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

export function fetchPlayerStats(sessionId) {
  return request(`/games/${sessionId}/stats/players`);
}

export function fetchGameStats(sessionId) {
  return request(`/games/${sessionId}/stats/game`);
}

export function fetchLeaderboard() {
  return request('/leaderboard');
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

export function updateHolecards(handId, data) {
  return request(`/hands/${handId}/hole-cards`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCommunityCards(handId, data) {
  return request(`/hands/${handId}/community-cards`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
