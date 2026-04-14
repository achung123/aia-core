import type { CommunityCards, Player, DealerState } from '../stores/dealerStore';

// Re-export types from the Zustand store for backward compatibility
export type { CommunityCards, Player, DealerState };

// --- Action Types ---

export type DealerAction =
  | { type: 'SET_GAME'; payload: { gameId: number; players: string[]; gameDate: string } }
  | { type: 'SET_PLAYER_CARDS'; payload: { name: string; card1: string; card2: string } }
  | { type: 'SET_COMMUNITY_CARDS'; payload: { flop1: string; flop2: string; flop3: string; turn?: string | null; river?: string | null } }
  | { type: 'SET_FLOP_CARDS'; payload: { flop1: string; flop2: string; flop3: string } }
  | { type: 'SET_TURN_CARD'; payload: string }
  | { type: 'SET_RIVER_CARD'; payload: string }
  | { type: 'RESET_HAND' }
  | { type: 'SET_PLAYER_RESULT'; payload: { name: string; status: string; outcomeStreet?: string | null } }
  | { type: 'SET_HAND_ID'; payload: number }
  | { type: 'LOAD_HAND'; payload: LoadHandPayload }
  | { type: 'FINISH_HAND' }
  | { type: 'SET_STEP'; payload: string }
  | { type: 'UPDATE_PARTICIPATION'; payload: { players: { name: string; participation_status: string; outcome_street?: string | null; last_action?: string | null }[] } }
  | { type: 'RESTORE_STATE'; payload: Partial<DealerState> };

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

export const initialState: DealerState = {
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
  return { name, card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null, lastAction: null };
}

export function validateOutcomeStreets(players: Player[]): string | null {
  // Collect all players that have a decisive result AND an outcome_street
  const decided = players.filter(
    (player) => (player.status === 'won' || player.status === 'lost' || player.status === 'folded') && player.outcomeStreet,
  );
  if (decided.length === 0) return null;

  // Separate showdown players (won/lost) from folders
  const showdown = decided.filter((player) => player.status === 'won' || player.status === 'lost');
  const folders = decided.filter((player) => player.status === 'folded');

  // All showdown players must share the same outcome_street
  const showdownStreets = new Set(showdown.map((player) => player.outcomeStreet));
  if (showdownStreets.size > 1) {
    const mismatch = showdown.map((player) => `${player.name} (${player.outcomeStreet})`).join(', ');
    return `Winners and losers must share the same outcome street. Found: ${mismatch}. Please fix before finishing.`;
  }

  // If we have a showdown street, all folders must be on or before it
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

// --- Reducer ---

export function reducer(state: DealerState, action: DealerAction): DealerState {
  switch (action.type) {
    case 'SET_GAME': {
      const { gameId, players, gameDate } = action.payload;
      return {
        ...state,
        gameId,
        gameDate,
        players: players.map(initPlayer),
        community: { ...emptyCommunity },
        currentStep: 'dashboard',
      };
    }

    case 'SET_PLAYER_CARDS': {
      const { name, card1, card2 } = action.payload;
      return {
        ...state,
        players: state.players.map((player) =>
          player.name === name ? { ...player, card1, card2, recorded: true } : player,
        ),
      };
    }

    case 'SET_COMMUNITY_CARDS': {
      const { flop1, flop2, flop3, turn, river } = action.payload;
      return {
        ...state,
        community: {
          ...state.community,
          flop1, flop2, flop3,
          flopRecorded: !!(flop1 && flop2 && flop3),
          turn: turn ?? state.community.turn,
          turnRecorded: turn ? true : state.community.turnRecorded,
          river: river ?? state.community.river,
          riverRecorded: river ? true : state.community.riverRecorded,
        },
      };
    }

    case 'SET_FLOP_CARDS': {
      const { flop1, flop2, flop3 } = action.payload;
      return {
        ...state,
        community: { ...state.community, flop1, flop2, flop3, flopRecorded: true },
      };
    }

    case 'SET_TURN_CARD': {
      return {
        ...state,
        community: { ...state.community, turn: action.payload, turnRecorded: true },
      };
    }

    case 'SET_RIVER_CARD': {
      return {
        ...state,
        community: { ...state.community, river: action.payload, riverRecorded: true },
      };
    }

    case 'RESET_HAND':
      return {
        ...state,
        currentHandId: null,
        players: state.players.map((player) => initPlayer(player.name)),
        community: { ...emptyCommunity },
        handCount: state.handCount + 1,
        currentStep: 'dashboard',
      };

    case 'SET_PLAYER_RESULT': {
      const { name, status, outcomeStreet } = action.payload;
      return {
        ...state,
        players: state.players.map((player) =>
          player.name === name ? { ...player, status, outcomeStreet: outcomeStreet || null } : player,
        ),
      };
    }

    case 'SET_HAND_ID':
      return { ...state, currentHandId: action.payload };

    case 'LOAD_HAND': {
      const hand = action.payload;
      const playerHandMap = new Map(
        hand.player_hands.map((playerHand) => [playerHand.player_name, playerHand]),
      );
      const hasFlopCards = hand.flop_1 != null;
      return {
        ...state,
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
        players: state.players.map((player) => {
          const playerHand = playerHandMap.get(player.name);
          if (!playerHand) return initPlayer(player.name);
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
    }

    case 'FINISH_HAND':
      return {
        ...state,
        currentHandId: null,
        players: state.players.map((player) => initPlayer(player.name)),
        community: { ...emptyCommunity },
        handCount: state.handCount + 1,
        currentStep: 'dashboard',
      };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'UPDATE_PARTICIPATION': {
      const statusMap = new Map(
        action.payload.players.map((player) => [player.name, player]),
      );
      return {
        ...state,
        players: state.players.map((player) => {
          const entry = statusMap.get(player.name);
          if (entry == null) return player;
          const participationStatus = entry.participation_status;
          // Don't let a stale poll reset a manually-recorded player to idle/playing
          if (player.recorded && (participationStatus === 'idle' || participationStatus === 'playing')) return player;
          // Don't let poll revert a locally-set sit-out (not_playing) status
          if (player.status === 'not_playing' && (participationStatus === 'idle' || participationStatus === 'playing')) return player;
          const newOutcomeStreet = entry.outcome_street ?? player.outcomeStreet;
          return { ...player, status: participationStatus, outcomeStreet: newOutcomeStreet };
        }),
      };
    }

    case 'RESTORE_STATE': {
      const restored = { ...state, ...action.payload };
      // Steps that depend on ephemeral local state (outcomeTarget)
      // cannot survive a restore — fall back to activeHand
      if (restored.currentStep === 'outcome') {
        restored.currentStep = 'activeHand';
      }
      return restored;
    }

    default:
      return state;
  }
}
