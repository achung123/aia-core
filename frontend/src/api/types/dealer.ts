// Dealer-facing gameplay types — hand status, blinds, player management, actions

import type { StreetEnum } from './game';

// --- Hand Status ---

export interface PlayerStatusEntry {
  name: string;
  participation_status: string;
  card_1: string | null;
  card_2: string | null;
  result: string | null;
  outcome_street: string | null;
  is_current_turn: boolean;
  last_action: string | null;
  current_chips: number | null;
  pot_contribution: number;
}

export interface HandStatusResponse {
  hand_number: number;
  community_recorded: boolean;
  players: PlayerStatusEntry[];
  current_player_name: string | null;
  legal_actions: string[];
  amount_to_call: number;
  minimum_bet?: number | null;
  minimum_raise?: number | null;
  pot: number;
  side_pots: unknown[];
  street_complete: boolean;
  phase: string;
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
  buy_in: number | null;
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
  is_all_in?: boolean;
}

export interface PlayerActionResponse {
  action_id: number;
  player_hand_id: number;
  street: string;
  action: string;
  amount: number | null;
  created_at: string;
}

export interface HandActionResponse {
  player_name: string;
  street: string;
  action: string;
  amount: number | null;
  created_at: string;
}
