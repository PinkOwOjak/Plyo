import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chooseBotGesture, type Difficulty } from '../engine/ai.ts';
import type { Gesture } from '../engine/gestures.ts';
import { createMatch, currentInnings, other, reduceMatch, type CoinFace, type MatchState, type Side, type TossDecision } from '../engine/match.ts';
import { prefs } from '../../../platform/prefs.ts';
import { profile } from '../../../platform/profile.ts';
import { href } from '../../../platform/router.ts';
import { MatchView, type Reveal } from '../ui/MatchView.tsx';
import { ResultView } from '../ui/ResultView.tsx';
import { TossView, type TossInfo } from '../ui/TossView.tsx';
import { InningsBreak, parseOvers, useRecordResult } from './shared.tsx';

const BOT_NAMES: Record<Difficulty, string> = { easy: 'Pip', medium: 'Rivet', hard: 'Ace' };
const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const YOU: Side = 0;
const BOT: Side = 1;

const freshToss = (): TossInfo => ({ caller: YOU, call: null, coin: null, winner: null, decision: null });

/** Gestures a side has shown in a given role so far this match. */
function history(state: MatchState, side: Side, role: 'bat' | 'bowl'): Gesture[] {
  return state.innings.flatMap((inn) => {
    const batting = inn.battingSide === side;
    if (role === 'bat' && batting) return inn.balls.map((b) => b.batting);
    if (role === 'bowl' && !batting) return inn.balls.map((b) => b.bowling);
    return [];
  });
}

export function BotMatch({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const overs = parseOvers(query.get('overs'), prefs.get().defaultOvers);
  const qd = query.get('difficulty');
  const difficulty: Difficulty = qd === 'easy' || qd === 'hard' || qd === 'medium' ? qd : prefs.get().difficulty;
  const names = useMemo<[string, string]>(() => [me.name, BOT_NAMES[difficulty]], [me.name, difficulty]);

  const [matchId, setMatchId] = useState(1);
  const [state, setState] = useState(() => createMatch({ overs, names }));
  const [toss, setToss] = useState<TossInfo>(freshToss);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const botPick = useRef<{ key: string; gesture: Gesture } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  useRecordResult(state, YOU, 'bot', matchId);

  // The bot commits to its hand as soon as a ball starts, before you choose.
  const cur = currentInnings(state);
  const ballKey = `${matchId}:${state.innings.length}:${cur?.balls.length ?? 0}`;
  useEffect(() => {
    if (state.phase !== 'playing' || !cur || botPick.current?.key === ballKey) return;
    const role = cur.battingSide === BOT ? 'bat' : 'bowl';
    const opponentRole = role === 'bat' ? 'bowl' : 'bat';
    const gesture = chooseBotGesture(
      role,
      { opponentHistory: history(state, YOU, opponentRole), ownHistory: history(state, BOT, role) },
      difficulty,
    );
    botPick.current = { key: ballKey, gesture };
  }, [ballKey, state, cur, difficulty]);

  const submit = useCallback(
    (g: Gesture) => {
      if (state.phase !== 'playing' || reveal || !cur || botPick.current?.key !== ballKey) return;
      const botG = botPick.current.gesture;
      const gestures: [Gesture, Gesture] = [g, botG];
      const batting = cur.battingSide;
      const after = reduceMatch(state, { type: 'ball', batting: gestures[batting], bowling: gestures[other(batting)] });
      setReveal({ id: Date.now(), gestures, after });
    },
    [state, reveal, cur, ballKey],
  );

  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const onRevealDone = useCallback((id: number) => {
    const r = revealRef.current;
    if (!r || r.id !== id) return;
    setState(r.after);
    setReveal(null);
  }, []);

  const finishToss = (t: TossInfo, decision: TossDecision) => {
    const done = { ...t, decision };
    setToss(done);
    later(() => {
      setState((s) => reduceMatch(s, { type: 'toss', caller: done.caller, call: done.call!, coin: done.coin!, decision }));
    }, 1100);
  };

  const onCall = (face: CoinFace) => {
    const coin: CoinFace = Math.random() < 0.5 ? 'heads' : 'tails';
    const winner: Side = face === coin ? YOU : BOT;
    const t: TossInfo = { ...toss, call: face, coin, winner };
    setToss(t);
    if (winner === BOT) later(() => finishToss(t, Math.random() < 0.55 ? 'bowl' : 'bat'), 2000);
  };

  const rematch = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState(createMatch({ overs, names }));
    setToss(freshToss());
    setReveal(null);
    botPick.current = null;
    setMatchId((n) => n + 1);
  };

  let overlay: React.ReactNode = null;
  if (state.phase === 'toss') {
    overlay = <TossView names={names} toss={toss} canAct={(s) => s === YOU} onCall={onCall} onDecide={(d) => finishToss(toss, d)} />;
  } else if (state.phase === 'innings-break' && !reveal) {
    overlay = (
      <InningsBreak
        state={state}
        names={names}
        startLabel={state.innings[0].battingSide === YOU ? 'Start bowling' : 'Start the chase'}
        onStart={() => setState((s) => reduceMatch(s, { type: 'next-innings' }))}
      />
    );
  } else if (state.phase === 'complete' && !reveal) {
    overlay = <ResultView state={state} names={names} you={YOU} onRematch={rematch} exitHref={href('/hand-cricket')} />;
  }

  return (
    <MatchView
      key={matchId}
      title={`vs ${names[BOT]} · ${DIFF_LABEL[difficulty]}`}
      backHref="/hand-cricket"
      state={state}
      names={names}
      nearSide={YOU}
      picker={state.phase === 'playing' && !reveal ? { side: YOU, hidden: false } : null}
      waiting={`${names[BOT]} is ready.`}
      onSubmit={submit}
      reveal={reveal}
      onRevealDone={onRevealDone}
      overlay={overlay}
      opponentSkin={difficulty === 'easy' ? 0 : difficulty === 'medium' ? 3 : 4}
    />
  );
}
