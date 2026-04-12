import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// --- Types ---

export interface CommunityCards {
  flop1: string | null;
  flop2: string | null;
  flop3: string | null;
  flopRecorded: boolean;
  turn: string | null;
  turnRecorded: boolean;
  river: string | null;
  riverRecorded: boolean;
}

export interface Player {
  name: string;
  card1: string | null;
  card2: string | null;
  recorded: boolean;
  status: string;
  outcomeStreet: string | null;
}

export interface DealerState {
  gameId: number | null;
  currentHandId: number | null;
  players: Player[];
  community: CommunityCards;
  currentStep: string;
  handCount: number;
  gameDate: string | null;
}

export interface DealerActions {
  setGame: (payload: { gameId: number; players: string[]; gameDate: string }) => void;
  setPlayerCards: (payload: { name: string; card1: string; card2: string }) => void;
  setCommunityCards: (payload: { flop1: string; flop2: string; flop3: string; turn?: string; river?: string }) => void;
  setFlopCards: (payload: { flop1: string; flop2: string; flop3: string }) => void;
  setTurnCard: (card: string) => void;
  setRiverCard: (card: string) => void;
  setHandId: (handId: number) => void;
  setPlayerResult: (payload: { name: string; status: string; outcomeStreet?: string | null }) => void;
  newHand: () => void;
  finishHand: () => void;
  reset: () => void;
  restoreState: (payload: Partial<DealerState>) => void;
  setStep: (step: string) => void;
  loadHand: (hand: LoadHandPayload) => void;
  updateParticipation: (payload: { players: { name: string; participation_status: string }[] }) => void;
}

export interface LoadHandPayload {
  hand_number: number;
  flop_1: string | null;
  flop_2: string | null;
  flop_3: string | null;
  turn: string | null;
  river: string | null;
  player_hands: {
    player_name: string;
    card_1: string | null;
    card_2: string | null;
    result: string | null;
    profit_loss?: number | null;
    outcome_street?: string | null;
  }[];
}

// --- Constants ---

const emptyCommunity: CommunityCards = {
  flop1: null, flop2: null, flop3: null, flopRecorded: false,
  turn: null, turnRecorded: false, river: null, riverRecorded: false,
};

const STREET_ORDER: Record<string, number> = { preflop: -1, flop: 0, turn: 1, river: 2 };

const initialState: DealerState = {
  gameId: null,
  currentHandId: null,
  players: [],
  community: { ...emptyCommunity },
  currentStep: 'gameSelector',
  handCount: 0,
  gameDate: null,
};

// --- Utility ---

function initPlayer(name: string): Player {
  return { name, card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null };
}

export function validateOutcomeStreets(players: Player[]): string | null {
  const decided = players.filter(
    (p) => (p.status === 'won' || p.status === 'lost' || p.status === 'folded') && p.outcomeStreet,
  );
  if (decided.length === 0) return null;

  const showdown = decided.filter((p) => p.status === 'won' || p.status === 'lost');
  const folders = decided.filter((p) => p.status === 'folded');

  const showdownStreets = new Set(showdown.map((p) => p.outcomeStreet));
  if (showdownStreets.size > 1) {
    const mismatch = showdown.map((p) => `${p.name} (${p.outcomeStreet})`).join(', ');
    return `Winners and losers must share the same outcome street. Found: ${mismatch}. Please fix before finishing.`;
  }

  if (showdownStreets.size === 1) {
    const showdownStreet = [...showdownStreets][0]!;
    const showdownOrder = STREET_ORDER[showdownStreet] ?? -1;
    const latefolders = folders.filter((p) => (STREET_ORDER[p.outcomeStreet!] ?? -1) > showdownOrder);
    if (latefolders.length > 0) {
      const mismatch = latefolders.map((p) => `${p.name} (${p.outcomeStreet})`).join(', ');
      return `Folders must fold on or before the showdown street (${showdownStreet}). Late: ${mismatch}. Please fix before finishing.`;
    }
  }

  return null;
}

// --- Store ---

