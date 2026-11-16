import { BALLS_PER_OVER, OUT_MODE_INFO, currentInnings, maxBalls, oversText, target, type MatchState, type Side } from '@plyo/engine';
import { Digits, IconLock } from '@plyo/core';

export function ScoreStrip({ state, names, nearSide, compact }: { state: MatchState; names: [string, string]; nearSide: Side; compact?: boolean }) {
  const cur = currentInnings(state);
  const t = target(state);
  const order: Side[] = [nearSide, nearSide === 0 ? 1 : 0];
  let line = `${state.config.overs} overs, 1 wicket`;
  if (cur && state.innings.length === 2 && t !== null && !cur.complete) line = `Need ${t - cur.runs} from ${maxBalls(state) - cur.balls.length}`;
  else if (state.phase === 'innings-break' && t !== null) line = `Target ${t}`;
  const start = cur ? Math.floor(Math.max(0, cur.balls.length - 1) / BALLS_PER_OVER) * BALLS_PER_OVER : 0;
  const fresh = cur && cur.balls.length > 0 && cur.balls.length % BALLS_PER_OVER === 0 && !cur.complete;
  const over = cur && !fresh ? cur.balls.slice(start) : [];

  return (
    <section className={`strip${compact ? ' strip--compact' : ''}`} aria-label="Scoreboard" aria-live="polite">
      <div className="strip__teams">
        {order.map((side) => {
          const inn = state.innings.find((i) => i.battingSide === side);
          const live = cur?.battingSide === side && !cur.complete && state.phase === 'playing';
          return (
            <div key={side} className={`strip__team strip__team--${side === nearSide ? 'near' : 'far'}${live ? ' is-live' : ''}`}>
              <span className="strip__name">{names[side]}</span>
              <Digits value={inn?.runs ?? 0} min={2} className="strip__runs" />
              <span className="strip__ov">{inn ? oversText(inn.balls.length) : '0.0'}</span>
            </div>
          );
        })}
      </div>
      <div className="strip__foot">
        <span className="strip__rule"><IconLock width={12} height={12} />{OUT_MODE_INFO[state.config.outMode].name}</span>
        <span>{line}</span>
        <span className="strip__balls">
          {Array.from({ length: BALLS_PER_OVER }, (_, i) => {
            const b = over[i];
            return <i key={i} className={!b ? '' : b.out ? 'is-out' : b.runs === 6 ? 'is-six' : b.runs === 0 ? 'is-dot' : 'is-run'} />;
          })}
        </span>
      </div>
    </section>
  );
}
