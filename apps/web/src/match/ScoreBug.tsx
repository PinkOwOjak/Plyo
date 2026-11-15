import { BALLS_PER_OVER, OUT_MODE_INFO, currentInnings, maxBalls, oversText, target, type MatchState, type Side } from '@plyo/engine';
import { Digits, IconLock } from '@plyo/core';

/** Broadcast-style score panel: both sides, overs, chase equation, this over. */
export function ScoreBug({ state, names, nearSide }: { state: MatchState; names: [string, string]; nearSide: Side }) {
  const cur = currentInnings(state);
  const order: Side[] = [nearSide, nearSide === 0 ? 1 : 0];
  const t = target(state);

  let line = `${state.config.overs} overs a side, one wicket`;
  if (cur && state.innings.length === 2 && t !== null && !cur.complete) {
    const need = t - cur.runs;
    const left = maxBalls(state) - cur.balls.length;
    line = `${names[cur.battingSide]} needs ${need} from ${left}`;
  } else if (state.phase === 'innings-break' && t !== null) line = `Target ${t}`;

  const overStart = cur ? Math.floor(Math.max(0, cur.balls.length - 1) / BALLS_PER_OVER) * BALLS_PER_OVER : 0;
  const fresh = cur && cur.balls.length > 0 && cur.balls.length % BALLS_PER_OVER === 0 && !cur.complete;
  const over = cur && !fresh ? cur.balls.slice(overStart) : [];

  return (
    <section className="bug" aria-label="Scoreboard" aria-live="polite">
      {order.map((side) => {
        const inn = state.innings.find((i) => i.battingSide === side);
        const live = cur?.battingSide === side && !cur.complete && state.phase === 'playing';
        const status = !inn ? 'Yet to bat' : inn.complete ? (inn.out ? 'Out' : 'Not out') : 'Batting';
        return (
          <div key={side} className={`bug__row${live ? ' is-live' : ''}`}>
            <span className={`bug__team bug__team--${side === nearSide ? 'near' : 'far'}`}>
              <strong>{names[side]}</strong>
              <small>{state.phase === 'toss' ? '' : status}</small>
            </span>
            <Digits value={inn?.runs ?? 0} min={2} className="bug__runs" />
            <span className="bug__overs">
              {inn ? oversText(inn.balls.length) : '0.0'}
              <small>/{state.config.overs}</small>
            </span>
          </div>
        );
      })}
      <div className="bug__foot">
        <span>{line}</span>
        <span className="bug__balls" aria-label="This over">
          {Array.from({ length: BALLS_PER_OVER }, (_, i) => {
            const b = over[i];
            const cls = !b ? '' : b.out ? ' is-out' : b.runs === 6 ? ' is-six' : b.runs === 0 ? ' is-dot' : ' is-run';
            return (
              <span key={i} className={`bug__ball${cls}`}>
                {b ? (b.out ? 'W' : b.runs) : ''}
              </span>
            );
          })}
        </span>
      </div>
      <div className="bug__rule">
        <IconLock width={14} height={14} />
        {OUT_MODE_INFO[state.config.outMode].name}
      </div>
    </section>
  );
}
