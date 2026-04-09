const emptyCommunity = { flop1: null, flop2: null, flop3: null, turn: null, river: null, recorded: false };

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
  return { name, card1: null, card2: null, recorded: false, status: 'playing' };
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
      const { name, status } = action.payload;
      return {
        ...state,
        players: state.players.map((p) =>
          p.name === name ? { ...p, status } : p,
        ),
      };
    }

    case 'SET_HAND_ID':
      return { ...state, currentHandId: action.payload };

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

    default:
      return state;
  }
}
