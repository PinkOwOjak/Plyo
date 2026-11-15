import { ALL_GESTURES, OUT_MODE_INFO, extendedCount, runsFor } from '@plyo/engine';
import { Glyph, RuleModePicker, prefs } from '@plyo/core';

const GROUPS = [0, 1, 2, 3, 4, 5].map((n) => ALL_GESTURES.filter((g) => extendedCount(g) === n));

export function Rules() {
  const p = prefs.use();
  return (
    <div className="rules">
      <header className="page-head">
        <h1>How Hand Cricket works</h1>
        <p className="dim lede">
          Each ball, the batter and the bowler choose a hand in secret and reveal together. Fingers are read thumb, index, middle, ring,
          little: <span className="code">1</span> raised, <span className="code">0</span> folded.
        </p>
      </header>

      <div className="rules__cols">
        <section>
          <h2>Runs</h2>
          <table className="scorecard scorecard--wide">
            <tbody>
              <tr><td>Closed fist <span className="code">00000</span></td><td>0</td></tr>
              <tr><td>Thumb only <span className="code">10000</span>, the thumbs-up</td><td className="six">6</td></tr>
              <tr><td>Any other single finger</td><td>1</td></tr>
              <tr><td>Any two fingers</td><td>2</td></tr>
              <tr><td>Any three fingers</td><td>3</td></tr>
              <tr><td>Any four fingers</td><td>4</td></tr>
              <tr><td>All five <span className="code">11111</span></td><td>5</td></tr>
            </tbody>
          </table>
          <h2 className="rules__h2">The match</h2>
          <ol className="rules__steps">
            <li>A coin toss; the winner chooses to bat or bowl.</li>
            <li>Same number of overs each, six balls an over, one wicket each.</li>
            <li>The first innings ends on a wicket or when the overs run out. That score plus one is the target.</li>
            <li>The chasers win by reaching the target. Otherwise the side that batted first wins. Level scores tie.</li>
          </ol>
        </section>
        <section>
          <h2>OUT rules</h2>
          <p className="dim">Picked before every match and locked until it ends. Scoring never changes.</p>
          <RuleModePicker value={p.outMode} onChange={(m) => prefs.set((x) => ({ ...x, outMode: m }))} />
          <p className="dim rules__note">Your choice here becomes the default on the setup screen. {OUT_MODE_INFO[p.outMode].name} is selected.</p>
        </section>
      </div>

      <section>
        <h2 className="rules__h2">All 32 hands</h2>
        <div className="hands">
          {GROUPS.map((group, n) => (
            <div key={n} className="hands__group">
              <h3>{n === 0 ? 'No fingers' : `${n} finger${n > 1 ? 's' : ''}`}</h3>
              <ul>
                {group.map((g) => (
                  <li key={g} className={g === '10000' ? 'is-six' : ''}>
                    <Glyph g={g} />
                    <span className="code">{g}</span>
                    <span className="hands__runs">{runsFor(g)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
