// Texas Hold'em hand evaluator and equity calculator.
// Cards use the app display format: { rank: 'A', suit: '♥' }

export interface Card {
  rank: string;
  suit: string;
}

export interface InternalCard {
  rank: number;
  suit: number;
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

const RANK_VALUE: Record<string, number> = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'T':8,'J':9,'Q':10,'K':11,'A':12 };
const SUIT_VALUE: Record<string, number> = { '♥':0,'♦':1,'♣':2,'♠':3 };
const HAND_CATEGORY_NAMES: string[] = ['High Card','Pair','Two Pair','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const SCORE_BASE = 14; // base > 13 to avoid collisions
const SCORE_BASE_POWER_5 = SCORE_BASE ** 5;

function convertCardToInternal(card: Card): InternalCard {
  return { rank: RANK_VALUE[card.rank], suit: SUIT_VALUE[card.suit] };
}

function computeHandScore(category: number, kickers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) score = score * SCORE_BASE + (kickers[i] || 0);
  return score;
}

// Evaluate exactly 5 internal cards → numeric score (higher = better)
function evaluateFiveCardHand(card0: InternalCard, card1: InternalCard, card2: InternalCard, card3: InternalCard, card4: InternalCard): number {
  const ranksDescending = [card0.rank, card1.rank, card2.rank, card3.rank, card4.rank].sort((a, b) => b - a);
  const isFlush = card0.suit === card1.suit && card1.suit === card2.suit && card2.suit === card3.suit && card3.suit === card4.suit;

  // Straight detection
  let isStraight = false, straightHighCard = -1;
  if (new Set(ranksDescending).size === 5) {
    if (ranksDescending[0] - ranksDescending[4] === 4) { isStraight = true; straightHighCard = ranksDescending[0]; }
    else if (ranksDescending[0] === 12 && ranksDescending[1] === 3) { isStraight = true; straightHighCard = 3; } // wheel A-2-3-4-5
  }

  // Rank frequencies — sorted by count desc then rank desc
  const rankFrequencies = new Int8Array(13);
  rankFrequencies[card0.rank]++; rankFrequencies[card1.rank]++; rankFrequencies[card2.rank]++; rankFrequencies[card3.rank]++; rankFrequencies[card4.rank]++;
  const frequencyGroups: [number, number][] = [];
  for (let i = 12; i >= 0; i--) if (rankFrequencies[i]) frequencyGroups.push([i, rankFrequencies[i]]);
  frequencyGroups.sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (isFlush && isStraight) return computeHandScore(8, [straightHighCard]);
  if (frequencyGroups[0][1] === 4) return computeHandScore(7, [frequencyGroups[0][0], frequencyGroups[1][0]]);
  if (frequencyGroups[0][1] === 3 && frequencyGroups[1][1] === 2) return computeHandScore(6, [frequencyGroups[0][0], frequencyGroups[1][0]]);
  if (isFlush) return computeHandScore(5, ranksDescending);
  if (isStraight) return computeHandScore(4, [straightHighCard]);
  if (frequencyGroups[0][1] === 3) return computeHandScore(3, [frequencyGroups[0][0], frequencyGroups[1][0], frequencyGroups[2][0]]);
  if (frequencyGroups[0][1] === 2 && frequencyGroups[1][1] === 2) return computeHandScore(2, [frequencyGroups[0][0], frequencyGroups[1][0], frequencyGroups[2][0]]);
  if (frequencyGroups[0][1] === 2) return computeHandScore(1, [frequencyGroups[0][0], frequencyGroups[1][0], frequencyGroups[2][0], frequencyGroups[3][0]]);
  return computeHandScore(0, ranksDescending);
}

// Best 5-card score from 5–7 cards (internal format)
function findBestFiveCardScore(cards: InternalCard[]): number {
  const cardCount = cards.length;
  if (cardCount < 5) return -1;
  let bestScore = -1;
  for (let a = 0; a < cardCount - 4; a++)
    for (let b = a + 1; b < cardCount - 3; b++)
      for (let c = b + 1; c < cardCount - 2; c++)
        for (let d = c + 1; d < cardCount - 1; d++)
          for (let e = d + 1; e < cardCount; e++) {
            const score = evaluateFiveCardHand(cards[a], cards[b], cards[c], cards[d], cards[e]);
            if (score > bestScore) bestScore = score;
          }
  return bestScore;
}

