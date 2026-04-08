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

export function uploadCsvValidate(file) {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${BASE_URL}/upload/csv`, { method: 'POST', body: form })
    .then(async r => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
      return body;
    });
}

export function uploadCsvCommit(file) {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${BASE_URL}/upload/csv/commit`, { method: 'POST', body: form })
    .then(async r => {
      const body = await r.json();
      if (!r.ok) {
        const detail = typeof body.detail === 'object' ? JSON.stringify(body.detail) : (body.detail || `HTTP ${r.status}`);
        throw new Error(detail);
      }
      return body;
    });
}

export function uploadImage(gameId, file) {
  const form = new FormData();
  form.append('file', file);
  return fetch(`${BASE_URL}/games/${gameId}/hands/image`, { method: 'POST', body: form })
    .then(async r => {
      const body = await r.json();
      if (!r.ok) {
        const detail = typeof body.detail === 'object' ? JSON.stringify(body.detail) : (body.detail || `HTTP ${r.status}`);
        throw new Error(detail);
      }
      return body;
    });
}

export function getDetectionResults(gameId, uploadId) {
  return request(`/games/${gameId}/hands/image/${uploadId}`);
}

export function fetchCsvSchema() {
  return request('/upload/csv/schema');
}
