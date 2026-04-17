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
  lastAction: string | null;
}

export interface DealerState {
  gameId: number | null;
  currentHandId: number | null;
  players: Player[];
  community: CommunityCards;
  currentStep: string;
  handCount: number;
  gameDate: string | null;
  sbPlayerName: string | null;
  bbPlayerName: string | null;
}

export interface DealerActions {
  setGame: (payload: { gameId: number; players: string[]; gameDate: string }) => void;
  addPlayer: (name: string) => void;
  removePlayer: (name: string) => void;
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
  updateParticipation: (payload: { players: { name: string; participation_status: string; outcome_street?: string | null; last_action?: string | null }[] }) => void;
}

export interface LoadHandPayload {
  hand_number: number;
  flop_1: string | null;
  flop_2: string | null;
  flop_3: string | null;
  turn: string | null;
  river: string | null;
  sb_player_name?: string | null;
  bb_player_name?: string | null;
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
  sbPlayerName: null,
  bbPlayerName: null,
};

// --- Utility ---

function initPlayer(name: string): Player {
  return { name, card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null };
}

export function validateOutcomeStreets(players: Player[]): string | null {
  const decided = players.filter(
    (player) => (player.status === 'won' || player.status === 'lost' || player.status === 'folded') && player.outcomeStreet,
  );
  if (decided.length === 0) return null;

  const showdown = decided.filter((player) => player.status === 'won' || player.status === 'lost');
  const folders = decided.filter((player) => player.status === 'folded');

  const showdownStreets = new Set(showdown.map((player) => player.outcomeStreet));
  if (showdownStreets.size > 1) {
    const mismatch = showdown.map((player) => `${player.name} (${player.outcomeStreet})`).join(', ');
    return `Winners and losers must share the same outcome street. Found: ${mismatch}. Please fix before finishing.`;
  }

  if (showdownStreets.size === 1) {
    const showdownStreet = [...showdownStreets][0]!;
    const showdownOrder = STREET_ORDER[showdownStreet] ?? -1;
    const latefolders = folders.filter((player) => (STREET_ORDER[player.outcomeStreet!] ?? -1) > showdownOrder);
    if (latefolders.length > 0) {
      const mismatch = latefolders.map((player) => `${player.name} (${player.outcomeStreet})`).join(', ');
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

      addPlayer: (name) =>
        set((state) => {
          if (state.players.some((player) => player.name === name)) return state;
          return { players: [...state.players, initPlayer(name)] };
        }),

      removePlayer: (name) =>
        set((state) => ({
          players: state.players.filter((player) => player.name !== name),
        })),

      setPlayerCards: ({ name, card1, card2 }) =>
        set((state) => ({
          players: state.players.map((player) =>
            player.name === name ? { ...player, card1, card2, recorded: true } : player,
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
          players: state.players.map((player) =>
            player.name === name ? { ...player, status, outcomeStreet: outcomeStreet || null } : player,
          ),
        })),

      newHand: () =>
        set((state) => ({
          currentHandId: null,
          players: state.players.map((player) => initPlayer(player.name)),
          community: { ...emptyCommunity },
          handCount: state.handCount + 1,
          currentStep: 'dashboard',
        })),

      finishHand: () =>
        set((state) => ({
          currentHandId: null,
          players: state.players.map((player) => initPlayer(player.name)),
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
          const playerHandMap = new Map(
            hand.player_hands.map((playerHand) => [playerHand.player_name, playerHand]),
          );
          const hasFlopCards = hand.flop_1 != null;
          return {
            currentHandId: hand.hand_number,
            currentStep: 'activeHand',
            sbPlayerName: hand.sb_player_name ?? null,
            bbPlayerName: hand.bb_player_name ?? null,
            community: {
              flop1: hand.flop_1, flop2: hand.flop_2, flop3: hand.flop_3,
              flopRecorded: hasFlopCards,
              turn: hand.turn,
              turnRecorded: hand.turn != null,
              river: hand.river,
              riverRecorded: hand.river != null,
            },
            players: state.players.map((player) => {
              const playerHand = playerHandMap.get(player.name);
              // If hand has player_hands but this player isn't in them, they're inactive
              if (!playerHand) {
                return hand.player_hands.length > 0
                  ? { ...initPlayer(player.name), status: 'not_playing' }
                  : initPlayer(player.name);
              }
              return {
                name: player.name,
                card1: playerHand.card_1 || null,
                card2: playerHand.card_2 || null,
                recorded: true,
                status: playerHand.result || 'playing',
                outcomeStreet: playerHand.outcome_street || null,
                lastAction: null,
              };
            }),
          };
        }),

      updateParticipation: ({ players: participationPlayers }) =>
        set((state) => {
          const statusMap = new Map(
            participationPlayers.map((player) => [player.name, player]),
          );
          return {
            players: state.players.map((player) => {
              const entry = statusMap.get(player.name);
              if (entry == null) return player;
              const participationStatus = entry.participation_status;
              if (player.recorded && (participationStatus === 'idle' || participationStatus === 'playing')) {
                return { ...player, lastAction: entry.last_action ?? player.lastAction };
              }
              if (player.status === 'not_playing' && (participationStatus === 'idle' || participationStatus === 'playing')) {
                return { ...player, lastAction: entry.last_action ?? player.lastAction };
              }
              const newOutcomeStreet = entry.outcome_street ?? player.outcomeStreet;
              return { ...player, status: participationStatus, outcomeStreet: newOutcomeStreet, lastAction: entry.last_action ?? player.lastAction };
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
