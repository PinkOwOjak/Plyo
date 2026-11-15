/**
 * Match controllers shared by the web and mobile apps.
 *
 * Every mode (bot, pass & play, face-to-face quick draw, online) exposes the
 * same MatchSession, so each app's match screen can render any mode with its
 * own layout. Rules live in @plyo/engine; this layer only sequences turns.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  chooseBotGesture,
  createMatch,
  currentInnings,
  other,
  reduceMatch,
  type CoinFace,
  type Difficulty,
  type Gesture,
  type MatchState,
  type OutMode,
  type Side,
  type TossDecision,
} from '@plyo/engine';
import { recordMatch, type StatMode } from './profile.ts';
import { sfx } from './sound.ts';

export interface Reveal {
  id: number;
  /** Gestures indexed by side. */
  gestures: [Gesture, Gesture];
  /** Match state after this ball. */
  after: MatchState;
}

export interface TossInfo {
  caller: Side;
  call: CoinFace | null;
  coin: CoinFace | null;
  winner: Side | null;
  decision: TossDecision | null;
}

export type SessionKind = 'bot' | 'pass' | 'duel' | 'online';

export interface MatchSession {
  kind: SessionKind;
  /** The state to display (does not yet include a ball that is being revealed). */
  state: MatchState;
  names: [string, string];
  outMode: OutMode;
  /** Side drawn nearest the camera. */
  nearSide: Side;
  /** Side whose result is "yours", or null when two people share the device. */
  you: Side | null;
  toss: TossInfo;
  canActForToss: (side: Side) => boolean;
  callToss: (face: CoinFace) => void;
  decideToss: (d: TossDecision) => void;
  /** Sides that may choose a hand right now on this device. */
  pickers: Side[];
  /** Hide hand previews while choosing (two people on one screen). */
  hidePreview: boolean;
  /** Pass & play: whose turn it is to take the device. */
  handoff: Side | null;
  confirmHandoff: () => void;
  /** Quick draw: countdown deadline (ms epoch) for both players to set their fingers. */
  drawDeadline: number | null;
  /** Quick draw: sides that tapped ready for the next ball. */
  readyForDraw: Side[];
  setReadyForDraw: (side: Side) => void;
  /** Live selection per side (quick draw reads them when the countdown ends). */
  setSelection: (side: Side, g: Gesture) => void;
  submit: (side: Side, g: Gesture) => void;
  locked: Record<Side, boolean>;
  status: string;
  reveal: Reveal | null;
  revealDone: (id: number) => void;
  nextInnings: () => void;
  rematch: (() => void) | null;
  rematchLabel: string;
  rematchNote: string;
}

const freshToss = (caller: Side): TossInfo => ({ caller, call: null, coin: null, winner: null, decision: null });

/** Gestures a side has shown in a given role so far this match. */
export function roleHistory(state: MatchState, side: Side, role: 'bat' | 'bowl'): Gesture[] {
  return state.innings.flatMap((inn) => {
    const batting = inn.battingSide === side;
    if (role === 'bat' && batting) return inn.balls.map((b) => b.batting);
    if (role === 'bowl' && !batting) return inn.balls.map((b) => b.bowling);
    return [];
  });
}

/** Records the finished match once, from `you`'s side, and plays the end jingle. */
export function useRecordResult(state: MatchState | null, you: Side, mode: StatMode, matchId: number) {
  const recorded = useRef(-1);
  useEffect(() => {
    if (!state || state.phase !== 'complete' || !state.result || recorded.current === matchId) return;
    recorded.current = matchId;
    const w = state.result.winner;
    const outcome = w === null ? 'tied' : w === you ? 'won' : 'lost';
    const mine = state.innings.find((i) => i.battingSide === you);
    recordMatch(mode, outcome, mine ? { runs: mine.runs, sixes: mine.balls.filter((b) => b.runs === 6).length } : null);
    if (outcome === 'lost') sfx.lose();
    else sfx.win();
  }, [state, you, mode, matchId]);
}

function ballOf(state: MatchState, gestures: [Gesture, Gesture]): MatchState {
  const batting = currentInnings(state)!.battingSide;
  return reduceMatch(state, { type: 'ball', batting: gestures[batting], bowling: gestures[other(batting)] });
}

interface LocalCore {
  state: MatchState;
  setState: React.Dispatch<React.SetStateAction<MatchState>>;
  toss: TossInfo;
  callToss: (face: CoinFace) => void;
  decideToss: (d: TossDecision) => void;
  reveal: Reveal | null;
  startReveal: (gestures: [Gesture, Gesture]) => void;
  revealDone: (id: number) => void;
  matchId: number;
  restart: () => void;
  later: (fn: () => void, ms: number) => void;
}

