import { describe, expect, it } from 'vitest';
import {
  ALL_GESTURES,
  describeGesture,
  extendedCount,
  fromFingerStates,
  isGesture,
  runsFor,
  toFingerStates,
  toggleFinger,
  type Gesture,
} from '@plyo/engine';

const SPEC: Record<number, string[]> = {
  0: ['00000'],
  1: ['10000', '01000', '00100', '00010', '00001'],
  2: ['11000', '10100', '10010', '10001', '01100', '01010', '01001', '00110', '00101', '00011'],
  3: ['11100', '11010', '11001', '10110', '10101', '10011', '01110', '01101', '01011', '00111'],
  4: ['11110', '11101', '11011', '10111', '01111'],
  5: ['11111'],
};

describe('gestures', () => {
  it('has exactly the 32 configurations from the spec, in spec order', () => {
    expect(ALL_GESTURES).toHaveLength(32);
    expect(new Set(ALL_GESTURES).size).toBe(32);
    expect([...ALL_GESTURES]).toEqual(Object.values(SPEC).flat());
  });

  it('round-trips every gesture through finger states', () => {
    for (const g of ALL_GESTURES) expect(fromFingerStates(toFingerStates(g))).toBe(g);
  });

  it('uses THUMB-INDEX-MIDDLE-RING-LITTLE bit order', () => {
    expect(toFingerStates('10000')).toEqual([true, false, false, false, false]);
    expect(toFingerStates('00001')).toEqual([false, false, false, false, true]);
    expect(toggleFinger('00000', 'thumb')).toBe('10000');
    expect(toggleFinger('00000', 'little')).toBe('00001');
    expect(toggleFinger('11111', 'middle')).toBe('11011');
  });

  it('validates codes', () => {
    expect(isGesture('01011')).toBe(true);
    for (const bad of ['0101', '010111', '01021', 'abcde', 5, null]) expect(isGesture(bad)).toBe(false);
  });

  it('describes gestures', () => {
    expect(describeGesture('00000')).toBe('Closed fist');
    expect(describeGesture('01100')).toBe('Index + Middle');
  });
});

describe('scoring', () => {
  it('scores per the table', () => {
    expect(runsFor('00000')).toBe(0);
    expect(runsFor('10000')).toBe(6);
    for (const g of SPEC[1].slice(1)) expect(runsFor(g as Gesture)).toBe(1);
    for (const n of [2, 3, 4]) for (const g of SPEC[n]) expect(runsFor(g as Gesture)).toBe(n);
    expect(runsFor('11111')).toBe(5);
  });

  it('scores every gesture by extended count except thumb-only', () => {
    for (const g of ALL_GESTURES) expect(runsFor(g)).toBe(g === '10000' ? 6 : extendedCount(g));
  });
});
