/**
 * Match overlays shared by both apps: toss, innings break, hand-off, result.
 * Behaviour is shared; each app styles the `.panel` classes its own way.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { OUT_MODE_INFO, maxBalls, oversText, target, type MatchState, type Side } from '@plyo/engine';
import { sfx } from '../sound.ts';
import type { MatchSession } from '../session.ts';
import { Digits } from './primitives.tsx';

export function TossPanel({ session }: { session: MatchSession }) {
  const { toss, names } = session;
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (toss.coin === null) {
      setLanded(false);
      return;
    }
    sfx.coin();
    const t = setTimeout(() => setLanded(true), 1300);
    return () => clearTimeout(t);
  }, [toss.coin]);
  const caller = names[toss.caller];
  return (
    <div className="panel panel--toss" role="dialog" aria-labelledby="toss-h">
      <h2 id="toss-h">The toss</h2>
      <div className={`coin${toss.coin && !landed ? ' coin--flip' : ''}${toss.coin === 'tails' ? ' coin--tails' : ''}`} aria-hidden>
        <span className="coin__f coin__f--h">H</span>
        <span className="coin__f coin__f--t">T</span>
      </div>
      {toss.coin === null &&
        (session.canActForToss(toss.caller) ? (
          <>
            <p>{caller}, call it.</p>
            <div className="panel__actions">
              <button className="btn btn--line btn--lg" onClick={() => session.callToss('heads')}>Heads</button>
              <button className="btn btn--line btn--lg" onClick={() => session.callToss('tails')}>Tails</button>
            </div>
          </>
        ) : (
          <p className="dim">Waiting for {caller} to call…</p>
        ))}
      {toss.coin !== null && !landed && <p className="dim">{caller} called {toss.call}.</p>}
      {landed && toss.winner !== null && (
        <>
          <p>
            It’s {toss.coin}. <strong>{names[toss.winner]}</strong> won the toss.
          </p>
          {toss.decision === null &&
            (session.canActForToss(toss.winner) ? (
              <div className="panel__actions">
                <button className="btn btn--primary btn--lg" onClick={() => session.decideToss('bat')}>Bat first</button>
                <button className="btn btn--line btn--lg" onClick={() => session.decideToss('bowl')}>Bowl first</button>
              </div>
            ) : (
              <p className="dim">{names[toss.winner]} is choosing…</p>
            ))}
          {toss.decision && <p className="dim">{names[toss.winner]} chose to {toss.decision} first.</p>}
        </>
      )}
      <p className="panel__rule">
        Rule locked for this match: <strong>{OUT_MODE_INFO[session.outMode].name}</strong>
      </p>
    </div>
  );
}

export function InningsBreakPanel({ session, note, startLabel }: { session: MatchSession; note?: ReactNode; startLabel?: string }) {
  const { state, names } = session;
  const first = state.innings[0];
  const chaser: Side = first.battingSide === 0 ? 1 : 0;
  return (
    <div className="panel" role="dialog" aria-labelledby="break-h">
      <h2 id="break-h">Innings break</h2>
      <Digits value={first.runs} className="panel__big" />
      <p>
        {names[first.battingSide]} {first.out ? 'was out for' : 'finished on'} {first.runs}. <strong>{names[chaser]}</strong> needs{' '}
        {target(state)} from {maxBalls(state)} balls.
      </p>
      {note}
      <div className="panel__actions">
        <button className="btn btn--primary btn--lg" onClick={session.nextInnings}>
          {startLabel ?? 'Start second innings'}
        </button>
      </div>
    </div>
  );
}

export function HandoffPanel({ session }: { session: MatchSession }) {
  const side = session.handoff!;
  const batter = session.state.innings.at(-1)?.battingSide ?? 0;
  const second = side !== batter;
  const { names } = session;
  return (
    <div className="panel" role="dialog" aria-labelledby="handoff-h">
      <h2 id="handoff-h">Pass to {names[side]}</h2>
      <p>
        {second
          ? `${names[batter]} has locked in. ${names[side]}, you’re bowling. ${names[batter]}, look away.`
          : `${names[side]} is batting. ${names[side === 0 ? 1 : 0]}, look away while they choose.`}
      </p>
      <div className="panel__actions">
        <button className="btn btn--primary btn--lg" onClick={session.confirmHandoff}>
          I’m {names[side]}
        </button>
      </div>
    </div>
  );
}

export function resultHeadline(state: MatchState, names: [string, string], you: Side | null) {
  const r = state.result!;
  if (r.winner === null) return { text: 'Tie', tone: 'tie' as const };
  if (you === null) return { text: `${names[r.winner]} wins`, tone: 'win' as const };
  return r.winner === you ? { text: 'You won', tone: 'win' as const } : { text: `${names[r.winner]} won`, tone: 'loss' as const };
}

export function ResultPanel({ session, exit }: { session: MatchSession; exit: ReactNode }) {
  const { state, names } = session;
  const r = state.result!;
  const head = resultHeadline(state, names, session.you);
  return (
    <div className={`panel panel--result panel--${head.tone}`} role="dialog" aria-labelledby="result-h">
      <h2 id="result-h" className="panel__headline">{head.text}</h2>
      <p className="panel__margin">{r.winner !== null ? `${names[r.winner]} won ${r.margin}` : 'Scores level'}</p>
      <table className="scorecard">
        <thead>
          <tr>
            <th scope="col">Innings</th>
            <th scope="col">R</th>
            <th scope="col">Ov</th>
            <th scope="col">6s</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {state.innings.map((inn, i) => (
            <tr key={i}>
              <td>{names[inn.battingSide]}</td>
              <td className="scorecard__runs">{inn.runs}</td>
              <td>{oversText(inn.balls.length)}</td>
              <td>{inn.balls.filter((b) => b.runs === 6).length}</td>
              <td className="dim">{inn.out ? 'out' : 'not out'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="panel__rule">Played under {OUT_MODE_INFO[state.config.outMode].name.toLowerCase()} rules.</p>
      {session.rematchNote && <p className="dim">{session.rematchNote}</p>}
      <div className="panel__actions">
        {session.rematch && (
          <button className="btn btn--primary btn--lg" onClick={session.rematch}>
            {session.rematchLabel}
          </button>
        )}
        {exit}
      </div>
    </div>
  );
}

/** Picks the overlay a session needs right now, if any. */
export function sessionOverlay(session: MatchSession, exit: ReactNode, extras: { breakNote?: ReactNode; breakLabel?: string } = {}) {
  const { state, reveal } = session;
  if (state.phase === 'toss') return <TossPanel session={session} />;
  if (session.handoff !== null) return <HandoffPanel session={session} />;
  if (state.phase === 'innings-break' && !reveal) return <InningsBreakPanel session={session} note={extras.breakNote} startLabel={extras.breakLabel} />;
  if (state.phase === 'complete' && !reveal) return <ResultPanel session={session} exit={exit} />;
  return null;
}
