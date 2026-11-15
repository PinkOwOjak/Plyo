/**
 * Hand gestures for Hand Cricket.
 *
 * A gesture is a five-character bit string in the fixed order
 * THUMB – INDEX – MIDDLE – RING – LITTLE, where '1' means the finger is
 * extended and '0' means it is folded. There are exactly 32 gestures.
 */

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'little'] as const;
export type Finger = (typeof FINGERS)[number];

export const FINGER_LABELS: Record<Finger, string> = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  little: 'Little',
};

/** A five-bit gesture code such as "01111". Always validate with {@link isGesture}. */
export type Gesture = `${'0' | '1'}${'0' | '1'}${'0' | '1'}${'0' | '1'}${'0' | '1'}`;

/** Five booleans, one per finger in THUMB–INDEX–MIDDLE–RING–LITTLE order. */
export type FingerStates = readonly [boolean, boolean, boolean, boolean, boolean];

export const FIST: Gesture = '00000';
export const THUMB_ONLY: Gesture = '10000';
export const OPEN_HAND: Gesture = '11111';

const GESTURE_PATTERN = /^[01]{5}$/;

export function isGesture(value: unknown): value is Gesture {
  return typeof value === 'string' && GESTURE_PATTERN.test(value);
}

export function assertGesture(value: unknown): Gesture {
  if (!isGesture(value)) {
    throw new Error(`Invalid gesture "${String(value)}": expected five characters of 0 or 1`);
  }
  return value;
}

export function toFingerStates(gesture: Gesture): FingerStates {
  return [
    gesture[0] === '1',
    gesture[1] === '1',
    gesture[2] === '1',
    gesture[3] === '1',
    gesture[4] === '1',
  ];
}

export function fromFingerStates(states: readonly boolean[]): Gesture {
  if (states.length !== 5) throw new Error('A gesture needs exactly five finger states');
  return states.map((s) => (s ? '1' : '0')).join('') as Gesture;
}

export function isExtended(gesture: Gesture, finger: Finger): boolean {
  return gesture[FINGERS.indexOf(finger)] === '1';
}

export function toggleFinger(gesture: Gesture, finger: Finger): Gesture {
  const states = [...toFingerStates(gesture)];
  const i = FINGERS.indexOf(finger);
  states[i] = !states[i];
  return fromFingerStates(states);
}

export function extendedCount(gesture: Gesture): number {
  let n = 0;
  for (const c of gesture) if (c === '1') n++;
  return n;
}

/**
 * Runs scored by a batting gesture (ignoring the OUT rule):
 * no fingers = 0, thumb alone = 6, otherwise one run per extended finger.
 */
export function runsFor(gesture: Gesture): number {
  if (gesture === THUMB_ONLY) return 6;
  return extendedCount(gesture);
}

/**
 * The OUT rule. The batsman is out only when both complete five-bit
 * configurations are identical — never by comparing finger counts.
 */
export function isOut(batting: Gesture, bowling: Gesture): boolean {
  return assertGesture(batting) === assertGesture(bowling);
}

/** All 32 gestures, ordered by number of extended fingers, then thumb-first. */
export const ALL_GESTURES: readonly Gesture[] = (() => {
  const list: Gesture[] = [];
  for (let i = 0; i < 32; i++) list.push(i.toString(2).padStart(5, '0') as Gesture);
  return list.sort((a, b) => extendedCount(a) - extendedCount(b) || (a < b ? 1 : -1));
})();

/** Human-readable description, e.g. "Index + Middle". */
export function describeGesture(gesture: Gesture): string {
  if (gesture === FIST) return 'Closed fist';
  if (gesture === OPEN_HAND) return 'Open hand';
  return FINGERS.filter((_, i) => gesture[i] === '1')
    .map((f) => FINGER_LABELS[f])
    .join(' + ');
}
