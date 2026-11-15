/**
 * Bot opponent for Hand Cricket.
 *
 * The bot only sees gestures that have already been revealed; its signature
 * has no access to the player's current selection, so it cannot cheat. It
 * plays by the same OUT rule mode as the match.
 *
 *  - Easy:   uniform random over all 32 gestures.
 *  - Medium: learns the opponent's habits (overall frequency + what they tend
 *            to play after each gesture) and leans on that loosely.
 *  - Hard:   same model, trusted more strongly, and plays the odds as a batter.
 */
import { ALL_GESTURES, extendedCount, runsFor, type Gesture } from './gestures.ts';
import { isOutUnder, type OutMode } from './rules.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Role = 'bat' | 'bowl';
export type Rng = () => number;

export interface BotView {
  /** Gestures the opponent revealed earlier, oldest first, in their current role. */
  opponentHistory: readonly Gesture[];
  /** Gestures the bot itself played earlier, oldest first. */
  ownHistory: readonly Gesture[];
  /** The match's OUT rule. Defaults to exact. */
  outMode?: OutMode;
}

const N = ALL_GESTURES.length;
const INDEX = new Map(ALL_GESTURES.map((g, i) => [g, i]));
const COMBOS = [1, 5, 10, 10, 5, 1];

const TUNING: Record<Exclude<Difficulty, 'easy'>, { trust: number; sharpen: number; temp: number }> = {
  medium: { trust: 0.55, sharpen: 1.6, temp: 1.3 },
  hard: { trust: 0.85, sharpen: 3, temp: 0.6 },
};

/** outMatrix[mode][b][w] = 1 if batting gesture b is out to bowling gesture w. */
const OUT_MATRIX: Record<OutMode, number[][]> = {
  exact: ALL_GESTURES.map((b) => ALL_GESTURES.map((w) => (isOutUnder('exact', b, w) ? 1 : 0))),
  count: ALL_GESTURES.map((b) => ALL_GESTURES.map((w) => (isOutUnder('count', b, w) ? 1 : 0))),
};

function pick(weights: number[], rng: Rng): Gesture {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < N; i++) {
    r -= weights[i];
    if (r <= 0) return ALL_GESTURES[i];
  }
  return ALL_GESTURES[N - 1];
}

/**
 * Probability distribution over the opponent's next gesture, learned from
 * history with smoothing so unseen gestures keep some chance.
 */
export function predictNext(history: readonly Gesture[]): number[] {
  const uniform = new Array<number>(N).fill(1 / N);
  if (history.length === 0) return uniform;

  const decay = 0.9;
  const freq = new Array<number>(N).fill(0.1);
  const countFreq = new Array<number>(6).fill(0.1);
  history.forEach((g, i) => {
    const w = Math.pow(decay, history.length - 1 - i);
    freq[INDEX.get(g)!] += w;
    countFreq[extendedCount(g)] += w;
  });

  const last = history[history.length - 1];
  const after = new Array<number>(N).fill(0.05);
  let transitions = 0;
  for (let i = 0; i + 1 < history.length; i++) {
    if (history[i] === last) {
      after[INDEX.get(history[i + 1])!] += 1;
      transitions++;
    }
  }

  const norm = (a: number[]) => {
    const s = a.reduce((x, y) => x + y, 0);
    return a.map((x) => x / s);
  };
  const f = norm(freq);
  const m = norm(after);
  const c = norm(ALL_GESTURES.map((g) => countFreq[extendedCount(g)] / COMBOS[extendedCount(g)]));

  const evidence = Math.min(1, history.length / 12);
  const markovWeight = transitions > 0 ? Math.min(0.45, transitions * 0.12) : 0;
  return norm(
    ALL_GESTURES.map(
      (_, i) =>
        (1 - evidence) * uniform[i] +
        evidence * ((1 - markovWeight) * (0.7 * f[i] + 0.3 * c[i]) + markovWeight * m[i]),
    ),
  );
}

function varietyPenalty(own: readonly Gesture[]): number[] {
  const w = new Array<number>(N).fill(1);
  const recent = own.slice(-2);
  recent.forEach((g, k) => {
    w[INDEX.get(g)!] *= k === recent.length - 1 ? 0.25 : 0.5;
  });
  return w;
}

export function chooseBotGesture(role: Role, view: BotView, difficulty: Difficulty, rng: Rng = Math.random): Gesture {
  if (difficulty === 'easy') return ALL_GESTURES[Math.floor(rng() * N) % N];

  const mode = view.outMode ?? 'exact';
  const out = OUT_MATRIX[mode];
  const { trust, sharpen, temp } = TUNING[difficulty];
  const predicted = predictNext(view.opponentHistory);
  const variety = varietyPenalty(view.ownHistory);

  if (role === 'bowl') {
    // Chance that bowling w dismisses the batter, given what we expect them to play.
    const hit = ALL_GESTURES.map((_, w) => predicted.reduce((s, p, b) => s + p * out[b][w], 0));
    const weights = hit.map((h, i) => ((1 - trust) / N + trust * Math.pow(h, sharpen)) * variety[i]);
    return pick(weights, rng);
  }

  // Batting: expected runs, discounted by the chance the bowler gets us out.
  const bowlerGuess = predicted;
  const uniformOut = (b: number) => out[b].reduce((s, x) => s + x, 0) / N;
  const weights = ALL_GESTURES.map((g, b) => {
    const learned = bowlerGuess.reduce((s, p, w) => s + p * out[b][w], 0);
    const pOut = (1 - trust) * uniformOut(b) + trust * learned;
    const utility = runsFor(g) * (1 - pOut) - 9 * pOut;
    return Math.exp(utility / temp) * variety[b];
  });
  return pick(weights, rng);
}

/** Seeded generator for tests and replays (mulberry32). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
