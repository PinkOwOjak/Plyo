import { describe, expect, it } from 'vitest';
import { chooseBotGesture, predictNext, seededRng, type Difficulty } from '@plyo/engine';
import { ALL_GESTURES, isGesture, type Gesture } from '@plyo/engine';

describe('bot', () => {
  const levels: Difficulty[] = ['easy', 'medium', 'hard'];

  it('always returns a valid gesture and can reach all 32', () => {
    for (const d of levels) {
      const rng = seededRng(7);
      const seen = new Set<Gesture>();
      for (let i = 0; i < 4000; i++) {
        const g = chooseBotGesture(i % 2 ? 'bat' : 'bowl', { opponentHistory: [], ownHistory: [] }, d, rng);
        expect(isGesture(g)).toBe(true);
        seen.add(g);
      }
      expect(seen.size).toBe(32);
    }
  });

  it('prediction is a probability distribution', () => {
    const p = predictNext(['01111', '01111', '10000', '01111']);
    expect(p).toHaveLength(32);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    const top = ALL_GESTURES[p.indexOf(Math.max(...p))];
    expect(top).toBe('01111');
  });

  it('hard bowler catches a predictable batter far more than chance', () => {
    const rng = seededRng(3);
    const history: Gesture[] = Array(20).fill('01111');
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      if (chooseBotGesture('bowl', { opponentHistory: history, ownHistory: [] }, 'hard', rng) === '01111') hits++;
    }
    expect(hits / 1000).toBeGreaterThan(0.25);
  });

  it('does not lock into one visibly repeating gesture', () => {
    const rng = seededRng(11);
    const own: Gesture[] = [];
    for (let i = 0; i < 60; i++) own.push(chooseBotGesture('bat', { opponentHistory: [], ownHistory: own }, 'hard', rng));
    let repeats = 0;
    for (let i = 1; i < own.length; i++) if (own[i] === own[i - 1]) repeats++;
    expect(repeats).toBeLessThan(10);
    expect(new Set(own).size).toBeGreaterThan(8);
  });

  it('bowls for the finger count in count mode', () => {
    const rng = seededRng(5);
    const history: Gesture[] = Array(20).fill('01111');
    let hits = 0;
    for (let i = 0; i < 1000; i++) {
      const g = chooseBotGesture('bowl', { opponentHistory: history, ownHistory: [], outMode: 'count' }, 'hard', rng);
      if (g.split('').filter((c) => c === '1').length === 4) hits++;
    }
    expect(hits / 1000).toBeGreaterThan(0.6);
  });
});
