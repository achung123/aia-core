// Response interfaces matching backend Pydantic models (src/pydantic_models/app_models.py)

// --- Enums ---

export type ResultEnum = 'won' | 'folded' | 'lost' | 'handed_back';
export type StreetEnum = 'preflop' | 'flop' | 'turn' | 'river';
export type LeaderboardMetric = 'total_profit_loss' | 'win_rate' | 'hands_played';

// --- Game Session ---

export interface GameSessionListItem {
  game_id: number;
  game_date: string;
  status: string;
  player_count: number;
  hand_count: number;
  winners: string[];
}

export interface PlayerInfo {
  name: string;
  is_active: boolean;
  seat_number: number | null;
  buy_in: number | null;
  rebuy_count: number;
  total_rebuys: number;
}

export interface GameSessionResponse {
  game_id: number;
  game_date: string;
  status: string;
  created_at: string;
  player_names: string[];
  players?: PlayerInfo[];
  hand_count: number;
  winners: string[];
  default_buy_in?: number | null;
}

export interface GameSessionCreate {
  game_date: string;
  player_names: string[];
  default_buy_in?: number | null;
}

export interface CompleteGameRequest {
  winners: string[];
}

// --- Player ---

export interface PlayerResponse {
  player_id: number;
  name: string;
  created_at: string;
}

export interface PlayerCreate {
  name: string;
}

// --- Hand ---

export interface PlayerHandResponse {
  player_hand_id: number;
  hand_id: number;
  player_id: number;
  player_name: string;
  card_1: string | null;
  card_2: string | null;
  result: string | null;
  profit_loss: number | null;
  outcome_street: string | null;
  winning_hand_description: string | null;
}

export interface HandResponse {
  hand_id: number;
  game_id: number;
  hand_number: number;
  flop_1: string | null;
  flop_2: string | null;
  flop_3: string | null;
  turn: string | null;
  river: string | null;
  source_upload_id: number | null;
  sb_player_name: string | null;
  bb_player_name: string | null;
  created_at: string;
  player_hands: PlayerHandResponse[];
}

export interface HandCreate {
  flop_1?: string | null;
  flop_2?: string | null;
  flop_3?: string | null;
  turn?: string | null;
  river?: string | null;
  player_entries?: PlayerHandEntry[];
}

export interface PlayerHandEntry {
  player_name: string;
  card_1?: string | null;
  card_2?: string | null;
  result?: ResultEnum | null;
  profit_loss?: number | null;
}

export interface AddPlayerToHandRequest {
  player_name: string;
  card_1?: string | null;
  card_2?: string | null;
}

export interface HoleCardsUpdate {
  card_1?: string | null;
  card_2?: string | null;
}

export interface CommunityCardsUpdate {
  flop_1: string;
  flop_2: string;
  flop_3: string;
  turn?: string | null;
  river?: string | null;
}

export interface FlopUpdate {
  flop_1: string;
  flop_2: string;
  flop_3: string;
}

export interface TurnUpdate {
  turn: string;
}

export interface RiverUpdate {
  river: string;
}

export interface PlayerResultUpdate {
  result: ResultEnum;
  profit_loss?: number | null;
  outcome_street?: StreetEnum | null;
}

// --- Stats ---

export interface PlayerStatsResponse {
  player_name: string;
  total_hands_played: number;
  hands_won: number;
  hands_lost: number;
  hands_folded: number;
  win_rate: number;
  total_profit_loss: number;
  avg_profit_loss_per_hand: number;
  avg_profit_loss_per_session: number;
  flop_pct: number;
  turn_pct: number;
  river_pct: number;
}

export interface GameStatsPlayerEntry {
  player_name: string;
  hands_played: number;
  hands_won: number;
  hands_lost: number;
  hands_folded: number;
  win_rate: number;
  profit_loss: number;
}

export interface GameStatsResponse {
  game_id: number;
  game_date: string;
  total_hands: number;
  player_stats: GameStatsPlayerEntry[];
}

export interface LeaderboardEntry {
  rank: number;
  player_name: string;
  total_profit_loss: number;
  win_rate: number;
  hands_played: number;
}

// --- Hand Status ---

export interface PlayerStatusEntry {
  name: string;
  participation_status: string;
  card_1: string | null;
  card_2: string | null;
  result: string | null;
  outcome_street: string | null;
  is_current_turn: boolean;
}

export interface HandStatusResponse {
  hand_number: number;
  community_recorded: boolean;
  players: PlayerStatusEntry[];
  current_player_name: string | null;
  legal_actions: string[];
  amount_to_call: number;
  pot: number;
  side_pots: unknown[];
  street_complete: boolean;
  phase: string;
}

// --- Seat Assignment ---

export interface SeatAssignmentRequest {
  seat_number: number;
}

// --- Rebuy ---

export interface RebuyCreate {
  amount: number;
}

export interface RebuyResponse {
  rebuy_id: number;
  game_id: number;
  player_name: string;
  amount: number;
  created_at: string;
}

// --- Equity ---

export interface PlayerEquityEntry {
  player_name: string;
  equity: number;
  winning_hand_description: string | null;
}

export interface EquityResponse {
  equities: PlayerEquityEntry[];
}

// --- CSV Upload ---

export interface CsvValidationResponse {
  valid: boolean;
  total_rows: number;
  error_count: number;
  errors: string[];
}

export interface CSVCommitSummary {
  games_created: number;
  hands_created: number;
  players_created: number;
  players_matched: number;
}

export interface CsvSchemaResponse {
  columns: string[];
  formats: Record<string, string>;
}

// --- Image Upload / Detection ---

export interface ImageUploadResponse {
  upload_id: number;
  game_id: number;
  file_path: string;
  status: string;
}

export interface CardAlternative {
  value: string;
  confidence: number;
}

export interface CardDetectionEntry {
  card_position: string;
  detected_value: string;
  confidence: number;
  bbox_x?: number | null;
  bbox_y?: number | null;
  bbox_width?: number | null;
  bbox_height?: number | null;
  alternatives?: CardAlternative[];
}

export interface DetectionResultsResponse {
  upload_id: number;
  game_id: number;
  status: string;
  detections: CardDetectionEntry[];
}

// --- Blinds ---

export interface BlindsResponse {
  small_blind: number;
  big_blind: number;
  blind_timer_minutes: number;
  blind_timer_paused: boolean;
  blind_timer_started_at: string | null;
  blind_timer_remaining_seconds: number | null;
}

export interface BlindsUpdate {
  small_blind?: number | null;
  big_blind?: number | null;
  blind_timer_minutes?: number | null;
  blind_timer_paused?: boolean | null;
}

// --- Player Game Management ---

export interface AddPlayerToGameRequest {
  player_name: string;
}

export interface AddPlayerToGameResponse {
  player_name: string;
  is_active: boolean;
  seat_number: number | null;
}

export interface PlayerStatusUpdate {
  is_active: boolean;
}

export interface PlayerStatusResponse {
  player_name: string;
  is_active: boolean;
}

// --- Player Actions ---

export type ActionEnum = 'fold' | 'check' | 'call' | 'bet' | 'raise';

export interface PlayerActionCreate {
  street: StreetEnum;
  action: ActionEnum;
  amount?: number | null;
}

export interface PlayerActionResponse {
  action_id: number;
  player_hand_id: number;
  street: string;
  action: string;
  amount: number | null;
  created_at: string;
}