/** State shared by the on-device modes: toss, reveal hand-over, rematch. */
function useLocalCore(overs: number, outMode: OutMode, names: [string, string], caller: Side): LocalCore {
  const [matchId, setMatchId] = useState(1);
  const [state, setState] = useState(() => createMatch({ overs, outMode, names }));
  const [toss, setToss] = useState<TossInfo>(() => freshToss(caller));
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const revealRef = useRef<Reveal | null>(null);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const decideToss = useCallback(
    (decision: TossDecision) => {
      setToss((t) => {
        if (t.winner === null || t.decision !== null) return t;
        const done = { ...t, decision };
        later(() => setState((s) => (s.phase === 'toss' ? reduceMatch(s, { type: 'toss', caller: done.caller, call: done.call!, coin: done.coin!, decision }) : s)), 1100);
        return done;
      });
    },
    [later],
  );

  const callToss = useCallback((face: CoinFace) => {
    const coin: CoinFace = Math.random() < 0.5 ? 'heads' : 'tails';
    setToss((t) => (t.call ? t : { ...t, call: face, coin, winner: face === coin ? t.caller : other(t.caller) }));
  }, []);

  const startReveal = useCallback(
    (gestures: [Gesture, Gesture]) => {
      const r: Reveal = { id: Date.now(), gestures, after: ballOf(state, gestures) };
      revealRef.current = r;
      setReveal(r);
    },
    [state],
  );

  const revealDone = useCallback((id: number) => {
    const r = revealRef.current;
    if (!r || r.id !== id) return;
    revealRef.current = null;
    setState(r.after);
    setReveal(null);
  }, []);

  const restart = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setState(createMatch({ overs, outMode, names }));
    setToss((t) => freshToss(other(t.caller)));
    revealRef.current = null;
    setReveal(null);
    setMatchId((n) => n + 1);
  }, [overs, outMode, names]);

  return { state, setState, toss, callToss, decideToss, reveal, startReveal, revealDone, matchId, restart, later };
}

const noop = () => {};
const NONE: Side[] = [];

// ------------------------------------------------------------------ vs bot

export function useBotSession(opts: { overs: number; outMode: OutMode; difficulty: Difficulty; name: string; botName: string }): MatchSession {
  const names = useMemo<[string, string]>(() => [opts.name, opts.botName], [opts.name, opts.botName]);
  const core = useLocalCore(opts.overs, opts.outMode, names, 0);
  const { state, toss, reveal } = core;
  const botPick = useRef<{ key: string; gesture: Gesture } | null>(null);
  useRecordResult(state, 0, 'bot', core.matchId);

  const cur = currentInnings(state);
  const key = `${core.matchId}:${state.innings.length}:${cur?.balls.length ?? 0}`;
  // The bot commits to its hand when the ball starts — before the player chooses.
  useEffect(() => {
    if (state.phase !== 'playing' || !cur || botPick.current?.key === key) return;
    const role = cur.battingSide === 1 ? 'bat' : 'bowl';
    const gesture = chooseBotGesture(
      role,
      {
        opponentHistory: roleHistory(state, 0, role === 'bat' ? 'bowl' : 'bat'),
        ownHistory: roleHistory(state, 1, role),
        outMode: state.config.outMode,
      },
      opts.difficulty,
    );
    botPick.current = { key, gesture };
  }, [key, state, cur, opts.difficulty]);

  // The bot calls nothing; it decides after winning the toss.
  const { decideToss } = core;
  useEffect(() => {
    if (toss.winner === 1 && toss.decision === null) {
      const t = setTimeout(() => decideToss(Math.random() < 0.55 ? 'bowl' : 'bat'), 1900);
      return () => clearTimeout(t);
    }
  }, [toss.winner, toss.decision, decideToss]);

  const submit = useCallback(
    (side: Side, g: Gesture) => {
      if (side !== 0 || state.phase !== 'playing' || reveal || botPick.current?.key !== key) return;
      core.startReveal([g, botPick.current.gesture]);
    },
    [state.phase, reveal, key, core],
  );

  return {
    kind: 'bot',
    state,
    names,
    outMode: state.config.outMode,
    nearSide: 0,
    you: 0,
    toss,
    canActForToss: (s) => s === 0,
    callToss: core.callToss,
    decideToss: core.decideToss,
    pickers: state.phase === 'playing' && !reveal ? [0] : NONE,
    hidePreview: false,
    handoff: null,
    confirmHandoff: noop,
    drawDeadline: null,
    readyForDraw: NONE,
    setReadyForDraw: noop,
    setSelection: noop,
    submit,
    locked: { 0: false, 1: true },
    status: `${names[1]} has chosen.`,
    reveal,
    revealDone: core.revealDone,
    nextInnings: () => core.setState((s) => (s.phase === 'innings-break' ? reduceMatch(s, { type: 'next-innings' }) : s)),
    rematch: core.restart,
    rematchLabel: 'Play again',
    rematchNote: '',
  };
}

// --------------------------------------------------------- pass the device

