// Core game data types — sessions, players, hands, seats, rebuys

export type ResultEnum = 'won' | 'folded' | 'lost' | 'handed_back';
export type StreetEnum = 'preflop' | 'flop' | 'turn' | 'river';

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
  current_chips: number | null;
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
  pot: number;
  side_pots: unknown[];
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

// --- Seat Assignment ---

export interface SeatAssignmentRequest {
  seat_number: number;
  swap?: boolean;
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
