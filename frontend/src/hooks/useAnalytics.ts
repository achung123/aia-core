import { useQuery } from '@tanstack/react-query';
import {
  fetchPlayerTrends,
  fetchHeadToHead,
  fetchAwards,
  fetchGameHighlights,
  fetchPlayerStats,
  fetchGameStats,
} from '../api/client';
import type {
  PlayerSessionTrend,
  HeadToHeadResponse,
  AwardEntry,
  GameHighlight,
  PlayerStatsResponse,
  GameStatsResponse,
} from '../api/types';

export function usePlayerTrends(name: string) {
  return useQuery<PlayerSessionTrend[], Error>({
    queryKey: ['playerTrends', name],
    queryFn: () => fetchPlayerTrends(name),
    enabled: !!name,
  });
}

export function useHeadToHead(p1: string, p2: string) {
  return useQuery<HeadToHeadResponse, Error>({
    queryKey: ['headToHead', p1, p2],
    queryFn: () => fetchHeadToHead(p1, p2),
    enabled: !!p1 && !!p2,
  });
}

export function useAwards(gameId?: number) {
  return useQuery<AwardEntry[], Error>({
    queryKey: ['awards', gameId],
    queryFn: () => fetchAwards(gameId),
  });
}

export function useGameHighlights(gameId: number) {
  return useQuery<GameHighlight[], Error>({
    queryKey: ['gameHighlights', gameId],
    queryFn: () => fetchGameHighlights(gameId),
    enabled: gameId > 0,
  });
}

export function usePlayerStats(name: string) {
  return useQuery<PlayerStatsResponse, Error>({
    queryKey: ['playerStats', name],
    queryFn: () => fetchPlayerStats(name),
    enabled: !!name,
  });
}

export function useGameStats(gameId: number) {
  return useQuery<GameStatsResponse, Error>({
    queryKey: ['gameStats', gameId],
    queryFn: () => fetchGameStats(gameId),
    enabled: gameId > 0,
  });
}
