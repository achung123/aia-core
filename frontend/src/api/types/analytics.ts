// Analytics types — player stats, game stats, leaderboard, equity

export type LeaderboardMetric = 'total_profit_loss' | 'win_rate' | 'hands_played';

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

// --- Equity ---

export interface PlayerEquityEntry {
  player_name: string;
  equity: number;
  winning_hand_description: string | null;
}

export interface EquityResponse {
  equities: PlayerEquityEntry[];
}
