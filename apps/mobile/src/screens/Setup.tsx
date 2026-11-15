import { useState } from 'react';
import { OUT_MODE_INFO, OVER_OPTIONS, type Difficulty, type OutMode } from '@plyo/engine';
import { IconBack, RuleModePicker, Segmented, cleanName, haptic, href, navigate, prefs, profile } from '@plyo/core';

type Local = 'duel' | 'pass';

export function Setup({ query }: { query: URLSearchParams }) {
  const p = prefs.use();
  const me = profile.use();
  const two = query.get('way') === 'sameDevice';
  const [local, setLocal] = useState<Local>('duel');
  const [outMode, setOutMode] = useState<OutMode>(p.outMode);
  const [overs, setOvers] = useState(p.defaultOvers);
  const [difficulty, setDifficulty] = useState<Difficulty>(p.difficulty);
  const [p2, setP2] = useState('Player 2');

  const start = () => {
    haptic('tap');
    prefs.set((x) => ({ ...x, outMode, defaultOvers: overs, difficulty }));
    const common = `overs=${overs}&rule=${outMode}`;
    if (!two) navigate(`/play/bot?${common}&difficulty=${difficulty}`);
    else navigate(`/play/${local}?${common}&p2=${encodeURIComponent(cleanName(p2, 'Player 2'))}`);
  };

  return (
    <div className="sheet-screen">
      <header className="m-bar">
        <a className="icon-btn" href={href('/')} aria-label="Back"><IconBack /></a>
        <h1>Hand Cricket</h1>
        <a className="m-bar__link" href={href('/rules')}>Rules</a>
      </header>
      <div className="sheet-screen__body">
        {two && (
          <section className="m-section">
            <h2 className="m-label">Sharing this phone</h2>
            <div className="choice" role="radiogroup" aria-label="Two-player style">
              <button type="button" role="radio" aria-checked={local === 'duel'} onClick={() => setLocal('duel')}>
                <strong>Face to face</strong>
                <span>Phone flat between you. Both tap ready, then three seconds to set your fingers.</span>
              </button>
              <button type="button" role="radio" aria-checked={local === 'pass'} onClick={() => setLocal('pass')}>
                <strong>Pass the phone</strong>
                <span>Choose in secret, hand the phone over, then reveal together.</span>
              </button>
            </div>
          </section>
        )}

        <section className="m-section">
          <h2 className="m-label">OUT rule, locked for the match</h2>
          <RuleModePicker value={outMode} onChange={(m) => { haptic('select'); setOutMode(m); }} />
        </section>

        <section className="m-section">
          <h2 className="m-label">Match</h2>
          <div className="m-row">
            <span>Overs a side</span>
            <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
          </div>
          {!two && (
            <div className="m-row">
              <span>Bot</span>
              <Segmented<Difficulty> label="Bot difficulty" value={difficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} onChange={setDifficulty} />
            </div>
          )}
          {two && (
            <label className="m-row m-row--stack">
              <span>Second player <small>You are {me.name}, at the bottom.</small></span>
              <input className="input" value={p2} maxLength={16} onChange={(e) => setP2(e.target.value)} />
            </label>
          )}
        </section>
      </div>
      <footer className="sheet-screen__cta">
        <p>
          {OUT_MODE_INFO[outMode].name} · {overs} overs
        </p>
        <button className="btn btn--primary btn--lg btn--block" onClick={start}>Start match</button>
      </footer>
    </div>
  );
}
