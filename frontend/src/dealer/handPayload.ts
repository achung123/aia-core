import type { CommunityCards, Player } from '../stores/dealerStore';

// --- Payload Types ---

export interface HandPayload {
  flop_1: string | null;
  flop_2: string | null;
  flop_3: string | null;
  turn: string | null;
  river: string | null;
  player_entries: PlayerEntry[];
}

export interface PlayerEntry {
  player_name: string;
  card_1: string | null;
  card_2: string | null;
}

export interface HandPayloadState {
  community: CommunityCards;
  players: Player[];
}

// --- Payload Builders ---

export function assembleHandPayload(state: HandPayloadState): HandPayload {
  const { community, players } = state;
  return {
    flop_1: community.flop1,
    flop_2: community.flop2,
    flop_3: community.flop3,
    turn: community.turn || null,
    river: community.river || null,
    player_entries: players.map((p) => ({
      player_name: p.name,
      card_1: p.card1,
      card_2: p.card2,
    })),
  };
}

export function validateNoDuplicates(payload: HandPayload): string | null {
  const cards = [
    payload.flop_1,
    payload.flop_2,
    payload.flop_3,
    payload.turn,
    payload.river,
    ...payload.player_entries.flatMap((e) => [e.card_1, e.card_2]),
  ].filter(Boolean) as string[];

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const card of cards) {
    if (seen.has(card)) {
      duplicates.push(card);
    }
    seen.add(card);
  }

  if (duplicates.length > 0) {
    return `Duplicate card(s) found: ${[...new Set(duplicates)].join(', ')}`;
  }
  return null;
}
