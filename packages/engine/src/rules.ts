/**
 * OUT-detection rules. Deliberately separate from scoring (gestures.ts → runsFor).
 *
 *  exact  – OUT only when both five-bit configurations are identical.
 *  count  – OUT when both hands show the same number of extended fingers,
 *           with one exception: "thumb only" (the six) is its own class. A
 *           thumb-only hand is only matched by another thumb-only hand, and a
 *           thumb-only bowl never dismisses a single non-thumb finger.
 */
import { THUMB_ONLY, assertGesture, extendedCount, type Gesture } from './gestures.ts';

export type OutMode = 'exact' | 'count';

export const OUT_MODES: readonly OutMode[] = ['exact', 'count'];

export interface OutModeInfo {
  id: OutMode;
  name: string;
  summary: string;
  detail: string;
  example: { batting: Gesture; bowling: Gesture; out: boolean };
}

export const OUT_MODE_INFO: Record<OutMode, OutModeInfo> = {
  exact: {
    id: 'exact',
    name: 'Exact match',
    summary: 'Out only when every finger matches.',
    detail:
      'The batter is out only if the bowler shows exactly the same hand, finger for finger. Two different four-finger hands are not out.',
    example: { batting: '01111', bowling: '11101', out: false },
  },
  count: {
    id: 'count',
    name: 'Finger count',
    summary: 'Out when both show the same number of fingers.',
    detail:
      'The batter is out if both hands show the same number of raised fingers, whichever fingers they are. Thumb only is the exception: it is the six, so only another thumb-only hand gets it out, and it never dismisses a single other finger.',
    example: { batting: '01111', bowling: '11101', out: true },
  },
};

export function isOutMode(value: unknown): value is OutMode {
  return value === 'exact' || value === 'count';
}

/**
 * The class a hand belongs to for finger-count matching: number of raised
 * fingers, except thumb-only which is its own class.
 */
export function countClass(gesture: Gesture): string {
  return gesture === THUMB_ONLY ? 'thumb' : String(extendedCount(gesture));
}

export function isExactMatch(batting: Gesture, bowling: Gesture): boolean {
  return assertGesture(batting) === assertGesture(bowling);
}

export function isCountMatch(batting: Gesture, bowling: Gesture): boolean {
  return countClass(assertGesture(batting)) === countClass(assertGesture(bowling));
}

/** Whether this ball dismisses the batter under the given rule mode. */
export function isOutUnder(mode: OutMode, batting: Gesture, bowling: Gesture): boolean {
  return mode === 'exact' ? isExactMatch(batting, bowling) : isCountMatch(batting, bowling);
}

/** Short reason shown after a dismissal. */
export function outReason(mode: OutMode, batting: Gesture): string {
  if (mode === 'exact') return `Exact same hand: ${batting}`;
  if (batting === THUMB_ONLY) return 'Thumb matched thumb';
  const n = extendedCount(batting);
  return n === 0 ? 'Both showed a fist' : `Both showed ${n} finger${n === 1 ? '' : 's'}`;
}
