import { createStore } from './store.ts';

export type StatMode = 'bot' | 'local' | 'online';

export interface ModeStats {
  played: number;
  won: number;
  lost: number;
  tied: number;
}

export interface Profile {
  name: string;
  skin: number;
  leftHanded: boolean;
  stats: Record<StatMode, ModeStats>;
  bestInnings: number;
  totalRuns: number;
  sixes: number;
  ducks: number;
}

const empty = (): ModeStats => ({ played: 0, won: 0, lost: 0, tied: 0 });

export const profile = createStore<Profile>('plyo.profile.v1', {
  name: 'Player',
  skin: 1,
  leftHanded: false,
  stats: { bot: empty(), local: empty(), online: empty() },
  bestInnings: 0,
  totalRuns: 0,
  sixes: 0,
  ducks: 0,
});

export function recordMatch(
  mode: StatMode,
  outcome: 'won' | 'lost' | 'tied' | null,
  innings: { runs: number; sixes: number } | null,
) {
  profile.set((p) => {
    const s = { ...p.stats[mode] };
    s.played++;
    if (outcome) s[outcome]++;
    const next = { ...p, stats: { ...p.stats, [mode]: s } };
    if (innings) {
      next.totalRuns += innings.runs;
      next.sixes += innings.sixes;
      next.bestInnings = Math.max(next.bestInnings, innings.runs);
      if (innings.runs === 0) next.ducks++;
    }
    return next;
  });
}

export function cleanName(raw: string, fallback = 'Player') {
  const n = raw.replace(/\s+/g, ' ').trim().slice(0, 16);
  return n || fallback;
}
