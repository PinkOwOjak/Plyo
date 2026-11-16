import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { currentInnings, describeGesture, runsFor, type Gesture } from '@plyo/engine';
import { IconBack, haptic, href, sessionOverlay, type MatchSession } from '@plyo/core';
import { Arena } from './Arena.tsx';
import { Pads } from './Pads.tsx';
import { ScoreStrip } from './ScoreStrip.tsx';

/** Portrait match for one player per turn (bot, pass the phone, online). */
export function SoloMatch({ session, title, exitHref, onExit, arenaNote, breakNote }: { session: MatchSession; title: string; exitHref: string; onExit?: () => void; arenaNote?: ReactNode; breakNote?: ReactNode }) {
  const [sel, setSel] = useState<[Gesture, Gesture]>(['01000', '01000']);
  const { state, names, nearSide, pickers } = session;
  const picker = pickers[0] ?? null;
  const value = sel[picker ?? nearSide];
  const active = picker !== null && !session.reveal;
  const cur = currentInnings(state);
  const role = cur?.battingSide === (picker ?? nearSide) ? 'bat' : 'bowl';

  // A fresh pick for each pass-the-phone turn so the next player doesn't inherit a hand.
  useEffect(() => {
    if (session.hidePreview && picker !== null) setSel(['00000', '00000']);
  }, [session.hidePreview, picker]);

  const change = useCallback((g: Gesture) => picker !== null && setSel((s) => (picker === 0 ? [g, s[1]] : [s[0], g])), [picker]);
  const lock = () => {
    if (!active || picker === null) return;
    haptic('tap');
    session.submit(picker, sel[picker]);
  };

  const exit = onExit ? <button className="btn btn--line btn--lg" onClick={onExit}>Leave</button> : <a className="btn btn--line btn--lg" href={href(exitHref)}>Leave</a>;
  const overlay = sessionOverlay(session, exit, { breakNote });
  const runs = runsFor(value);
  const label = !active ? 'Waiting' : session.hidePreview ? `Lock in for ${names[picker!]}` : role === 'bat' ? 'Play shot' : 'Bowl';

  return (
    <div className="play">
      <header className="m-bar m-bar--play">
        {onExit ? (
          <button className="icon-btn" aria-label="Leave match" onClick={onExit}><IconBack /></button>
        ) : (
          <a className="icon-btn" href={href(exitHref)} aria-label="Leave match"><IconBack /></a>
        )}
        <h1>{title}</h1>
      </header>
      <ScoreStrip state={state} names={names} nearSide={nearSide} />
      <Arena session={session} preview={session.hidePreview ? null : value}>{arenaNote}</Arena>
      <div className="dock">
        <p className="dock__prompt" aria-live="polite">
          {session.reveal
            ? 'Hands on the pitch'
            : active
              ? `${session.hidePreview ? `${names[picker!]}, choose in secret. ` : ''}${role === 'bat' ? 'You’re batting.' : 'You’re bowling.'} ${describeGesture(value)}${role === 'bat' ? `, ${runs === 6 ? 'six' : `${runs} run${runs === 1 ? '' : 's'}`}` : ''}`
              : session.status}
        </p>
        <Pads value={value} onChange={change} active={active} />
        <button className="btn btn--primary btn--lg btn--block dock__go" disabled={!active} onClick={lock}>
          {label}
        </button>
      </div>
      {overlay && <div className="overlay">{overlay}</div>}
    </div>
  );
}
