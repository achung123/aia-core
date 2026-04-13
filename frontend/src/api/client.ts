import type {
  GameSessionListItem,
  GameSessionResponse,
  GameSessionCreate,
  HandResponse,
  HandCreate,
  PlayerHandResponse,
  PlayerResponse,
  PlayerCreate,
  PlayerStatsResponse,
  GameStatsResponse,
  LeaderboardEntry,
  CsvSchemaResponse,
  CsvValidationResponse,
  CSVCommitSummary,
  ImageUploadResponse,
  DetectionResultsResponse,
  EquityResponse,
  HandStatusResponse,
  AddPlayerToHandRequest,
  HoleCardsUpdate,
  CommunityCardsUpdate,
  FlopUpdate,
  TurnUpdate,
  RiverUpdate,
  PlayerResultUpdate,
  CompleteGameRequest,
  BlindsResponse,
  BlindsUpdate,
  AddPlayerToGameResponse,
  PlayerStatusResponse,
  PlayerActionCreate,
  PlayerActionResponse,
  PlayerInfo,
  SeatAssignmentRequest,
  RebuyCreate,
  RebuyResponse,
} from './types.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, { signal: options.signal, ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

export function fetchSessions(): Promise<GameSessionListItem[]> {
  return request<GameSessionListItem[]>('/games');
}

export function fetchGame(gameId: number): Promise<GameSessionResponse> {
  return request<GameSessionResponse>(`/games/${gameId}`);
}

export function fetchHands(sessionId: number, { signal }: { signal?: AbortSignal } = {}): Promise<HandResponse[]> {
  return request<HandResponse[]>(`/games/${sessionId}/hands`, { signal });
}

export function fetchHand(gameId: number, handNumber: number): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}`);
}

export function fetchPlayerStats(playerName: string): Promise<PlayerStatsResponse> {
  return request<PlayerStatsResponse>(`/stats/players/${encodeURIComponent(playerName)}`);
}

export function fetchGameStats(gameId: number): Promise<GameStatsResponse> {
  return request<GameStatsResponse>(`/stats/games/${gameId}`);
}

export function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>('/stats/leaderboard');
}

export function fetchPlayers(): Promise<PlayerResponse[]> {
  return request<PlayerResponse[]>('/players');
}

export function createSession(data: GameSessionCreate): Promise<GameSessionResponse> {
  return request<GameSessionResponse>('/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createPlayer(data: PlayerCreate): Promise<PlayerResponse> {
  return request<PlayerResponse>('/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createHand(sessionId: number, data: HandCreate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${sessionId}/hands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function addPlayerToHand(gameId: number, handNumber: number, data: AddPlayerToHandRequest): Promise<PlayerHandResponse> {
  return request<PlayerHandResponse>(`/games/${gameId}/hands/${handNumber}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateHolecards(gameId: number, handNumber: number, playerName: string, data: HoleCardsUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateCommunityCards(gameId: number, handNumber: number, data: CommunityCardsUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateFlop(gameId: number, handNumber: number, data: FlopUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}/flop`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateTurn(gameId: number, handNumber: number, data: TurnUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}/turn`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateRiver(gameId: number, handNumber: number, data: RiverUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}/river`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function patchPlayerResult(gameId: number, handNumber: number, playerName: string, data: PlayerResultUpdate): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}/result`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function completeGame(gameId: number, winners?: string[]): Promise<GameSessionResponse> {
  const body: CompleteGameRequest = { winners: winners || [] };
  return request<GameSessionResponse>(`/games/${gameId}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function reactivateGame(gameId: number): Promise<GameSessionResponse> {
  return request<GameSessionResponse>(`/games/${gameId}/reactivate`, {
    method: 'PATCH',
  });
}

export async function uploadCsvValidate(file: File): Promise<CsvValidationResponse> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${BASE_URL}/upload/csv`, { method: 'POST', body: form });
  const body = await r.json();
  if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
  return body as CsvValidationResponse;
}

export async function uploadCsvCommit(file: File): Promise<CSVCommitSummary> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${BASE_URL}/upload/csv/commit`, { method: 'POST', body: form });
  const body = await r.json();
  if (!r.ok) {
    const detail = typeof body.detail === 'object' ? JSON.stringify(body.detail) : (body.detail || `HTTP ${r.status}`);
    throw new Error(detail);
  }
  return body as CSVCommitSummary;
}

export async function uploadImage(gameId: number, file: File): Promise<ImageUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${BASE_URL}/games/${gameId}/hands/image`, { method: 'POST', body: form });
  const body = await r.json();
  if (!r.ok) {
    const detail = typeof body.detail === 'object' ? JSON.stringify(body.detail) : (body.detail || `HTTP ${r.status}`);
    throw new Error(detail);
  }
  return body as ImageUploadResponse;
}

