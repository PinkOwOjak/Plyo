import { useEffect, useState } from 'react';
import type { CoinFace, Side, TossDecision } from '../engine/match.ts';
import { sfx } from '../../../platform/sound.ts';

export interface TossInfo {
  caller: Side;
  call: CoinFace | null;
  coin: CoinFace | null;
  winner: Side | null;
  decision: TossDecision | null;
}

interface Props {
  names: [string, string];
  toss: TossInfo;
  /** Whether this device may act for the given side. */
  canAct: (side: Side) => boolean;
  onCall: (face: CoinFace) => void;
  onDecide: (d: TossDecision) => void;
}

export function TossView({ names, toss, canAct, onCall, onDecide }: Props) {
  const [landed, setLanded] = useState(false);
  const flipping = toss.coin !== null && !landed;

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
    <div className="overlay-card toss" role="dialog" aria-labelledby="toss-title">
      <h2 id="toss-title">The toss</h2>
      <div className={`coin${flipping ? ' coin--flip' : ''}${toss.coin === 'tails' ? ' coin--tails' : ''}`} aria-hidden>
        <span className="coin__face coin__face--heads">H</span>
        <span className="coin__face coin__face--tails">T</span>
      </div>

      {toss.coin === null && (
        canAct(toss.caller) ? (
          <>
            <p>{caller}, call it in the air.</p>
            <div className="overlay-actions">
              <button className="btn btn--amber btn--lg" onClick={() => onCall('heads')}>Heads</button>
              <button className="btn btn--amber btn--lg" onClick={() => onCall('tails')}>Tails</button>
            </div>
          </>
        ) : (
          <p className="muted">Waiting for {caller} to call…</p>
        )
      )}

      {toss.coin !== null && !landed && <p className="muted">{caller} called {toss.call}…</p>}

      {landed && toss.winner !== null && (
        <>
          <p className="toss__result">
            It’s {toss.coin}. <strong>{names[toss.winner]}</strong> won the toss.
          </p>
          {toss.decision === null &&
            (canAct(toss.winner) ? (
              <div className="overlay-actions">
                <button className="btn btn--primary btn--lg" onClick={() => onDecide('bat')}>Bat first</button>
                <button className="btn btn--ghost btn--lg" onClick={() => onDecide('bowl')}>Bowl first</button>
              </div>
            ) : (
              <p className="muted">{names[toss.winner]} is choosing…</p>
            ))}
          {toss.decision !== null && (
            <p className="muted">{names[toss.winner]} chose to {toss.decision} first.</p>
          )}
        </>
      )}
    </div>
  );
}
