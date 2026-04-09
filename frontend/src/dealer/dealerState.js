const emptyCommunity = { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false };

const STREET_ORDER = { flop: 0, turn: 1, river: 2 };

export function validateOutcomeStreets(players) {
  const winners = players.filter((p) => p.status === 'won' && p.outcomeStreet);
  if (winners.length === 0) return null;

  const winStreet = Math.max(...winners.map((w) => STREET_ORDER[w.outcomeStreet] ?? 0));

  const violations = [];
  for (const p of players) {
    if (p.status === 'playing' || p.status === 'not_playing' || p.status === 'won') continue;
    if (!p.outcomeStreet) continue;
    const s = STREET_ORDER[p.outcomeStreet] ?? 0;
    if (s > winStreet) {
      violations.push(p.name);
    }
  }

  if (violations.length === 0) return null;
  const winnerStreetName = Object.keys(STREET_ORDER).find((k) => STREET_ORDER[k] === winStreet);
  return `${violations.join(', ')} cannot ${violations.length === 1 ? 'have' : 'have'} an outcome after the winner's street (${winnerStreetName}). Please fix before finishing.`;
}

export const initialState = {
  gameId: null,
  currentHandId: null,
  players: [],
  community: { ...emptyCommunity },
  currentStep: 'gameSelector',
  handCount: 0,
  gameDate: null,
};

function initPlayer(name) {
  return { name, card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null };
}

export function reducer(state, action) {
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
        players: state.players.map((p) =>
          p.name === name ? { ...p, card1, card2, recorded: true } : p,
        ),
      };
    }

    case 'SET_COMMUNITY_CARDS': {
      const { flop1, flop2, flop3, turn, river } = action.payload;
      return {
        ...state,
        community: { flop1, flop2, flop3, turn, river, recorded: true },
      };
    }

    case 'RESET_HAND':
      return {
        ...state,
        currentHandId: null,
        players: state.players.map((p) => initPlayer(p.name)),
        community: { ...emptyCommunity },
        handCount: state.handCount + 1,
        currentStep: 'dashboard',
      };

    case 'SET_PLAYER_RESULT': {
      const { name, status, outcomeStreet } = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.name === name ? { ...p, status, outcomeStreet: outcomeStreet || null } : p,
        ),
      };
    }

    case 'SET_HAND_ID':
      return { ...state, currentHandId: action.payload };

    case 'LOAD_HAND': {
      const hand = action.payload;
      const phMap = new Map(
        hand.player_hands.map((ph) => [ph.player_name, ph]),
      );
      const hasCommunity = hand.flop_1 != null;
      return {
        ...state,
        currentHandId: hand.hand_number,
        currentStep: 'playerGrid',
        community: hasCommunity
          ? { flop1: hand.flop_1, flop2: hand.flop_2, flop3: hand.flop_3, turn: hand.turn, river: hand.river, recorded: true }
          : { ...emptyCommunity },
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
    }

    case 'FINISH_HAND':
      return {
        ...state,
        currentHandId: null,
        players: state.players.map((p) => initPlayer(p.name)),
        community: { ...emptyCommunity },
        handCount: state.handCount + 1,
        currentStep: 'dashboard',
      };

    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'UPDATE_PARTICIPATION': {
      const statusMap = new Map(
        action.payload.players.map((p) => [p.name, p.participation_status]),
      );
      return {
        ...state,
        players: state.players.map((p) => {
          const ps = statusMap.get(p.name);
          if (ps == null) return p;
          return { ...p, status: ps };
        }),
      };
    }

    default:
      return state;
  }
}
