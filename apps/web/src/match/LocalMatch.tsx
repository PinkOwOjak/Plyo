import { isOutMode, type Difficulty } from '@plyo/engine';
import { cleanName, prefs, profile, useBotSession, usePassSession } from '@plyo/core';
import { MatchScreen } from './MatchScreen.tsx';

const BOTS: Record<Difficulty, string> = { easy: 'Pip', medium: 'Rivet', hard: 'Ace' };

function readCommon(query: URLSearchParams) {
  const p = prefs.get();
  const overs = Number(query.get('overs'));
  const rule = query.get('rule');
  return {
    overs: Number.isInteger(overs) && overs >= 1 && overs <= 20 ? overs : p.defaultOvers,
    outMode: isOutMode(rule) ? rule : p.outMode,
  };
}

function BotMatch({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const { overs, outMode } = readCommon(query);
  const d = query.get('difficulty');
  const difficulty: Difficulty = d === 'easy' || d === 'hard' || d === 'medium' ? d : prefs.get().difficulty;
  const session = useBotSession({ overs, outMode, difficulty, name: me.name, botName: BOTS[difficulty] });
  return <MatchScreen session={session} title={`${me.name} v ${BOTS[difficulty]}`} exitHref="/play/hand-cricket?mode=bot" />;
}

function PassMatch({ query }: { query: URLSearchParams }) {
  const me = profile.use();
  const { overs, outMode } = readCommon(query);
  const p2raw = cleanName(query.get('p2') ?? '', 'Player 2');
  const p2 = p2raw === me.name ? `${p2raw} 2` : p2raw;
  const session = usePassSession({ overs, outMode, names: [me.name, p2] });
  return <MatchScreen session={session} title={`${me.name} v ${p2}`} exitHref="/play/hand-cricket?mode=pass" />;
}

export function LocalMatch({ kind, query }: { kind: 'bot' | 'pass'; query: URLSearchParams }) {
  return kind === 'bot' ? <BotMatch query={query} /> : <PassMatch query={query} />;
}
