import { useEffect, useRef, useState } from 'react';
import { BALLS_PER_OVER, currentInnings, maxBalls, oversText, target, type MatchState, type Side } from '../engine/match.ts';

/** Digits on manual scoreboard tiles that flip when they change. */
export function Tiles({ value, min = 1, className = '' }: { value: number; min?: number; className?: string }) {
  const digits = String(value).padStart(min, ' ').split('');
  const prev = useRef(digits);
  const [flipKeys, setFlipKeys] = useState<number[]>(() => digits.map(() => 0));
  useEffect(() => {
    const changed = digits.map((d, i) => d !== prev.current[i]);
    if (changed.some(Boolean)) setFlipKeys((k) => digits.map((_, i) => (changed[i] ? (k[i] ?? 0) + 1 : k[i] ?? 0)));
    prev.current = digits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span className={`tiles ${className}`} aria-label={String(value)}>
      {digits.map((d, i) => (
        <span key={`${i}-${flipKeys[i]}`} className={`tile${flipKeys[i] ? ' tile--flip' : ''}`} aria-hidden>
          {d === ' ' ? ' ' : d}
        </span>
      ))}
    </span>
  );
}

export function Scoreboard({ state, names, nearSide }: { state: MatchState; names: [string, string]; nearSide: Side }) {
  const cur = currentInnings(state);
  const t = target(state);
  const order: Side[] = [nearSide, nearSide === 0 ? 1 : 0];

  const rowFor = (side: Side) => {
    const inn = state.innings.find((i) => i.battingSide === side);
    const batting = cur?.battingSide === side && !cur.complete;
    let status = 'Yet to bat';
    if (inn) status = inn.complete ? (inn.out ? 'Out' : 'Not out') : 'Batting';
    if (state.phase === 'toss') status = '';
    return (
      <div key={side} className={`sb-row${batting ? ' sb-row--live' : ''}${side === nearSide ? ' sb-row--you' : ''}`}>
        <span className="sb-row__name">
          {names[side]}
          {status && <small>{status}</small>}
        </span>
        <Tiles value={inn?.runs ?? 0} min={2} />
        <span className="sb-row__overs">
          {inn ? oversText(inn.balls.length) : '0.0'}
          <small>of {state.config.overs} ov</small>
        </span>
      </div>
    );
  };

  let line = `${state.config.overs} over${state.config.overs === 1 ? '' : 's'} a side · one wicket`;
  if (cur && state.innings.length === 2 && t !== null && !cur.complete) {
    const need = t - cur.runs;
    const left = maxBalls(state) - cur.balls.length;
    line = `${names[cur.battingSide]} needs ${need} from ${left} ball${left === 1 ? '' : 's'}`;
  } else if (cur && state.innings.length === 1 && !cur.complete) {
    line = `First innings · ${names[cur.battingSide]} batting`;
  } else if (state.phase === 'innings-break' && t !== null) {
    line = `Target ${t}`;
  }

  const overBalls = cur ? cur.balls.slice(Math.floor(Math.max(0, cur.balls.length - 1) / BALLS_PER_OVER) * BALLS_PER_OVER) : [];
  const showOver = cur && cur.balls.length > 0 ? (cur.balls.length % BALLS_PER_OVER === 0 && !cur.complete ? [] : overBalls) : [];

  return (
    <section className="scoreboard" aria-label="Scoreboard" aria-live="polite">
      {order.map(rowFor)}
      <div className="sb-foot">
        <span className="sb-foot__line">{line}</span>
        <span className="sb-over" aria-label="This over">
          {Array.from({ length: BALLS_PER_OVER }, (_, i) => {
            const b = showOver[i];
            const cls = !b ? '' : b.out ? ' ball--out' : b.runs === 6 ? ' ball--six' : b.runs === 0 ? ' ball--dot' : '';
            return (
              <span key={i} className={`ball${b ? ' ball--done' : ''}${cls}`}>
                {b ? (b.out ? 'W' : b.runs) : ''}
              </span>
            );
          })}
        </span>
      </div>
    </section>
  );
}
