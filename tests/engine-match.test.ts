import { describe, expect, it } from 'vitest';
import {
  createMatch,
  currentInnings,
  oversText,
  reduceMatch,
  target,
  tossWinner,
  type MatchState,
} from '@plyo/engine';
import type { Gesture, OutMode } from '@plyo/engine';

const start = (overs = 2, outMode: OutMode = 'exact'): MatchState =>
  reduceMatch(createMatch({ overs, outMode, names: ['Ana', 'Bot'] }), {
    type: 'toss',
    caller: 0,
    call: 'heads',
    coin: 'heads',
    decision: 'bat',
  });

const ball = (s: MatchState, bat: Gesture, bowl: Gesture) => reduceMatch(s, { type: 'ball', batting: bat, bowling: bowl });

describe('match', () => {
  it('resolves the toss', () => {
    expect(tossWinner(0, 'heads', 'heads')).toBe(0);
    expect(tossWinner(0, 'heads', 'tails')).toBe(1);
    const s = reduceMatch(createMatch({ overs: 2, outMode: 'exact', names: ['A', 'B'] }), {
      type: 'toss', caller: 1, call: 'tails', coin: 'heads', decision: 'bowl',
    });
    expect(s.toss?.winner).toBe(0);
    expect(currentInnings(s)?.battingSide).toBe(1);
  });

  it('adds runs and does not dismiss on equal counts with different fingers', () => {
    let s = start();
    s = ball(s, '01111', '11101');
    expect(currentInnings(s)?.runs).toBe(4);
    expect(currentInnings(s)?.out).toBe(false);
    s = ball(s, '10000', '01000');
    expect(currentInnings(s)?.runs).toBe(10);
  });

  it('ends the innings on an exact match and sets the target', () => {
    let s = start();
    s = ball(s, '11000', '00000');
    s = ball(s, '01111', '01111');
    expect(s.phase).toBe('innings-break');
    expect(currentInnings(s)?.out).toBe(true);
    expect(currentInnings(s)?.runs).toBe(2);
    expect(target(s)).toBe(3);
  });

  it('ends the innings when overs run out', () => {
    let s = start(1);
    for (let i = 0; i < 6; i++) s = ball(s, '11000', '00001');
    expect(s.phase).toBe('innings-break');
    expect(currentInnings(s)?.runs).toBe(12);
    expect(oversText(6)).toBe('1.0');
    expect(oversText(8)).toBe('1.2');
  });

  it('completes on a successful chase', () => {
    let s = start();
    s = ball(s, '11000', '00000');
    s = ball(s, '00001', '00001');
    s = reduceMatch(s, { type: 'next-innings' });
    expect(currentInnings(s)?.battingSide).toBe(1);
    s = ball(s, '10000', '01000');
    expect(s.phase).toBe('complete');
    expect(s.result).toEqual({ winner: 1, kind: 'chased', margin: 'with 11 balls to spare' });
  });

  it('completes when the chasing batter is out short', () => {
    let s = start();
    s = ball(s, '11111', '00000');
    s = ball(s, '00001', '00001');
    s = reduceMatch(s, { type: 'next-innings' });
    s = ball(s, '01000', '00000');
    s = ball(s, '11000', '11000');
    expect(s.result).toEqual({ winner: 0, kind: 'defended', margin: 'by 4 runs' });
  });

  it('detects a tie', () => {
    let s = start();
    s = ball(s, '11000', '00000');
    s = ball(s, '00001', '00001');
    s = reduceMatch(s, { type: 'next-innings' });
    s = ball(s, '01100', '00000');
    s = ball(s, '00011', '00011');
    expect(s.result?.kind).toBe('tie');
    expect(s.result?.winner).toBeNull();
  });

  it('rejects illegal actions', () => {
    const fresh = createMatch({ overs: 2, outMode: 'exact', names: ['A', 'B'] });
    expect(() => ball(fresh, '00000', '00001')).toThrow();
    expect(() => createMatch({ overs: 0, outMode: 'exact', names: ['A', 'B'] })).toThrow();
    expect(() => createMatch({ overs: 2, outMode: 'loose' as OutMode, names: ['A', 'B'] })).toThrow(/OUT rule/);
    expect(() => reduceMatch(start(), { type: 'next-innings' })).toThrow();
  });

  it('applies finger-count mode: same count is out, thumb-only is its own class', () => {
    let s = start(2, 'count');
    s = ball(s, '10000', '01000'); // six vs single finger: not out
    expect(currentInnings(s)?.runs).toBe(6);
    s = ball(s, '01000', '10000'); // single finger vs thumb: not out
    expect(currentInnings(s)?.runs).toBe(7);
    s = ball(s, '01111', '11101'); // same count, different fingers: OUT
    expect(currentInnings(s)?.out).toBe(true);
    expect(currentInnings(s)?.runs).toBe(7);
  });

  it('dismisses a six in count mode only with another thumb', () => {
    let s = start(2, 'count');
    s = ball(s, '10000', '10000');
    expect(s.phase).toBe('innings-break');
  });

  it('locks the OUT mode for the whole match', () => {
    let s = start(2, 'exact');
    expect(Object.isFrozen(s.config)).toBe(true);
    expect(() => {
      (s.config as { outMode: OutMode }).outMode = 'count';
    }).toThrow();
    s = ball(s, '01111', '11101');
    s = ball(s, '00011', '00110');
    expect(currentInnings(s)?.out).toBe(false);
    expect(s.config.outMode).toBe('exact');
  });
});
