import { useMemo } from 'react';
import { isOutMode, type Difficulty } from '@plyo/engine';
import { cleanName, prefs, profile, useBotSession, useDuelSession, usePassSession } from '@plyo/core';
import { SoloMatch } from './SoloMatch.tsx';
import { DuelMatch } from './DuelMatch.tsx';

const BOTS: Record<Difficulty, string> = { easy: 'Pip', medium: 'Rivet', hard: 'Ace' };

function common(q: URLSearchParams) {
  const p = prefs.get();
  const overs = Number(q.get('overs'));
  const rule = q.get('rule');
  return { overs: Number.isInteger(overs) && overs >= 1 && overs <= 20 ? overs : p.defaultOvers, outMode: isOutMode(rule) ? rule : p.outMode };
}

function useNames(q: URLSearchParams): [string, string] {
  const me = profile.use();
  const raw = cleanName(q.get('p2') ?? '', 'Player 2');
  const p2 = raw === me.name ? `${raw} 2` : raw;
  return useMemo(() => [me.name, p2], [me.name, p2]);
}

function Bot({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const d = query.get('difficulty');
  const difficulty: Difficulty = d === 'easy' || d === 'hard' || d === 'medium' ? d : prefs.get().difficulty;
  const session = useBotSession({ ...common(query), difficulty, name: me.name, botName: BOTS[difficulty] });
  return <SoloMatch session={session} title={`v ${BOTS[difficulty]}`} exitHref="/" />;
}

function Pass({ query }: { query: URLSearchParams }) {
  const names = useNames(query);
  const session = usePassSession({ ...common(query), names });
  return <SoloMatch session={session} title={`${names[0]} v ${names[1]}`} exitHref="/" />;
}

function Duel({ query }: { query: URLSearchParams }) {
  const names = useNames(query);
  const session = useDuelSession({ ...common(query), names });
  return <DuelMatch session={session} exitHref="/" />;
}

export function PlayLocal({ kind, query }: { kind: 'bot' | 'pass' | 'duel'; query: URLSearchParams }) {
  if (kind === 'bot') return <Bot query={query} />;
  if (kind === 'pass') return <Pass query={query} />;
  return <Duel query={query} />;
}
