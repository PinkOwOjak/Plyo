import { describe, expect, it } from 'vitest';
import {
  ALL_GESTURES,
  OUT_MODE_INFO,
  countClass,
  extendedCount,
  isCountMatch,
  isExactMatch,
  isOutUnder,
  runsFor,
  type Gesture,
} from '@plyo/engine';

describe('OUT mode A: exact match', () => {
  it('follows the spec examples', () => {
    expect(isOutUnder('exact', '01111', '11101')).toBe(false);
    expect(isOutUnder('exact', '01111', '01111')).toBe(true);
  });

  it('is out on exactly the 32 identical pairs of all 1024', () => {
    let outs = 0;
    for (const a of ALL_GESTURES)
      for (const b of ALL_GESTURES) {
        const o = isOutUnder('exact', a, b);
        expect(o).toBe(a === b);
        if (o) outs++;
      }
    expect(outs).toBe(32);
  });
});

describe('OUT mode B: finger count', () => {
  it('follows the spec examples', () => {
    expect(isOutUnder('count', '01111', '11101')).toBe(true);
    expect(isOutUnder('count', '01111', '01110')).toBe(false); // 4 vs 3 fingers
    expect(isOutUnder('count', '01111', '01111')).toBe(true);
  });

  it('treats thumb-only as its own class in both directions', () => {
    for (const single of ['01000', '00100', '00010', '00001'] as Gesture[]) {
      expect(isOutUnder('count', '10000', single)).toBe(false);
      expect(isOutUnder('count', single, '10000')).toBe(false);
    }
    expect(isOutUnder('count', '10000', '10000')).toBe(true);
    expect(isOutUnder('count', '01000', '00001')).toBe(true);
  });

  it('matches by count everywhere else, across all 1024 pairs', () => {
    let outs = 0;
    for (const a of ALL_GESTURES)
      for (const b of ALL_GESTURES) {
        const special = (a === '10000') !== (b === '10000');
        const expected = extendedCount(a) === extendedCount(b) && !special;
        expect(isOutUnder('count', a, b)).toBe(expected);
        if (expected) outs++;
      }
    // Class sizes: fist 1, thumb 1, other singles 4, then 10, 10, 5, 1.
    expect(outs).toBe(1 + 1 + 16 + 100 + 100 + 25 + 1);
  });

  it('keeps scoring separate from OUT detection', () => {
    expect(countClass('10000')).toBe('thumb');
    expect(runsFor('10000')).toBe(6);
    expect(isCountMatch('11000', '00011')).toBe(true);
    expect(isExactMatch('11000', '00011')).toBe(false);
  });

  it('documents both modes with correct examples', () => {
    for (const info of Object.values(OUT_MODE_INFO)) {
      expect(isOutUnder(info.id, info.example.batting, info.example.bowling)).toBe(info.example.out);
    }
  });
});
