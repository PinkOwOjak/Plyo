import { createStore } from './store.ts';
import type { Difficulty } from '../games/hand-cricket/engine/ai.ts';

export type MotionPref = 'system' | 'reduced' | 'full';

export interface Preferences {
  sound: boolean;
  volume: number;
  haptics: boolean;
  motion: MotionPref;
  defaultOvers: number;
  difficulty: Difficulty;
  /** Optional custom multiplayer server, e.g. wss://plyo.example.com/ws. Empty = same host. */
  serverUrl: string;
  seenRules: boolean;
}

export const prefs = createStore<Preferences>('plyo.prefs.v1', {
  sound: true,
  volume: 0.7,
  haptics: true,
  motion: 'system',
  defaultOvers: 5,
  difficulty: 'medium',
  serverUrl: '',
  seenRules: false,
});

export function prefersReducedMotion(p: Preferences = prefs.get()): boolean {
  if (p.motion === 'reduced') return true;
  if (p.motion === 'full') return false;
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function vibrate(pattern: number | number[]) {
  if (prefs.get().haptics && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw without a user gesture; haptics are optional.
    }
  }
}
