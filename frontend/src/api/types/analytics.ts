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

// --- Trends ---

export interface PlayerSessionTrend {
  game_id: number;
  game_date: string;
  hands_played: number;
  hands_won: number;
  win_rate: number;
  profit_loss: number;
}

// --- Head-to-Head ---

export interface StreetBreakdown {
  street: string;
  hands_ended: number;
  player1_wins: number;
  player2_wins: number;
}

export interface HeadToHeadResponse {
  player1_name: string;
  player2_name: string;
  shared_hands_count: number;
  showdown_count: number;
  player1_showdown_wins: number;
  player2_showdown_wins: number;
  player1_fold_count: number;
  player2_fold_count: number;
  player1_fold_rate: number;
  player2_fold_rate: number;
  street_breakdown: StreetBreakdown[];
}

// --- Awards ---

export interface AwardEntry {
  award_name: string;
  emoji: string;
  description: string;
  winner_name: string;
  stat_value: number;
  stat_label: string;
}

// --- Highlights ---

export interface GameHighlight {
  hand_number: number;
  highlight_type: string;
  description: string;
}
