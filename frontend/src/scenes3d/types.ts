// Shared scenes3d types — consumed by <PokerTable>, <SessionReplayShell>,
// and the handsToTableState adapter. Shapes mirror plan.md § "Public API".

export type Suit = 's' | 'h' | 'd' | 'c';

export type CardRef = {
  rank: string;
  suit: Suit;
  /** Canonical id, e.g. 'Ah', '10d'. */
  id: string;
};

export type ActionName =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all-in';

export type ResultLabel = 'won' | 'lost' | 'folded' | 'handed_back';

export type SeatState = {
  seatIndex: number;
  playerName: string | null;
  /** game_player.is_active */
  isActive: boolean;
  /** current_chips */
  stack: number;
  /** Summed from actions for the current phase. */
  committedThisStreet: number;
  /** status.players[].pot_contribution */
  committedTotal: number;
  lastAction:
    | null
    | {
        action: ActionName;
        amount?: number;
        street: string;
      };
  holeCards: [CardRef, CardRef] | null;
  folded: boolean;
  result: ResultLabel | null;
  profitLoss: number | null;
  winningHand: string | null;
};

export type TableStatePhase =
  | 'awaiting_cards'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown';

export type TableState = {
  gameId: number;
  handId: number;
  handNumber: number;
  phase: TableStatePhase;
  /** 0=preflop (also awaiting_cards), 1=flop, 2=turn, 3=river, 4=showdown. */
  streetIndex: 0 | 1 | 2 | 3 | 4;
  /** Length 5: [flop1, flop2, flop3, turn, river]; null until revealed. */
  community: (CardRef | null)[];
  seats: SeatState[];
  pot: number;
  sidePots: { amount: number; eligiblePlayers: string[] }[];
  dealerSeat: number | null;
  sbSeat: number | null;
  bbSeat: number | null;
  currentSeat: number | null;
};

export type Policy = 'spectator' | 'player';

export type ViewerContext = {
  policy: Policy;
  /** Required when policy === 'player'; ignored otherwise. */
  seat?: number;
};

export type QualityTier = 'low' | 'medium' | 'high';