export function getDetectionResults(gameId: number, uploadId: number): Promise<DetectionResultsResponse> {
  return request<DetectionResultsResponse>(`/games/${gameId}/hands/image/${uploadId}`);
}

export function fetchCsvSchema(): Promise<CsvSchemaResponse> {
  return request<CsvSchemaResponse>('/upload/csv/schema');
}

export function fetchEquity(gameId: number, handNumber: number): Promise<EquityResponse> {
  return request<EquityResponse>(`/games/${gameId}/hands/${handNumber}/equity`);
}

export function fetchPlayerEquity(gameId: number, handNumber: number, playerName: string): Promise<EquityResponse> {
  return request<EquityResponse>(`/games/${gameId}/hands/${handNumber}/equity?player=${encodeURIComponent(playerName)}`);
}

export function fetchHandStatus(gameId: number, handNumber: number, { signal }: { signal?: AbortSignal } = {}): Promise<HandStatusResponse> {
  return request<HandStatusResponse>(`/games/${gameId}/hands/${handNumber}/status`, { signal });
}

export interface ConditionalResponse<T> {
  data: T | null;
  etag: string | null;
  notModified: boolean;
}

export async function fetchHandStatusConditional(
  gameId: number,
  handNumber: number,
  { signal, etag }: { signal?: AbortSignal; etag?: string | null } = {},
): Promise<ConditionalResponse<HandStatusResponse>> {
  const headers: Record<string, string> = {};
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  const response = await fetch(`${BASE_URL}/games/${gameId}/hands/${handNumber}/status`, {
    signal,
    headers,
  });
  if (response.status === 304) {
    return { data: null, etag: etag ?? null, notModified: true };
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  const data = (await response.json()) as HandStatusResponse;
  const newEtag = response.headers.get('etag');
  return { data, etag: newEtag, notModified: false };
}

export function exportGameCsvUrl(gameId: number): string {
  return `${BASE_URL}/games/${gameId}/export/csv`;
}

export async function deleteGame(gameId: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/games/${gameId}`, { method: 'DELETE' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
}

export async function deleteHand(gameId: number, handNumber: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/games/${gameId}/hands/${handNumber}`, { method: 'DELETE' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
}

export function togglePlayerStatus(gameId: number, playerName: string, isActive: boolean): Promise<PlayerStatusResponse> {
  return request<PlayerStatusResponse>(`/games/${gameId}/players/${encodeURIComponent(playerName)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function addPlayerToGame(gameId: number, playerName: string): Promise<AddPlayerToGameResponse> {
  return request<AddPlayerToGameResponse>(`/games/${gameId}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_name: playerName }),
  });
}

export function startHand(gameId: number): Promise<HandResponse> {
  return request<HandResponse>(`/games/${gameId}/hands/start`, {
    method: 'POST',
  });
}

export function recordPlayerAction(gameId: number, handNumber: number, playerName: string, data: PlayerActionCreate): Promise<PlayerActionResponse> {
  return request<PlayerActionResponse>(`/games/${gameId}/hands/${handNumber}/players/${encodeURIComponent(playerName)}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function fetchBlinds(gameId: number): Promise<BlindsResponse> {
  return request<BlindsResponse>(`/games/${gameId}/blinds`);
}

export function updateBlinds(gameId: number, data: BlindsUpdate): Promise<BlindsResponse> {
  return request<BlindsResponse>(`/games/${gameId}/blinds`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function assignPlayerSeat(gameId: number, playerName: string, data: SeatAssignmentRequest): Promise<PlayerInfo> {
  return request<PlayerInfo>(`/games/${gameId}/players/${encodeURIComponent(playerName)}/seat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function createRebuy(gameId: number, playerName: string, data: RebuyCreate): Promise<RebuyResponse> {
  return request<RebuyResponse>(`/games/${gameId}/players/${encodeURIComponent(playerName)}/rebuys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
