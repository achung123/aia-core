// Texas Hold'em hand evaluator and equity calculator.
// Cards use the app display format: { rank: 'A', suit: '♥' }

export interface Card {
  rank: string;
  suit: string;
}

export interface InternalCard {
  r: number;
  s: number;
}

export enum HandRank {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface EquityResult {
  equity: number;
}

const RANK_VAL: Record<string, number> = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'T':8,'J':9,'Q':10,'K':11,'A':12 };
const SUIT_VAL: Record<string, number> = { '♥':0,'♦':1,'♣':2,'♠':3 };
const HAND_NAMES: string[] = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const B = 14; // base > 13 to avoid collisions
const B5 = B ** 5;

function toI(c: Card): InternalCard {
  return { r: RANK_VAL[c.rank], s: SUIT_VAL[c.suit] };
}

function sc(cat: number, k: number[]): number {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * B + (k[i] || 0);
  return s;
}

// Evaluate exactly 5 internal cards → numeric score (higher = better)
function eval5(c0: InternalCard, c1: InternalCard, c2: InternalCard, c3: InternalCard, c4: InternalCard): number {
  const r = [c0.r, c1.r, c2.r, c3.r, c4.r].sort((a, b) => b - a);
  const flush = c0.s === c1.s && c1.s === c2.s && c2.s === c3.s && c3.s === c4.s;

  // Straight detection
  let str = false, strHi = -1;
  if (new Set(r).size === 5) {
    if (r[0] - r[4] === 4) { str = true; strHi = r[0]; }
    else if (r[0] === 12 && r[1] === 3) { str = true; strHi = 3; } // wheel A-2-3-4-5
  }

  // Rank frequencies — sorted by count desc then rank desc
  const f = new Int8Array(13);
  f[c0.r]++; f[c1.r]++; f[c2.r]++; f[c3.r]++; f[c4.r]++;
  const g: [number, number][] = [];
  for (let i = 12; i >= 0; i--) if (f[i]) g.push([i, f[i]]);
  g.sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (flush && str) return sc(8, [strHi]);
  if (g[0][1] === 4) return sc(7, [g[0][0], g[1][0]]);
  if (g[0][1] === 3 && g[1][1] === 2) return sc(6, [g[0][0], g[1][0]]);
  if (flush) return sc(5, r);
  if (str) return sc(4, [strHi]);
  if (g[0][1] === 3) return sc(3, [g[0][0], g[1][0], g[2][0]]);
  if (g[0][1] === 2 && g[1][1] === 2) return sc(2, [g[0][0], g[1][0], g[2][0]]);
  if (g[0][1] === 2) return sc(1, [g[0][0], g[1][0], g[2][0], g[3][0]]);
  return sc(0, r);
}

// Best 5-card score from 5–7 cards (internal format)
function bestScore(cards: InternalCard[]): number {
  const n = cards.length;
  if (n < 5) return -1;
  let best = -1;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let c = b + 1; c < n - 2; c++)
        for (let d = c + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++) {
            const s = eval5(cards[a], cards[b], cards[c], cards[d], cards[e]);
            if (s > best) best = s;
          }
  return best;
}

function buildDeck(known: InternalCard[]): InternalCard[] {
  const used = new Set<number>();
  for (const c of known) used.add(c.r * 4 + c.s);
  const deck: InternalCard[] = [];
  for (let r = 0; r < 13; r++)
    for (let s = 0; s < 4; s++)
      if (!used.has(r * 4 + s)) deck.push({ r, s });
  return deck;
}

function shuffle(arr: InternalCard[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
}

function evalBoard(players: InternalCard[][], board: InternalCard[]): number[] {
  const scores = players.map(p => bestScore([...p, ...board]));
  const mx = Math.max(...scores);
  const wc = scores.filter(s => s === mx).length;
  return scores.map(s => s === mx ? 1 / wc : 0);
}

/**
 * Calculate win equity for each player.
 * @param playerHoleCards - per-player [card1, card2]
 * @param communityCards - 0-5 known board cards
 * @returns equity per player (0-1)
 */
export function calculateEquity(playerHoleCards: Card[][], communityCards: Card[]): EquityResult[] {
  const players = playerHoleCards.map(hc => hc.map(toI));
  const board = communityCards.filter(Boolean).map(toI);
  const allKnown: InternalCard[] = [...board];
  players.forEach(p => allKnown.push(...p));
  const deck = buildDeck(allKnown);
  const remaining = 5 - board.length;
  const wins = new Float64Array(players.length);
  let n = 0;

  if (remaining === 0) {
    return evalBoard(players, board).map(eq => ({ equity: eq }));
  }

  if (remaining === 1) {
    for (let i = 0; i < deck.length; i++) {
      const b = [...board, deck[i]];
      const res = evalBoard(players, b);
      for (let j = 0; j < res.length; j++) wins[j] += res[j];
      n++;
    }
  } else if (remaining === 2) {
    for (let i = 0; i < deck.length - 1; i++)
      for (let j = i + 1; j < deck.length; j++) {
        const b = [...board, deck[i], deck[j]];
        const res = evalBoard(players, b);
        for (let k = 0; k < res.length; k++) wins[k] += res[k];
        n++;
      }
  } else {
    // Monte Carlo for 3+ remaining cards (pre-flop and flop-minus cases)
    const ITERS = 5000;
    const d = [...deck];
    for (let iter = 0; iter < ITERS; iter++) {
      shuffle(d);
      const b = [...board, ...d.slice(0, remaining)];
      const res = evalBoard(players, b);
      for (let j = 0; j < res.length; j++) wins[j] += res[j];
      n++;
    }
  }

  return Array.from(wins).map(w => ({ equity: w / n }));
}

/** Human-readable hand category from a score (for display) */
export function handCategory(score: number): string {
  return HAND_NAMES[Math.floor(score / B5)] || '';
}
