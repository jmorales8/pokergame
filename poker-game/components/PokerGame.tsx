'use client';
import { useState, useCallback } from 'react';
import {
  GameState, PlayerAction,
  createInitialState, startNewHand, applyAction,
  getCallAmount, canCheck, getMinRaise,
} from '@/lib/poker';
import Card from './Card';

const PHASE_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown',
};

export default function PokerGame() {
  const [state, setState] = useState<GameState>(() =>
    createInitialState('Player 1', 'Player 2')
  );
  const [raiseInput, setRaiseInput] = useState('');
  const [log, setLog] = useState<string[]>([]);
  const [showSetup, setShowSetup] = useState(true);
  const [names, setNames] = useState({ p1: 'Player 1', p2: 'Player 2' });

  const addLog = useCallback((msg: string) => {
    if (msg) setLog(prev => [...prev.slice(-30), msg]);
  }, []);

  const handleStartGame = () => {
    const s = createInitialState(names.p1, names.p2);
    const hand = startNewHand(s);
    setState(hand);
    addLog(`--- Round 1 started ---`);
    addLog(hand.lastAction);
    setShowSetup(false);
  };

  const handleNewHand = () => {
    const hand = startNewHand(state);
    setState(hand);
    addLog(`--- Round ${hand.roundNumber} started ---`);
    addLog(hand.lastAction);
    setRaiseInput('');
  };

  const handleAction = (action: PlayerAction) => {
    let raise: number | undefined;
    if (action === 'raise' || action === 'bet') {
      raise = parseInt(raiseInput);
      if (!raise || raise < getMinRaise(state)) {
        alert(`Minimum raise is $${getMinRaise(state)}`);
        return;
      }
    }

    const newState = applyAction(state, action, raise);
    setState(newState);
    addLog(newState.lastAction);
    setRaiseInput('');

    if (newState.handResult) {
      const r = newState.handResult;
      if (r.winnerIndex === -1) {
        addLog(`🤝 Split pot! $${r.pot} split evenly.`);
      } else {
        const winner = newState.players[r.winnerIndex];
        addLog(`🏆 ${r.winnerName} wins $${r.pot} with ${r.handName}!`);
      }
    }
  };

  const currentPlayer = state.players[state.currentPlayerIndex];
  const opponentIndex: 0 | 1 = state.currentPlayerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const callAmt = getCallAmount(state);
  const checkable = canCheck(state);
  const minRaise = getMinRaise(state);
  const isActive = state.phase !== 'waiting' && state.phase !== 'showdown';
  const maxBet = Math.max(state.players[0].currentBet, state.players[1].currentBet);
  const isBettingPhase = maxBet === 0;
  const actionLabel = isBettingPhase ? 'Bet' : 'Raise';

  if (showSetup) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">♠️</div>
            <h1 className="text-3xl font-bold text-yellow-400 tracking-tight">Texas Hold'em</h1>
            <p className="text-slate-400 mt-1">Heads-Up Poker</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1">Player 1 Name</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                value={names.p1}
                onChange={e => setNames(n => ({ ...n, p1: e.target.value }))}
                placeholder="Player 1"
              />
            </div>
            <div>
              <label className="text-slate-300 text-sm font-medium block mb-1">Player 2 Name</label>
              <input
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500"
                value={names.p2}
                onChange={e => setNames(n => ({ ...n, p2: e.target.value }))}
                placeholder="Player 2"
              />
            </div>
            <button
              onClick={handleStartGame}
              disabled={!names.p1.trim() || !names.p2.trim()}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-lg transition-colors mt-2"
            >
              Deal Cards
            </button>
          </div>
          <div className="mt-6 text-slate-500 text-xs text-center">
            Blinds: $10 / $20 · Starting chips: $1,000
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-4 w-full max-w-2xl">
        <h1 className="text-yellow-400 font-bold text-lg tracking-wide">♠ Texas Hold'em</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-500 text-sm">Round {state.roundNumber}</span>
          <span className="bg-slate-700 text-yellow-300 text-xs font-bold px-3 py-1 rounded-full">
            {PHASE_LABELS[state.phase]}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-2xl bg-gradient-to-br from-emerald-900 to-emerald-950 rounded-2xl border-4 border-yellow-800/40 shadow-2xl p-6">

        {/* Opponent (top) */}
        <PlayerRow
          player={opponent}
          isCurrentTurn={!isActive ? false : state.currentPlayerIndex === opponentIndex}
          hideCards={state.phase !== 'showdown'}
          isDealer={opponent.isDealer}
          isTop
        />

        {/* Community cards + pot */}
        <div className="my-6">
          <div className="text-center text-slate-400 text-xs font-medium mb-2 uppercase tracking-widest">
            Community Cards
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            {[0, 1, 2, 3, 4].map(i => (
              <Card
                key={i}
                card={state.communityCards[i]}
                hidden={!state.communityCards[i]}
                size="lg"
              />
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-slate-400 text-xs uppercase tracking-wider">Pot</div>
              <div className="text-yellow-300 font-bold text-xl">${state.pot}</div>
            </div>
            {state.players[0].currentBet > 0 && (
              <div className="text-center">
                <div className="text-slate-400 text-xs uppercase tracking-wider">Bets</div>
                <div className="text-white text-sm">
                  ${state.players[0].currentBet} · ${state.players[1].currentBet}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Current player (bottom) */}
        <PlayerRow
          player={currentPlayer}
          isCurrentTurn={isActive}
          hideCards={false}
          isDealer={currentPlayer.isDealer}
          isTop={false}
        />
      </div>

      {/* Action controls */}
      <div className="w-full max-w-2xl">
        {state.phase === 'showdown' ? (
          <ShowdownPanel state={state} onNewHand={handleNewHand} />
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="text-slate-400 text-sm mb-3 text-center">
              <span className="text-white font-semibold">{currentPlayer.name}</span>'s turn
              {currentPlayer.isDealer && <span className="ml-2 text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">DEALER / SB</span>}
            </div>
            <div className="flex flex-wrap gap-2 justify-center mb-3">
              <button
                onClick={() => handleAction('fold')}
                className="px-5 py-2.5 bg-red-900/60 hover:bg-red-800 text-red-200 font-semibold rounded-lg border border-red-800/50 transition-colors"
              >
                Fold
              </button>
              {checkable ? (
                <button
                  onClick={() => handleAction('check')}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold rounded-lg border border-slate-600 transition-colors"
                >
                  Check
                </button>
              ) : (
                <button
                  onClick={() => handleAction('call')}
                  disabled={callAmt === 0}
                  className="px-5 py-2.5 bg-blue-900/60 hover:bg-blue-800 disabled:opacity-40 text-blue-200 font-semibold rounded-lg border border-blue-800/50 transition-colors"
                >
                  Call ${callAmt}
                </button>
              )}
              <button
                onClick={() => handleAction('all-in')}
                className="px-5 py-2.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 font-semibold rounded-lg border border-purple-800/50 transition-colors"
              >
                All In (${currentPlayer.chips})
              </button>
            </div>
            <div className="flex gap-2 items-center justify-center">
              <input
                type="number"
                value={raiseInput}
                onChange={e => setRaiseInput(e.target.value)}
                placeholder={`Min ${actionLabel}: $${minRaise}`}
                min={minRaise}
                max={currentPlayer.chips}
                className="w-40 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={() => handleAction(isBettingPhase ? 'bet' : 'raise')}
                className="px-5 py-2 bg-yellow-600 hover:bg-yellow-500 text-slate-900 font-bold rounded-lg transition-colors"
              >
                {actionLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action log */}
      <div className="w-full max-w-2xl bg-slate-800/60 rounded-xl border border-slate-700/50 p-3 max-h-36 overflow-y-auto">
        <div className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-2">Action Log</div>
        {log.length === 0 ? (
          <div className="text-slate-600 text-xs">No actions yet.</div>
        ) : (
          [...log].reverse().map((entry, i) => (
            <div key={i} className={`text-xs py-0.5 ${entry.startsWith('---') ? 'text-yellow-600/70 font-semibold mt-1' : entry.includes('🏆') || entry.includes('🤝') ? 'text-yellow-400' : 'text-slate-400'}`}>
              {entry}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PlayerRow({
  player, isCurrentTurn, hideCards, isDealer, isTop
}: {
  player: ReturnType<typeof createInitialState>['players'][0];
  isCurrentTurn: boolean;
  hideCards: boolean;
  isDealer: boolean;
  isTop: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 ${isTop ? 'flex-row-reverse' : ''}`}>
      {/* Cards */}
      <div className="flex gap-1.5">
        {player.holeCards.map((card, i) => (
          <Card key={i} card={card} hidden={hideCards} size="md" />
        ))}
        {player.holeCards.length === 0 && (
          <>
            <Card hidden size="md" />
            <Card hidden size="md" />
          </>
        )}
      </div>

      {/* Info */}
      <div className={`flex-1 ${isTop ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 flex-wrap">
          {isTop && <div className="flex-1" />}
          {player.folded && <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full">Folded</span>}
          {player.isAllIn && <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full">All In</span>}
          {isDealer && !player.folded && (
            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">D / SB</span>
          )}
          <span className={`font-bold text-base ${isCurrentTurn && !player.folded ? 'text-yellow-300' : 'text-white'}`}>
            {player.name}
          </span>
        </div>
        <div className="text-emerald-400 font-semibold">${player.chips}</div>
        {player.currentBet > 0 && (
          <div className="text-yellow-500 text-xs">Bet: ${player.currentBet}</div>
        )}
      </div>

      {/* Turn indicator */}
      <div className={`w-2 h-2 rounded-full ${isCurrentTurn && !player.folded ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-transparent'}`} />
    </div>
  );
}

function ShowdownPanel({ state, onNewHand }: { state: GameState; onNewHand: () => void }) {
  const r = state.handResult;
  const bustedPlayer = state.players.find(p => p.chips === 0);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 text-center">
      {bustedPlayer ? (
        <div className="mb-4">
          <div className="text-3xl mb-1">💀</div>
          <div className="text-white font-bold text-lg">{bustedPlayer.name} is out of chips!</div>
          <div className="text-yellow-400 mt-1">{state.players.find(p => p.chips > 0)?.name} wins the game!</div>
        </div>
      ) : r ? (
        <div className="mb-4">
          {r.winnerIndex === -1 ? (
            <>
              <div className="text-2xl mb-1">🤝</div>
              <div className="text-white font-bold text-lg">Split Pot!</div>
              <div className="text-slate-300 text-sm">Both players split ${r.pot}</div>
            </>
          ) : (
            <>
              <div className="text-2xl mb-1">🏆</div>
              <div className="text-white font-bold text-lg">{r.winnerName} wins ${r.pot}!</div>
              {r.handName !== 'Fold' && (
                <div className="text-yellow-400 text-sm mt-1">
                  {r.winnerHandName && <span className="font-semibold">{r.winnerHandName}</span>}
                  {r.loserHandName && <span className="text-slate-400"> vs {r.loserHandName}</span>}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {!bustedPlayer && (
        <button
          onClick={onNewHand}
          className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold px-8 py-2.5 rounded-lg transition-colors"
        >
          Next Hand →
        </button>
      )}
    </div>
  );
}
