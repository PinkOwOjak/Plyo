/**
 * Match state for Hand Cricket, as a pure reducer.
 *
 * Format: two innings, one wicket each. An innings ends when the batsman is
 * out, when the overs run out, or (second innings only) when the target is
 * reached. The same reducer runs in the browser and on the multiplayer server.
 */
import { assertGesture, isOut, runsFor, type Gesture } from './gestures.ts';

export type Side = 0 | 1;
export type CoinFace = 'heads' | 'tails';
export type TossDecision = 'bat' | 'bowl';

export const BALLS_PER_OVER = 6;
export const OVER_OPTIONS = [2, 5, 10] as const;
export const MAX_OVERS = 20;

export interface MatchConfig {
  overs: number;
  names: [string, string];
}

export interface Ball {
  batting: Gesture;
  bowling: Gesture;
  runs: number;
  out: boolean;
}

export interface Innings {
  battingSide: Side;
  runs: number;
  balls: Ball[];
  out: boolean;
  complete: boolean;
}

export interface Toss {
  caller: Side;
  call: CoinFace;
  coin: CoinFace;
  winner: Side;
  decision: TossDecision;
}

export type ResultKind = 'defended' | 'chased' | 'tie';

export interface MatchResult {
  winner: Side | null;
  kind: ResultKind;
  /** e.g. "by 12 runs" or "with 4 balls to spare". Empty for a tie. */
  margin: string;
}

export type Phase = 'toss' | 'playing' | 'innings-break' | 'complete';

export interface MatchState {
  config: MatchConfig;
  phase: Phase;
  toss: Toss | null;
  innings: Innings[];
  result: MatchResult | null;
}

export type MatchAction =
  | { type: 'toss'; caller: Side; call: CoinFace; coin: CoinFace; decision: TossDecision }
  | { type: 'ball'; batting: Gesture; bowling: Gesture }
  | { type: 'next-innings' };

export const other = (side: Side): Side => (side === 0 ? 1 : 0);

export function createMatch(config: MatchConfig): MatchState {
  if (!Number.isInteger(config.overs) || config.overs < 1 || config.overs > MAX_OVERS) {
    throw new Error(`Overs must be a whole number from 1 to ${MAX_OVERS}`);
  }
  return { config, phase: 'toss', toss: null, innings: [], result: null };
}

export function tossWinner(caller: Side, call: CoinFace, coin: CoinFace): Side {
  return call === coin ? caller : other(caller);
}

function newInnings(battingSide: Side): Innings {
  return { battingSide, runs: 0, balls: [], out: false, complete: false };
}

export const maxBalls = (state: MatchState) => state.config.overs * BALLS_PER_OVER;

export function currentInnings(state: MatchState): Innings | null {
  return state.innings.length ? state.innings[state.innings.length - 1] : null;
}

export function battingSide(state: MatchState): Side | null {
  return currentInnings(state)?.battingSide ?? null;
}

export function bowlingSide(state: MatchState): Side | null {
  const b = battingSide(state);
  return b === null ? null : other(b);
}

/** Runs needed to win in the second innings (first-innings total + 1). */
export function target(state: MatchState): number | null {
  return state.innings.length >= 1 && state.innings[0].complete ? state.innings[0].runs + 1 : null;
}

export function oversText(balls: number): string {
  return `${Math.floor(balls / BALLS_PER_OVER)}.${balls % BALLS_PER_OVER}`;
}

function computeResult(state: MatchState): MatchResult {
  const [first, second] = state.innings;
  const need = first.runs + 1;
  if (second.runs >= need) {
    const left = maxBalls(state) - second.balls.length;
    return {
      winner: second.battingSide,
      kind: 'chased',
      margin: left > 0 ? `with ${left} ball${left === 1 ? '' : 's'} to spare` : 'off the last ball',
    };
  }
  if (second.runs === first.runs) return { winner: null, kind: 'tie', margin: '' };
  const by = first.runs - second.runs;
  return { winner: first.battingSide, kind: 'defended', margin: `by ${by} run${by === 1 ? '' : 's'}` };
}

export function reduceMatch(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case 'toss': {
      if (state.phase !== 'toss') throw new Error('The toss has already happened');
      const winner = tossWinner(action.caller, action.call, action.coin);
      const batFirst: Side = action.decision === 'bat' ? winner : other(winner);
      return {
        ...state,
        phase: 'playing',
        toss: { caller: action.caller, call: action.call, coin: action.coin, winner, decision: action.decision },
        innings: [newInnings(batFirst)],
      };
    }
    case 'ball': {
      if (state.phase !== 'playing') throw new Error('No innings is in progress');
      const batting = assertGesture(action.batting);
      const bowling = assertGesture(action.bowling);
      const out = isOut(batting, bowling);
      const runs = out ? 0 : runsFor(batting);
      const cur = currentInnings(state)!;
      const next: Innings = {
        ...cur,
        runs: cur.runs + runs,
        out,
        balls: [...cur.balls, { batting, bowling, runs, out }],
      };
      const isSecond = state.innings.length === 2;
      const chased = isSecond && next.runs >= state.innings[0].runs + 1;
      next.complete = out || next.balls.length >= maxBalls(state) || chased;
      const innings = [...state.innings.slice(0, -1), next];
      if (!next.complete) return { ...state, innings };
      if (!isSecond) return { ...state, innings, phase: 'innings-break' };
      const done: MatchState = { ...state, innings, phase: 'complete' };
      return { ...done, result: computeResult(done) };
    }
    case 'next-innings': {
      if (state.phase !== 'innings-break') throw new Error('The first innings is not finished');
      return { ...state, phase: 'playing', innings: [...state.innings, newInnings(other(state.innings[0].battingSide))] };
    }
  }
}

/** A short line describing the last ball, for commentary and toasts. */
export function describeBall(ball: Ball): string {
  if (ball.out) return 'Out! Exact same hand';
  if (ball.runs === 6) return 'Six! Thumb only';
  if (ball.runs === 0) return 'Dot ball';
  return `${ball.runs} run${ball.runs === 1 ? '' : 's'}`;
}
