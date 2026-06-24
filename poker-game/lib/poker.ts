// ── Types ──────────────────────────────────────────────────────────────────────

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
  hidden?: boolean;
}

export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'bet' | 'all-in';

export interface Player {
  id: 0 | 1;
  name: string;
  chips: number;
  holeCards: Card[];
  currentBet: number;
  folded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
}

export interface GameState {
  phase: GamePhase;
  deck: Card[];
  communityCards: Card[];
  players: [Player, Player];
  pot: number;
  currentPlayerIndex: 0 | 1;
  dealerIndex: 0 | 1;
  smallBlind: number;
  bigBlind: number;
  lastRaiseAmount: number;
  bettingRoundComplete: boolean;
  lastAction: string;
  handResult: HandResult | null;
  roundNumber: number;
  actionsThisRound: number; // track actions to detect when both have acted
  lastAggressorIndex: number | null; // who last bet/raised
}

export interface HandResult {
  winnerIndex: 0 | 1 | -1; // -1 = tie
  winnerName: string;
  handName: string;
  winnerHandName?: string;
  loserHandName?: string;
  pot: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RANKS: Rank[] = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS: Suit[] = ['♠','♥','♦','♣'];
const RANK_VALUES: Record<Rank, number> = {
  '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14
};

// ── Deck ───────────────────────────────────────────────────────────────────────

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Hand Evaluation ────────────────────────────────────────────────────────────

export type HandRank =
  | 'Royal Flush' | 'Straight Flush' | 'Four of a Kind' | 'Full House'
  | 'Flush' | 'Straight' | 'Three of a Kind' | 'Two Pair' | 'One Pair' | 'High Card';

export interface EvaluatedHand {
  rank: HandRank;
  score: number; // higher = better
  cards: Card[];
}

export function evaluateBestHand(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
  const all = [...holeCards, ...communityCards];
  const combos = getCombinations(all, 5);
  let best: EvaluatedHand | null = null;
  for (const combo of combos) {
    const ev = evaluateHand(combo);
    if (!best || ev.score > best.score) best = ev;
  }
  return best!;
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = getCombinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function evaluateHand(cards: Card[]): EvaluatedHand {
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const values = sorted.map(c => RANK_VALUES[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(values);
  const counts = getCounts(values);

  let rank: HandRank;
  let score: number;

  if (isFlush && isStraight) {
    if (values[0] === 14 && values[1] === 13) {
      rank = 'Royal Flush'; score = 9_000_000 + values[0];
    } else {
      rank = 'Straight Flush'; score = 8_000_000 + (isStraight === 'wheel' ? 5 : values[0]);
    }
  } else if (counts[0][1] === 4) {
    rank = 'Four of a Kind'; score = 7_000_000 + counts[0][0] * 100 + counts[1][0];
  } else if (counts[0][1] === 3 && counts[1][1] === 2) {
    rank = 'Full House'; score = 6_000_000 + counts[0][0] * 100 + counts[1][0];
  } else if (isFlush) {
    rank = 'Flush'; score = 5_000_000 + encodeKickers(values);
  } else if (isStraight) {
    rank = 'Straight'; score = 4_000_000 + (isStraight === 'wheel' ? 5 : values[0]);
  } else if (counts[0][1] === 3) {
    rank = 'Three of a Kind'; score = 3_000_000 + counts[0][0] * 10000 + encodeKickers(counts.slice(1).map(c => c[0]));
  } else if (counts[0][1] === 2 && counts[1][1] === 2) {
    const pairs = [counts[0][0], counts[1][0]].sort((a,b) => b-a);
    rank = 'Two Pair'; score = 2_000_000 + pairs[0] * 10000 + pairs[1] * 100 + counts[2][0];
  } else if (counts[0][1] === 2) {
    rank = 'One Pair'; score = 1_000_000 + counts[0][0] * 1000000 + encodeKickers(counts.slice(1).map(c => c[0]));
  } else {
    rank = 'High Card'; score = encodeKickers(values);
  }

  return { rank, score, cards: sorted };
}

function checkStraight(values: number[]): boolean | 'wheel' {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) return false;
  // Check wheel (A-2-3-4-5)
  if (unique[0] === 14 && unique.slice(1, 5).join(',') === '5,4,3,2') return 'wheel';
  for (let i = 0; i <= unique.length - 5; i++) {
    if (unique[i] - unique[i+4] === 4 &&
        unique[i+1] - unique[i+2] === 1 &&
        unique[i+2] - unique[i+3] === 1) return true;
  }
  return false;
}

function getCounts(values: number[]): [number, number][] {
  const map: Record<number, number> = {};
  for (const v of values) map[v] = (map[v] || 0) + 1;
  return Object.entries(map)
    .map(([v, c]) => [parseInt(v), c] as [number, number])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
}

function encodeKickers(values: number[]): number {
  return values.slice(0, 5).reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);
}

// ── Game Logic ─────────────────────────────────────────────────────────────────

export function createInitialState(player1Name: string, player2Name: string): GameState {
  const deck = createDeck();
  return {
    phase: 'waiting',
    deck,
    communityCards: [],
    players: [
      {
        id: 0,
        name: player1Name,
        chips: 1000,
        holeCards: [],
        currentBet: 0,
        folded: false,
        isAllIn: false,
        isDealer: true,
      },
      {
        id: 1,
        name: player2Name,
        chips: 1000,
        holeCards: [],
        currentBet: 0,
        folded: false,
        isAllIn: false,
        isDealer: false,
      },
    ],
    pot: 0,
    currentPlayerIndex: 0,
    dealerIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    lastRaiseAmount: 20,
    bettingRoundComplete: false,
    lastAction: '',
    handResult: null,
    roundNumber: 0,
    actionsThisRound: 0,
    lastAggressorIndex: null,
  };
}

export function startNewHand(state: GameState): GameState {
  const newDealerIndex: 0 | 1 = state.roundNumber === 0
    ? state.dealerIndex
    : ((state.dealerIndex + 1) % 2) as 0 | 1;

  const sbIndex: 0 | 1 = newDealerIndex; // In HU, dealer = small blind
  const bbIndex: 0 | 1 = sbIndex === 0 ? 1 : 0;

  let deck = createDeck();

  // Deal 2 hole cards each
  const p0Cards = [deck[0], deck[1]];
  const p1Cards = [deck[2], deck[3]];
  deck = deck.slice(4);

  const players: [Player, Player] = [
    {
      ...state.players[0],
      holeCards: p0Cards,
      currentBet: 0,
      folded: false,
      isAllIn: false,
      isDealer: newDealerIndex === 0,
    },
    {
      ...state.players[1],
      holeCards: p1Cards,
      currentBet: 0,
      folded: false,
      isAllIn: false,
      isDealer: newDealerIndex === 1,
    },
  ];

  // Post blinds
  const sb = state.smallBlind;
  const bb = state.bigBlind;

  players[sbIndex].chips -= sb;
  players[sbIndex].currentBet = sb;
  players[bbIndex].chips -= bb;
  players[bbIndex].currentBet = bb;

  const pot = sb + bb;

  // Preflop: action starts with SB (dealer) in heads-up
  const firstToAct = sbIndex;

  return {
    ...state,
    phase: 'preflop',
    deck,
    communityCards: [],
    players,
    pot,
    currentPlayerIndex: firstToAct,
    dealerIndex: newDealerIndex,
    lastRaiseAmount: bb,
    bettingRoundComplete: false,
    lastAction: `${players[sbIndex].name} posts small blind $${sb}. ${players[bbIndex].name} posts big blind $${bb}.`,
    handResult: null,
    roundNumber: state.roundNumber + 1,
    actionsThisRound: 0,
    lastAggressorIndex: bbIndex,
  };
}

export function getCallAmount(state: GameState): number {
  const p = state.players[state.currentPlayerIndex];
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
  return Math.min(maxBet - p.currentBet, p.chips);
}

export function canCheck(state: GameState): boolean {
  const p = state.players[state.currentPlayerIndex];
  const maxBet = Math.max(...state.players.map(p => p.currentBet));
  return p.currentBet === maxBet;
}

export function getMinRaise(state: GameState): number {
  return state.lastRaiseAmount;
}

export function applyAction(
  state: GameState,
  action: PlayerAction,
  raiseAmount?: number
): GameState {
  const idx = state.currentPlayerIndex;
  const oppIdx: 0 | 1 = idx === 0 ? 1 : 0;
  const players: [Player, Player] = [{ ...state.players[0] }, { ...state.players[1] }];
  let pot = state.pot;
  let lastAction = '';
  let lastRaiseAmount = state.lastRaiseAmount;
  let lastAggressorIndex = state.lastAggressorIndex;
  const playerName = players[idx].name;

  const maxBet = Math.max(players[0].currentBet, players[1].currentBet);

  if (action === 'fold') {
    players[idx].folded = true;
    lastAction = `${playerName} folds.`;
  } else if (action === 'check') {
    lastAction = `${playerName} checks.`;
  } else if (action === 'call') {
    const callAmt = Math.min(maxBet - players[idx].currentBet, players[idx].chips);
    players[idx].chips -= callAmt;
    players[idx].currentBet += callAmt;
    pot += callAmt;
    if (players[idx].chips === 0) players[idx].isAllIn = true;
    lastAction = `${playerName} calls $${callAmt}.`;
  } else if (action === 'bet' || action === 'raise') {
    const amt = raiseAmount!;
    const totalBet = maxBet + amt;
    const toAdd = Math.min(totalBet - players[idx].currentBet, players[idx].chips);
    players[idx].chips -= toAdd;
    players[idx].currentBet += toAdd;
    pot += toAdd;
    lastRaiseAmount = amt;
    lastAggressorIndex = idx;
    if (players[idx].chips === 0) players[idx].isAllIn = true;
    lastAction = `${playerName} ${action}s $${toAdd}.`;
  } else if (action === 'all-in') {
    const allInAmt = players[idx].chips;
    players[idx].currentBet += allInAmt;
    pot += allInAmt;
    players[idx].chips = 0;
    players[idx].isAllIn = true;
    if (allInAmt > maxBet) lastAggressorIndex = idx;
    lastAction = `${playerName} goes ALL IN ($${allInAmt})!`;
  }

  const actionsThisRound = state.actionsThisRound + 1;

  // Check if betting round is complete
  const bettingRoundComplete = isBettingRoundComplete(
    players, oppIdx, actionsThisRound, lastAggressorIndex, idx, action
  );

  const newState: GameState = {
    ...state,
    players,
    pot,
    lastAction,
    lastRaiseAmount,
    actionsThisRound,
    bettingRoundComplete,
    lastAggressorIndex,
    currentPlayerIndex: bettingRoundComplete ? oppIdx : oppIdx,
  };

  if (bettingRoundComplete || players[idx].folded) {
    return advancePhase({ ...newState, currentPlayerIndex: oppIdx });
  }

  return { ...newState, currentPlayerIndex: oppIdx };
}

function isBettingRoundComplete(
  players: [Player, Player],
  oppIdx: 0 | 1,
  actionsThisRound: number,
  lastAggressorIndex: number | null,
  currentIdx: number,
  action: PlayerAction
): boolean {
  if (action === 'fold') return true;

  const p0 = players[0];
  const p1 = players[1];

  if (p0.isAllIn || p1.isAllIn) return true;

  // If someone just called, round is complete
  if (action === 'call') return true;

  // If current player checked and so did the other (both checked = round over)
  // This is handled by: if last aggressor is null (no bet) and we get a check on 2nd action
  if (action === 'check' && actionsThisRound >= 2) return true;

  return false;
}

function advancePhase(state: GameState): GameState {
  // Check for fold win
  const foldedIdx = state.players.findIndex(p => p.folded);
  if (foldedIdx !== -1) {
    const winnerIdx: 0 | 1 = foldedIdx === 0 ? 1 : 0;
    const winner = state.players[winnerIdx];
    const players: [Player, Player] = [{ ...state.players[0] }, { ...state.players[1] }];
    players[winnerIdx].chips += state.pot;
    return {
      ...state,
      players,
      phase: 'showdown',
      handResult: {
        winnerIndex: winnerIdx,
        winnerName: winner.name,
        handName: 'Fold',
        pot: state.pot,
      },
      bettingRoundComplete: true,
    };
  }

  // Reset bets for next round
  const players: [Player, Player] = [
    { ...state.players[0], currentBet: 0 },
    { ...state.players[1], currentBet: 0 },
  ];

  const nextPhase = getNextPhase(state.phase);

  if (nextPhase === 'showdown') {
    return resolveShowdown({ ...state, players, phase: nextPhase });
  }

  let communityCards = [...state.communityCards];
  let deck = [...state.deck];

  if (nextPhase === 'flop') {
    communityCards = deck.slice(0, 3);
    deck = deck.slice(3);
  } else if (nextPhase === 'turn' || nextPhase === 'river') {
    communityCards = [...communityCards, deck[0]];
    deck = deck.slice(1);
  }

  // Post-flop: action starts with player to left of dealer (non-dealer = index !== dealerIndex)
  const firstToAct: 0 | 1 = state.dealerIndex === 0 ? 1 : 0;

  return {
    ...state,
    players,
    phase: nextPhase,
    communityCards,
    deck,
    currentPlayerIndex: firstToAct,
    lastRaiseAmount: state.bigBlind,
    actionsThisRound: 0,
    lastAggressorIndex: null,
    bettingRoundComplete: false,
  };
}

function getNextPhase(phase: GamePhase): GamePhase {
  const map: Record<string, GamePhase> = {
    preflop: 'flop',
    flop: 'turn',
    turn: 'river',
    river: 'showdown',
  };
  return map[phase] || 'showdown';
}

function resolveShowdown(state: GameState): GameState {
  const p0Hand = evaluateBestHand(state.players[0].holeCards, state.communityCards);
  const p1Hand = evaluateBestHand(state.players[1].holeCards, state.communityCards);

  const players: [Player, Player] = [{ ...state.players[0] }, { ...state.players[1] }];

  let winnerIndex: 0 | 1 | -1;
  let winnerName: string;
  let handName: string;

  if (p0Hand.score > p1Hand.score) {
    winnerIndex = 0;
    winnerName = players[0].name;
    handName = p0Hand.rank;
    players[0].chips += state.pot;
  } else if (p1Hand.score > p0Hand.score) {
    winnerIndex = 1;
    winnerName = players[1].name;
    handName = p1Hand.rank;
    players[1].chips += state.pot;
  } else {
    winnerIndex = -1;
    winnerName = 'Split';
    handName = p0Hand.rank;
    const half = Math.floor(state.pot / 2);
    players[0].chips += half;
    players[1].chips += state.pot - half;
  }

  return {
    ...state,
    players,
    phase: 'showdown',
    handResult: {
      winnerIndex,
      winnerName,
      handName,
      winnerHandName: winnerIndex === 0 ? p0Hand.rank : winnerIndex === 1 ? p1Hand.rank : undefined,
      loserHandName: winnerIndex === 0 ? p1Hand.rank : winnerIndex === 1 ? p0Hand.rank : undefined,
      pot: state.pot,
    },
    bettingRoundComplete: true,
  };
}
