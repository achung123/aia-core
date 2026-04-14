import type { PlayerEquityEntry } from '../api/types';
import type { Player, CommunityCards } from '../stores/dealerStore.ts';

export interface ProposedResult {
  name: string;
  status: 'won' | 'lost';
  outcomeStreet: string;
}

export function inferOutcomeStreet(community: CommunityCards): string {
  if (community.riverRecorded) return 'river';
  if (community.turnRecorded) return 'turn';
  if (community.flopRecorded) return 'flop';
  return 'preflop';
}

export function isShowdownEnabled(community: CommunityCards, players: Player[]): boolean {
  if (!community.flopRecorded) return false;
  const nonFoldedWithCards = players.filter(
    (p) => p.status !== 'folded' && p.status !== 'not_playing' && p.card1 && p.card2,
  );
  return nonFoldedWithCards.length >= 2;
}

export function mapEquityToOutcomes(
  equities: PlayerEquityEntry[],
  players: Player[],
  community: CommunityCards,
): ProposedResult[] | null {
  const street = inferOutcomeStreet(community);

  const activePlayers = players.filter(
    (p) => p.status !== 'folded' && p.status !== 'not_playing' && p.card1 && p.card2,
  );

  if (activePlayers.length === 0) return null;

  // AC3: Single non-folded player with cards → auto-propose won
  if (activePlayers.length === 1) {
    return [{ name: activePlayers[0].name, status: 'won', outcomeStreet: street }];
  }

  // AC2: Map equity to outcomes
  const results: ProposedResult[] = [];
  for (const player of activePlayers) {
    const eq = equities.find((e) => e.player_name === player.name);
    if (!eq) return null; // inconclusive — missing equity data

    if (eq.equity > 0.001) {
      results.push({ name: player.name, status: 'won', outcomeStreet: street });
    } else {
      results.push({ name: player.name, status: 'lost', outcomeStreet: street });
    }
  }

  return results;
}
