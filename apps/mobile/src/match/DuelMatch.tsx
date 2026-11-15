import { useEffect, useState } from 'react';
import { currentInnings, type Gesture, type Side } from '@plyo/engine';
import { IconClose, haptic, href, sessionOverlay, useCountdown, type MatchSession } from '@plyo/core';
import { Arena } from './Arena.tsx';
import { Pads } from './Pads.tsx';
import { ScoreStrip } from './ScoreStrip.tsx';

function Half({ session, side, value, onChange }: { session: MatchSession; side: Side; value: Gesture; onChange: (g: Gesture) => void }) {
  const { names, state, drawDeadline, readyForDraw } = session;
  const secs = useCountdown(drawDeadline);
  const drawing = drawDeadline !== null;
  const ready = readyForDraw.includes(side);
  const cur = currentInnings(state);
  const role = cur?.battingSide === side ? 'Batting' : 'Bowling';
  const playing = state.phase === 'playing' && !session.reveal;
  const other: Side = side === 0 ? 1 : 0;

  return (
    <section className={`half half--${side === 0 ? 'near' : 'far'}`} aria-label={`${names[side]}'s controls`}>
      <div className="half__head">
        <strong>{names[side]}</strong>
        <span>{playing ? role : ''}</span>
        {drawing && <span className="half__clock">{secs}</span>}
      </div>
      <Pads value={value} onChange={onChange} active={drawing && !session.reveal} />
      {playing && !drawing && (
        <button
          className={`btn btn--lg btn--block ${ready ? 'btn--line' : 'btn--primary'}`}
          disabled={ready}
          onClick={() => {
            haptic('tap');
            session.setReadyForDraw(side);
          }}
        >
          {ready ? `Waiting for ${names[other]}` : 'Ready'}
        </button>
      )}
      {drawing && <p className="half__hint">Set your fingers. Locks at zero.</p>}
      {!playing && !drawing && <p className="half__hint">{session.reveal ? 'Reveal' : ''}</p>}
    </section>
  );
}

/** Face-to-face on one phone: player two's half is rotated to face them. */
export function DuelMatch({ session, exitHref }: { session: MatchSession; exitHref: string }) {
  const [sel, setSel] = useState<[Gesture, Gesture]>(['00000', '00000']);
  const drawing = session.drawDeadline !== null;

  // New draw: both hands start closed.
  useEffect(() => {
    if (drawing) {
      setSel(['00000', '00000']);
      session.setSelection(0, '00000');
      session.setSelection(1, '00000');
      haptic('heavy');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  const set = (side: Side) => (g: Gesture) => {
    setSel((s) => (side === 0 ? [g, s[1]] : [s[0], g]));
    session.setSelection(side, g);
  };
  const exit = <a className="btn btn--line btn--lg" href={href(exitHref)}>Leave</a>;
  const overlay = sessionOverlay(session, exit);

  return (
    <div className="duel">
      <Half session={session} side={1} value={sel[1]} onChange={set(1)} />
      <div className="duel__mid">
        <Arena session={session} preview={null} flipCalls>
          <ScoreStrip state={session.state} names={session.names} nearSide={0} compact />
          <a className="duel__exit icon-btn" href={href(exitHref)} aria-label="Leave match"><IconClose /></a>
        </Arena>
      </div>
      <Half session={session} side={0} value={sel[0]} onChange={set(0)} />
      {overlay && <div className="overlay overlay--duel">{overlay}</div>}
    </div>
  );
}
