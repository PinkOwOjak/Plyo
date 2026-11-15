import { useState } from 'react';
import { ALL_GESTURES, extendedCount, isOut, runsFor, toFingerStates, type Gesture } from '../engine/gestures.ts';
import { prefs } from '../../../platform/prefs.ts';
import { navigate } from '../../../platform/router.ts';
import { TopBar } from '../../../shell/Shell.tsx';

/** Five small bars, one per finger, for tables and examples. */
export function GestureGlyph({ g, label = true }: { g: Gesture; label?: boolean }) {
  const s = toFingerStates(g);
  return (
    <span className="glyph" aria-label={label ? `Hand ${g}` : undefined} role={label ? 'img' : undefined}>
      {s.map((on, i) => (
        <span key={i} className={`glyph__f glyph__f--${i}${on ? ' glyph__f--on' : ''}`} />
      ))}
    </span>
  );
}

const GROUPS = [0, 1, 2, 3, 4, 5].map((n) => ALL_GESTURES.filter((g) => extendedCount(g) === n));

function OutDemo() {
  const [bat, setBat] = useState<Gesture>('01111');
  const [bowl, setBowl] = useState<Gesture>('11101');
  const out = isOut(bat, bowl);
  const sameCount = extendedCount(bat) === extendedCount(bowl);
  const options: Gesture[] = ['01111', '11101', '10111', '11110'];
  return (
    <div className="out-demo">
      <div className="out-demo__side">
        <span className="muted">Batter</span>
        <div className="out-demo__opts">
          {options.map((g) => (
            <button key={g} type="button" aria-pressed={bat === g} onClick={() => setBat(g)}>
              <GestureGlyph g={g} />
              <code>{g}</code>
            </button>
          ))}
        </div>
      </div>
      <div className="out-demo__side">
        <span className="muted">Bowler</span>
        <div className="out-demo__opts">
          {options.map((g) => (
            <button key={g} type="button" aria-pressed={bowl === g} onClick={() => setBowl(g)}>
              <GestureGlyph g={g} />
              <code>{g}</code>
            </button>
          ))}
        </div>
      </div>
      <p className={`out-demo__verdict${out ? ' out-demo__verdict--out' : ''}`} aria-live="polite">
        {out
          ? 'Out. Every finger matches.'
          : `Not out: ${bat} and ${bowl} are different hands${sameCount ? ', even with the same number of fingers' : ''}. The batter scores ${runsFor(bat)}.`}
      </p>
    </div>
  );
}

export function RulesScreen({ next }: { next: string | null }) {
  const done = () => {
    prefs.set((x) => ({ ...x, seenRules: true }));
    navigate(next ?? '/hand-cricket', { replace: !!next });
  };
  return (
    <div className="shell">
      <TopBar title="How to play" back="/hand-cricket" />
      <main className="page page--narrow rules">
        <section className="rules__block">
          <h2>Every ball, both players show a hand</h2>
          <p>
            The batter and the bowler each choose which fingers to raise, in secret. Both hands are revealed at the same moment.
            Fingers are always read in the same order: thumb, index, middle, ring, little. A raised finger is a 1, a folded finger is a 0.
          </p>
        </section>

        <section className="rules__block">
          <h2>Runs</h2>
          <table className="table">
            <tbody>
              <tr><td>Closed fist <code>00000</code></td><td>0</td></tr>
              <tr><td>Thumb only <code>10000</code></td><td><strong className="accent">6</strong></td></tr>
              <tr><td>Any other single finger</td><td>1</td></tr>
              <tr><td>Any two fingers</td><td>2</td></tr>
              <tr><td>Any three fingers</td><td>3</td></tr>
              <tr><td>Any four fingers</td><td>4</td></tr>
              <tr><td>All five fingers <code>11111</code></td><td>5</td></tr>
            </tbody>
          </table>
        </section>

        <section className="rules__block">
          <h2>Out means the exact same hand</h2>
          <p>
            The batter is out only when the bowler’s hand matches finger for finger. Showing the same <em>number</em> of fingers is not
            enough. Try it:
          </p>
          <OutDemo />
        </section>

        <section className="rules__block">
          <h2>The match</h2>
          <ol className="rules__steps">
            <li>A coin toss decides who chooses to bat or bowl first.</li>
            <li>Each side gets the same number of overs (six balls each) and one wicket.</li>
            <li>The first innings ends when the batter is out or the overs run out. That total plus one is the target.</li>
            <li>The chasing side wins by reaching the target. If they fall short, the side that batted first wins. Equal scores are a tie.</li>
          </ol>
        </section>

        <section className="rules__block">
          <h2>All 32 hands</h2>
          <div className="gesture-groups">
            {GROUPS.map((group, n) => (
              <div key={n} className="gesture-group">
                <h3>{n === 0 ? 'No fingers' : `${n} finger${n > 1 ? 's' : ''}`}</h3>
                <div className="gesture-grid">
                  {group.map((g) => (
                    <div key={g} className={`gesture-cell${g === '10000' ? ' gesture-cell--six' : ''}`}>
                      <GestureGlyph g={g} />
                      <code>{g}</code>
                      <span>{runsFor(g)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={done}>
          {next ? 'Got it, start the match' : 'Got it'}
        </button>
      </main>
    </div>
  );
}
