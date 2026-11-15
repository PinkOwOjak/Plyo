import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Gesture } from '../engine/gestures.ts';
import { createMatch, currentInnings, other, reduceMatch, type CoinFace, type Side, type TossDecision } from '../engine/match.ts';
import { prefs } from '../../../platform/prefs.ts';
import { cleanName, profile } from '../../../platform/profile.ts';
import { href } from '../../../platform/router.ts';
import { MatchView, type Reveal } from '../ui/MatchView.tsx';
import { ResultView } from '../ui/ResultView.tsx';
import { TossView, type TossInfo } from '../ui/TossView.tsx';
import { InningsBreak, parseOvers, useRecordResult } from './shared.tsx';

type Step = { kind: 'handoff'; side: Side } | { kind: 'pick'; side: Side };

/**
 * Pass & play: the batter chooses in secret, passes the device, then the
 * bowler chooses in secret. Both hands are revealed together.
 */
export function LocalMatch({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const overs = parseOvers(query.get('overs'), prefs.get().defaultOvers);
  const p2 = cleanName(query.get('p2') ?? '', 'Player 2');
  const names = useMemo<[string, string]>(() => [me.name, p2 === me.name ? `${p2} 2` : p2], [me.name, p2]);

  const [matchId, setMatchId] = useState(1);
  const [state, setState] = useState(() => createMatch({ overs, names }));
  const [toss, setToss] = useState<TossInfo>({ caller: 1, call: null, coin: null, winner: null, decision: null });
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const firstPick = useRef<Gesture | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useRecordResult(state, 0, 'local', matchId);

  const cur = currentInnings(state);
  const batter = cur?.battingSide ?? 0;

  // Each new ball starts with the batter, behind a hand-off screen.
  const ballKey = `${matchId}:${state.innings.length}:${cur?.balls.length ?? 0}`;
  const lastBall = useRef('');
  useEffect(() => {
    if (state.phase !== 'playing' || reveal || lastBall.current === ballKey) return;
    lastBall.current = ballKey;
    firstPick.current = null;
    setStep({ kind: 'handoff', side: batter });
  }, [state.phase, reveal, ballKey, batter]);

  const submit = useCallback(
    (g: Gesture) => {
      if (!step || step.kind !== 'pick' || !cur) return;
      if (step.side === batter) {
        firstPick.current = g;
        setStep({ kind: 'handoff', side: other(batter) });
        return;
      }
      const gestures: [Gesture, Gesture] = batter === 0 ? [firstPick.current!, g] : [g, firstPick.current!];
      const after = reduceMatch(state, { type: 'ball', batting: gestures[batter], bowling: gestures[other(batter)] });
      setStep(null);
      setReveal({ id: Date.now(), gestures, after });
    },
    [step, cur, batter, state],
  );

  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const onRevealDone = useCallback((id: number) => {
    const r = revealRef.current;
    if (!r || r.id !== id) return;
    setState(r.after);
    setReveal(null);
  }, []);

  const onCall = (face: CoinFace) => {
    const coin: CoinFace = Math.random() < 0.5 ? 'heads' : 'tails';
    setToss((t) => ({ ...t, call: face, coin, winner: face === coin ? t.caller : other(t.caller) }));
  };
  const onDecide = (decision: TossDecision) => {
    const t = { ...toss, decision };
    setToss(t);
    timers.current.push(
      setTimeout(() => setState((s) => reduceMatch(s, { type: 'toss', caller: t.caller, call: t.call!, coin: t.coin!, decision })), 1000),
    );
  };

  const rematch = () => {
    setState(createMatch({ overs, names }));
    setToss((t) => ({ caller: other(t.caller), call: null, coin: null, winner: null, decision: null }));
    setReveal(null);
    setStep(null);
    lastBall.current = '';
    setMatchId((n) => n + 1);
  };

  let overlay: React.ReactNode = null;
  if (state.phase === 'toss') {
    overlay = <TossView names={names} toss={toss} canAct={() => true} onCall={onCall} onDecide={onDecide} />;
  } else if (step?.kind === 'handoff') {
    const second = step.side !== batter;
    overlay = (
      <div className="overlay-card handoff" role="dialog" aria-labelledby="handoff-title">
        <h2 id="handoff-title">Pass to {names[step.side]}</h2>
        <p>
          {second
            ? `${names[batter]} has locked in. ${names[step.side]}, it’s your turn to bowl. No peeking, ${names[batter]}.`
            : `${names[step.side]} is batting. ${names[other(step.side)]}, look away while they choose.`}
        </p>
        <div className="overlay-actions">
          <button className="btn btn--primary btn--lg" onClick={() => setStep({ kind: 'pick', side: step.side })}>
            I’m {names[step.side]}, show my controls
          </button>
        </div>
      </div>
    );
  } else if (state.phase === 'innings-break' && !reveal) {
    overlay = <InningsBreak state={state} names={names} onStart={() => setState((s) => reduceMatch(s, { type: 'next-innings' }))} />;
  } else if (state.phase === 'complete' && !reveal) {
    overlay = <ResultView state={state} names={names} you={null} onRematch={rematch} rematchLabel="Rematch" exitHref={href('/hand-cricket')} />;
  }

  return (
    <MatchView
      key={matchId}
      title={`${names[0]} vs ${names[1]}`}
      backHref="/hand-cricket"
      state={state}
      names={names}
      nearSide={0}
      picker={step?.kind === 'pick' && !reveal ? { side: step.side, hidden: true } : null}
      onSubmit={submit}
      reveal={reveal}
      onRevealDone={onRevealDone}
      overlay={overlay}
    />
  );
}
