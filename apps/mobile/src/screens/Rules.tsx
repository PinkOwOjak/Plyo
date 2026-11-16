import { ALL_GESTURES, extendedCount, runsFor } from '@plyo/engine';
import { Glyph, IconBack, RuleModePicker, prefs } from '@plyo/core';

export function Rules() {
  const p = prefs.use();
  return (
    <div className="sheet-screen">
      <header className="m-bar">
        <button className="icon-btn" aria-label="Back" onClick={() => history.back()}><IconBack /></button>
        <h1>How to play</h1>
      </header>
      <div className="sheet-screen__body rules">
        <p className="dim">Both players choose a hand in secret and reveal together. Fingers are read thumb to little: 1 raised, 0 folded.</p>
        <h2 className="m-label">Runs</h2>
        <ul className="m-table">
          <li><span>Closed fist</span><b>0</b></li>
          <li><span>Thumb only, thumbs up</span><b className="six">6</b></li>
          <li><span>Any other single finger</span><b>1</b></li>
          <li><span>Two, three, four fingers</span><b>2–4</b></li>
          <li><span>All five</span><b>5</b></li>
        </ul>
        <h2 className="m-label">OUT rules</h2>
        <RuleModePicker value={p.outMode} onChange={(m) => prefs.set((x) => ({ ...x, outMode: m }))} />
        <h2 className="m-label">Match</h2>
        <p className="dim">Toss, then one innings each with the same overs and one wicket. Beat the first innings total to win.</p>
        <h2 className="m-label">All 32 hands</h2>
        <ul className="m-hands">
          {[...ALL_GESTURES].sort((a, b) => extendedCount(a) - extendedCount(b)).map((g) => (
            <li key={g} className={g === '10000' ? 'is-six' : ''}><Glyph g={g} /><span className="code">{g}</span><b>{runsFor(g)}</b></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