export const useDealerStore = create<DealerState & DealerActions>()(
  persist(
    (set) => ({
      ...initialState,

      setGame: ({ gameId, players, gameDate }) =>
        set(() => ({
          gameId,
          gameDate,
          players: players.map(initPlayer),
          community: { ...emptyCommunity },
          currentStep: 'dashboard',
        })),

      setPlayerCards: ({ name, card1, card2 }) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.name === name ? { ...p, card1, card2, recorded: true } : p,
          ),
        })),

      setCommunityCards: ({ flop1, flop2, flop3, turn, river }) =>
        set((state) => ({
          community: {
            ...state.community,
            flop1, flop2, flop3,
            flopRecorded: !!(flop1 && flop2 && flop3),
            turn: turn ?? state.community.turn,
            turnRecorded: turn ? true : state.community.turnRecorded,
            river: river ?? state.community.river,
            riverRecorded: river ? true : state.community.riverRecorded,
          },
        })),

      setFlopCards: ({ flop1, flop2, flop3 }) =>
        set((state) => ({
          community: { ...state.community, flop1, flop2, flop3, flopRecorded: true },
        })),

      setTurnCard: (card) =>
        set((state) => ({
          community: { ...state.community, turn: card, turnRecorded: true },
        })),

      setRiverCard: (card) =>
        set((state) => ({
          community: { ...state.community, river: card, riverRecorded: true },
        })),

      setHandId: (handId) => set({ currentHandId: handId }),

      setPlayerResult: ({ name, status, outcomeStreet }) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.name === name ? { ...p, status, outcomeStreet: outcomeStreet || null } : p,
          ),
        })),

      newHand: () =>
        set((state) => ({
          currentHandId: null,
          players: state.players.map((p) => initPlayer(p.name)),
          community: { ...emptyCommunity },
          handCount: state.handCount + 1,
          currentStep: 'dashboard',
        })),

      finishHand: () =>
        set((state) => ({
          currentHandId: null,
          players: state.players.map((p) => initPlayer(p.name)),
          community: { ...emptyCommunity },
          handCount: state.handCount + 1,
          currentStep: 'dashboard',
        })),

      reset: () => set({ ...initialState, players: [], community: { ...emptyCommunity } }),

      restoreState: (payload) =>
        set((state) => {
          const restored = { ...state, ...payload };
          if (restored.currentStep === 'outcome') {
            restored.currentStep = 'activeHand';
          }
          return restored;
        }),

      setStep: (step) => set({ currentStep: step }),

      loadHand: (hand) =>
        set((state) => {
          const phMap = new Map(
            hand.player_hands.map((ph) => [ph.player_name, ph]),
          );
          const hasFlopCards = hand.flop_1 != null;
          return {
            currentHandId: hand.hand_number,
            currentStep: 'activeHand',
            community: {
              flop1: hand.flop_1, flop2: hand.flop_2, flop3: hand.flop_3,
              flopRecorded: hasFlopCards,
              turn: hand.turn,
              turnRecorded: hand.turn != null,
              river: hand.river,
              riverRecorded: hand.river != null,
            },
            players: state.players.map((p) => {
              const ph = phMap.get(p.name);
              if (!ph) return initPlayer(p.name);
              return {
                name: p.name,
                card1: ph.card_1 || null,
                card2: ph.card_2 || null,
                recorded: true,
                status: ph.result || 'playing',
                outcomeStreet: ph.outcome_street || null,
              };
            }),
          };
        }),

      updateParticipation: ({ players: participationPlayers }) =>
        set((state) => {
          const statusMap = new Map(
            participationPlayers.map((p) => [p.name, p.participation_status]),
          );
          return {
            players: state.players.map((p) => {
              const ps = statusMap.get(p.name);
              if (ps == null) return p;
              if (p.recorded && (ps === 'idle' || ps === 'playing')) return p;
              if (p.status === 'not_playing' && (ps === 'idle' || ps === 'playing')) return p;
              return { ...p, status: ps };
            }),
          };
        }),
    }),
    {
      name: 'aia_dealer_state',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
