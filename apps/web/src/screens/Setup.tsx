import { useState } from 'react';
import { OVER_OPTIONS, type Difficulty, type OutMode } from '@plyo/engine';
import { OUT_MODE_INFO } from '@plyo/engine';
import { IconBot, IconGlobe, IconUsers, RuleModePicker, Segmented, cleanName, href, navigate, prefs, profile } from '@plyo/core';

type Mode = 'bot' | 'pass' | 'online';

const MODES: { id: Mode; title: string; text: string; Icon: typeof IconBot }[] = [
  { id: 'bot', title: 'Bot', text: 'A computer opponent that learns your habits.', Icon: IconBot },
  { id: 'pass', title: 'Two players, one screen', text: 'Choose in secret and pass the device between balls.', Icon: IconUsers },
  { id: 'online', title: 'Online', text: 'Create a room and share the code with a friend.', Icon: IconGlobe },
];

const BOTS: Record<Difficulty, string> = { easy: 'Pip', medium: 'Rivet', hard: 'Ace' };

export function Setup({ query }: { query: URLSearchParams }) {
  const p = prefs.use();
  const me = profile.use();
  const q = query.get('mode');
  const [mode, setMode] = useState<Mode>(q === 'pass' || q === 'online' ? q : 'bot');
  const [outMode, setOutMode] = useState<OutMode>(p.outMode);
  const [overs, setOvers] = useState(p.defaultOvers);
  const [difficulty, setDifficulty] = useState<Difficulty>(p.difficulty);
  const [p2, setP2] = useState('Player 2');

  const start = () => {
    prefs.set((x) => ({ ...x, outMode, defaultOvers: overs, difficulty }));
    if (mode === 'online') return navigate(`/online?overs=${overs}&rule=${outMode}`);
    const qs =
      mode === 'bot'
        ? `overs=${overs}&rule=${outMode}&difficulty=${difficulty}`
        : `overs=${overs}&rule=${outMode}&p2=${encodeURIComponent(cleanName(p2, 'Player 2'))}`;
    navigate(`/match/${mode}?${qs}`);
  };

  return (
    <div className="setup">
      <header className="page-head">
        <a className="back-link" href={href('/')}>Library</a>
        <h1>Set up Hand Cricket</h1>
      </header>

      <div className="setup__grid">
        <ol className="steps">
          <li className="step">
            <h2 className="step__title">Opponent</h2>
            <div className="mode-pick" role="radiogroup" aria-label="Opponent">
              {MODES.map(({ id, title, text, Icon }) => (
                <button key={id} type="button" role="radio" aria-checked={mode === id} className="mode-opt" onClick={() => setMode(id)}>
                  <Icon />
                  <strong>{title}</strong>
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </li>

          <li className="step">
            <h2 className="step__title">OUT rule</h2>
            <p className="step__hint">
              {mode === 'online'
                ? 'You propose the rule; your opponent must ready up under it before the match starts.'
                : 'Chosen now and locked for the whole match.'}
            </p>
            <RuleModePicker value={outMode} onChange={setOutMode} />
          </li>

          <li className="step">
            <h2 className="step__title">Match</h2>
            <div className="field">
              <span className="field__label">
                Overs per side
                <small>Six balls an over, one wicket each.</small>
              </span>
              <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
            </div>
            {mode === 'bot' && (
              <div className="field">
                <span className="field__label">
                  Bot
                  <small>Harder bots read your patterns sooner.</small>
                </span>
                <Segmented<Difficulty>
                  label="Bot difficulty"
                  value={difficulty}
                  options={[
                    { value: 'easy', label: 'Pip · Easy' },
                    { value: 'medium', label: 'Rivet · Medium' },
                    { value: 'hard', label: 'Ace · Hard' },
                  ]}
                  onChange={setDifficulty}
                />
              </div>
            )}
            {mode === 'pass' && (
              <label className="field field--stack">
                <span className="field__label">
                  Second player
                  <small>You play as {me.name}.</small>
                </span>
                <input className="input" value={p2} maxLength={16} onChange={(e) => setP2(e.target.value)} />
              </label>
            )}
          </li>
        </ol>

        <aside className="summary" aria-label="Match summary">
          <h2>Ready to bowl</h2>
          <dl>
            <div><dt>Opponent</dt><dd>{mode === 'bot' ? `${BOTS[difficulty]} (${difficulty})` : mode === 'pass' ? cleanName(p2, 'Player 2') : 'Friend online'}</dd></div>
            <div><dt>Rule</dt><dd>{OUT_MODE_INFO[outMode].name}</dd></div>
            <div><dt>Length</dt><dd>{overs} overs a side</dd></div>
          </dl>
          <p className="summary__rule">{OUT_MODE_INFO[outMode].summary}</p>
          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={start}>
            {mode === 'online' ? 'Go to online rooms' : 'Start match'}
          </button>
          <a className="summary__rules-link" href={href('/rules')}>How scoring works</a>
        </aside>
      </div>
    </div>
  );
}