export function usePassSession(opts: { overs: number; outMode: OutMode; names: [string, string] }): MatchSession {
  const core = useLocalCore(opts.overs, opts.outMode, opts.names, 1);
  const { state, reveal } = core;
  const [step, setStep] = useState<{ kind: 'handoff' | 'pick'; side: Side } | null>(null);
  const first = useRef<Gesture | null>(null);
  const lastBall = useRef('');
  useRecordResult(state, 0, 'local', core.matchId);

  const cur = currentInnings(state);
  const batter = cur?.battingSide ?? 0;
  const key = `${core.matchId}:${state.innings.length}:${cur?.balls.length ?? 0}`;
  useEffect(() => {
    if (state.phase !== 'playing' || reveal || lastBall.current === key) return;
    lastBall.current = key;
    first.current = null;
    setStep({ kind: 'handoff', side: batter });
  }, [state.phase, reveal, key, batter]);

  const submit = useCallback(
    (side: Side, g: Gesture) => {
      if (!step || step.kind !== 'pick' || step.side !== side) return;
      if (side === batter) {
        first.current = g;
        setStep({ kind: 'handoff', side: other(batter) });
        return;
      }
      const gestures: [Gesture, Gesture] = batter === 0 ? [first.current!, g] : [g, first.current!];
      setStep(null);
      core.startReveal(gestures);
    },
    [step, batter, core],
  );

  return {
    kind: 'pass',
    state,
    names: opts.names,
    outMode: state.config.outMode,
    nearSide: 0,
    you: null,
    toss: core.toss,
    canActForToss: () => true,
    callToss: core.callToss,
    decideToss: core.decideToss,
    pickers: step?.kind === 'pick' && !reveal ? [step.side] : NONE,
    hidePreview: true,
    handoff: step?.kind === 'handoff' ? step.side : null,
    confirmHandoff: () => setStep((s) => (s ? { kind: 'pick', side: s.side } : s)),
    drawDeadline: null,
    readyForDraw: NONE,
    setReadyForDraw: noop,
    setSelection: noop,
    submit,
    locked: { 0: false, 1: false },
    status: '',
    reveal,
    revealDone: core.revealDone,
    nextInnings: () => core.setState((s) => (s.phase === 'innings-break' ? reduceMatch(s, { type: 'next-innings' }) : s)),
    rematch: () => {
      lastBall.current = '';
      setStep(null);
      core.restart();
    },
    rematchLabel: 'Rematch',
    rematchNote: '',
  };
}

// ------------------------------------------------- face-to-face quick draw

export const DRAW_MS = 3000;

/**
 * Two players, one screen, facing each other. Both tap ready, then have three
 * seconds to set their fingers; whatever each is showing when the clock hits
 * zero is revealed. Speed replaces secrecy.
 */
export function useDuelSession(opts: { overs: number; outMode: OutMode; names: [string, string] }): MatchSession {
  const core = useLocalCore(opts.overs, opts.outMode, opts.names, 1);
  const { state, reveal, startReveal } = core;
  const [ready, setReady] = useState<Side[]>([]);
  const [deadline, setDeadline] = useState<number | null>(null);
  const selection = useRef<[Gesture, Gesture]>(['00000', '00000']);
  useRecordResult(state, 0, 'local', core.matchId);

  const cur = currentInnings(state);
  const key = `${core.matchId}:${state.innings.length}:${cur?.balls.length ?? 0}`;
  useEffect(() => {
    setReady([]);
    setDeadline(null);
    selection.current = ['00000', '00000'];
  }, [key]);

  useEffect(() => {
    if (ready.length === 2 && deadline === null && state.phase === 'playing' && !reveal) setDeadline(Date.now() + DRAW_MS);
  }, [ready, deadline, state.phase, reveal]);

  useEffect(() => {
    if (deadline === null) return;
    const t = setTimeout(() => {
      setDeadline(null);
      startReveal([...selection.current] as [Gesture, Gesture]);
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(t);
  }, [deadline, startReveal]);

  return {
    kind: 'duel',
    state,
    names: opts.names,
    outMode: state.config.outMode,
    nearSide: 0,
    you: null,
    toss: core.toss,
    canActForToss: () => true,
    callToss: core.callToss,
    decideToss: core.decideToss,
    pickers: deadline !== null && !reveal ? [0, 1] : NONE,
    hidePreview: true,
    handoff: null,
    confirmHandoff: noop,
    drawDeadline: deadline,
    readyForDraw: ready,
    setReadyForDraw: (side) => setReady((r) => (r.includes(side) || state.phase !== 'playing' || reveal ? r : [...r, side])),
    setSelection: (side, g) => {
      selection.current[side] = g;
    },
    submit: noop,
    locked: { 0: false, 1: false },
    status: '',
    reveal,
    revealDone: core.revealDone,
    nextInnings: () => core.setState((s) => (s.phase === 'innings-break' ? reduceMatch(s, { type: 'next-innings' }) : s)),
    rematch: core.restart,
    rematchLabel: 'Rematch',
    rematchNote: '',
  };
}