function buildRemainingDeck(knownCards: InternalCard[]): InternalCard[] {
  const usedCardIds = new Set<number>();
  for (const card of knownCards) usedCardIds.add(card.rank * 4 + card.suit);
  const deck: InternalCard[] = [];
  for (let rankIndex = 0; rankIndex < 13; rankIndex++)
    for (let suitIndex = 0; suitIndex < 4; suitIndex++)
      if (!usedCardIds.has(rankIndex * 4 + suitIndex)) deck.push({ rank: rankIndex, suit: suitIndex });
  return deck;
}

function shuffleDeck(cards: InternalCard[]): void {
  for (let i = cards.length - 1; i > 0; i--) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    const temporary = cards[i]; cards[i] = cards[swapIndex]; cards[swapIndex] = temporary;
  }
}

function evaluateBoardForAllPlayers(playerCards: InternalCard[][], boardCards: InternalCard[]): number[] {
  const scores = playerCards.map(hand => findBestFiveCardScore([...hand, ...boardCards]));
  const maxScore = Math.max(...scores);
  const winnerCount = scores.filter(score => score === maxScore).length;
  return scores.map(score => score === maxScore ? 1 / winnerCount : 0);
}

/**
 * Calculate win equity for each player.
 * @param playerHoleCards - per-player [card1, card2]
 * @param communityCards - 0-5 known board cards
 * @returns equity per player (0-1)
 */
export function calculateEquity(playerHoleCards: Card[][], communityCards: Card[]): EquityResult[] {
  const internalPlayerCards = playerHoleCards.map(holeCards => holeCards.map(convertCardToInternal));
  const boardCards = communityCards.filter(Boolean).map(convertCardToInternal);
  const allKnownCards: InternalCard[] = [...boardCards];
  internalPlayerCards.forEach(playerHand => allKnownCards.push(...playerHand));
  const remainingDeck = buildRemainingDeck(allKnownCards);
  const cardsToReveal = 5 - boardCards.length;
  const equityAccumulator = new Float64Array(internalPlayerCards.length);
  let simulationCount = 0;

  if (cardsToReveal === 0) {
    return evaluateBoardForAllPlayers(internalPlayerCards, boardCards).map(equity => ({ equity }));
  }

  if (cardsToReveal === 1) {
    for (let i = 0; i < remainingDeck.length; i++) {
      const fullBoard = [...boardCards, remainingDeck[i]];
      const results = evaluateBoardForAllPlayers(internalPlayerCards, fullBoard);
      for (let j = 0; j < results.length; j++) equityAccumulator[j] += results[j];
      simulationCount++;
    }
  } else if (cardsToReveal === 2) {
    for (let i = 0; i < remainingDeck.length - 1; i++)
      for (let j = i + 1; j < remainingDeck.length; j++) {
        const fullBoard = [...boardCards, remainingDeck[i], remainingDeck[j]];
        const results = evaluateBoardForAllPlayers(internalPlayerCards, fullBoard);
        for (let k = 0; k < results.length; k++) equityAccumulator[k] += results[k];
        simulationCount++;
      }
  } else {
    // Monte Carlo for 3+ remaining cards (pre-flop and flop-minus cases)
    const MONTE_CARLO_ITERATIONS = 5000;
    const shuffledDeck = [...remainingDeck];
    for (let iteration = 0; iteration < MONTE_CARLO_ITERATIONS; iteration++) {
      shuffleDeck(shuffledDeck);
      const fullBoard = [...boardCards, ...shuffledDeck.slice(0, cardsToReveal)];
      const results = evaluateBoardForAllPlayers(internalPlayerCards, fullBoard);
      for (let j = 0; j < results.length; j++) equityAccumulator[j] += results[j];
      simulationCount++;
    }
  }

  return Array.from(equityAccumulator).map(totalWins => ({ equity: totalWins / simulationCount }));
}

/** Human-readable hand category from a score (for display) */
export function handCategory(score: number): string {
  return HAND_CATEGORY_NAMES[Math.floor(score / SCORE_BASE_POWER_5)] || '';
}
