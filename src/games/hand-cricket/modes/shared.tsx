import { useEffect, useRef } from 'react';
import { maxBalls, target, type MatchState, type Side } from '../engine/match.ts';
import { recordMatch, type StatMode } from '../../../platform/profile.ts';
import { sfx } from '../../../platform/sound.ts';

export function InningsBreak({
  state,
  names,
  onStart,
  startLabel = 'Start second innings',
  note,
}: {
  state: MatchState;
  names: [string, string];
  onStart?: () => void;
  startLabel?: string;
  note?: React.ReactNode;
}) {
  const first = state.innings[0];
  const chaser: Side = first.battingSide === 0 ? 1 : 0;
  const t = target(state)!;
  return (
    <div className="overlay-card" role="dialog" aria-labelledby="break-title">
      <h2 id="break-title">Innings break</h2>
      <p className="break__score">
        <span className="tile tile--xl">{first.runs}</span>
      </p>
      <p>
        {names[first.battingSide]} {first.out ? 'were out for' : 'finished on'} {first.runs}.{' '}
        <strong>{names[chaser]}</strong> needs {t} from {maxBalls(state)} balls.
      </p>
      {note}
      {onStart && (
        <div className="overlay-actions">
          <button className="btn btn--primary btn--lg" onClick={onStart}>{startLabel}</button>
        </div>
      )}
    </div>
  );
}

/** Records the finished match once, from the perspective of `you`, and plays the end jingle. */
export function useRecordResult(state: MatchState, you: Side, mode: StatMode, matchId: number) {
  const recorded = useRef(-1);
  useEffect(() => {
    if (state.phase !== 'complete' || recorded.current === matchId || !state.result) return;
    recorded.current = matchId;
    const w = state.result.winner;
    const outcome = w === null ? 'tied' : w === you ? 'won' : 'lost';
    const mine = state.innings.find((i) => i.battingSide === you);
    recordMatch(mode, outcome, mine ? { runs: mine.runs, sixes: mine.balls.filter((b) => b.runs === 6).length } : null);
    if (outcome === 'lost') sfx.lose();
    else sfx.win();
  }, [state, you, mode, matchId]);
}

export function parseOvers(raw: string | null, fallback: number) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : fallback;
}
