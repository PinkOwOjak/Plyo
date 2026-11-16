import { createStore } from './store.ts';
import type { Difficulty, OutMode } from '@plyo/engine';

export type MotionPref = 'system' | 'reduced' | 'full';

export interface Preferences {
  sound: boolean;
  volume: number;
  haptics: boolean;
  motion: MotionPref;
  defaultOvers: number;
  difficulty: Difficulty;
  /** Last OUT rule chosen; offered as the default next time (always confirmed before a match). */
  outMode: OutMode;
  /** Optional custom multiplayer server, e.g. wss://plyo.example.com/ws. Empty = same host. */
  serverUrl: string;
  seenRules: boolean;
}

export const prefs = createStore<Preferences>('plyo.prefs.v2', {
  sound: true,
  volume: 0.7,
  haptics: true,
  motion: 'system',
  defaultOvers: 5,
  difficulty: 'medium',
  outMode: 'exact',
  serverUrl: '',
  seenRules: false,
});

export function prefersReducedMotion(p: Preferences = prefs.get()): boolean {
  if (p.motion === 'reduced') return true;
  if (p.motion === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type HapticKind = 'tap' | 'select' | 'success' | 'warning' | 'heavy';

type HapticsAdapter = (kind: HapticKind) => void;

const WEB_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  select: 12,
  success: [20, 40, 30],
  warning: [60, 40, 120],
  heavy: 40,
};

/** Default: the Vibration API where the browser supports it. Apps may replace it (e.g. native haptics). */
let adapter: HapticsAdapter = (kind) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(WEB_PATTERNS[kind]);
    } catch {
      // Some browsers throw without a user gesture; haptics are optional.
    }
  }
};

export function setHapticsAdapter(fn: HapticsAdapter) {
  adapter = fn;
}

export function haptic(kind: HapticKind) {
  if (prefs.get().haptics) adapter(kind);
}
