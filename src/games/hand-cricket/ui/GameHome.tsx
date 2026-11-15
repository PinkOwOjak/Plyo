import { useState } from 'react';
import { OVER_OPTIONS } from '../engine/match.ts';
import type { Difficulty } from '../engine/ai.ts';
import { prefs } from '../../../platform/prefs.ts';
import { profile, cleanName } from '../../../platform/profile.ts';
import { href, navigate } from '../../../platform/router.ts';
import { Segmented, TopBar } from '../../../shell/Shell.tsx';
import { IconHelp } from '../../../shell/icons.tsx';

type Mode = 'bot' | 'local' | 'online';

const MODES: { id: Mode; title: string; text: string }[] = [
  { id: 'bot', title: 'Play the bot', text: 'A computer opponent that learns your habits as the match goes on.' },
  { id: 'local', title: 'Pass & play', text: 'Two players, one device. Each of you chooses in secret, then the hands are revealed together.' },
  { id: 'online', title: 'Play online', text: 'Create a room, share the code, and play a friend on their own device.' },
];

export function GameHome() {
  const p = prefs.use();
  const me = profile.use();
  const [mode, setMode] = useState<Mode>('bot');
  const [overs, setOvers] = useState(p.defaultOvers);
  const [difficulty, setDifficulty] = useState<Difficulty>(p.difficulty);
  const [p2, setP2] = useState('Player 2');

  const start = () => {
    const target =
      mode === 'bot'
        ? `/hand-cricket/bot?overs=${overs}&difficulty=${difficulty}`
        : mode === 'local'
          ? `/hand-cricket/local?overs=${overs}&p2=${encodeURIComponent(cleanName(p2, 'Player 2'))}`
          : `/hand-cricket/online?overs=${overs}`;
    prefs.set((x) => ({ ...x, defaultOvers: overs, difficulty }));
    if (!p.seenRules) navigate(`/hand-cricket/rules?next=${encodeURIComponent(target)}`);
    else navigate(target);
  };

  return (
    <div className="shell">
      <TopBar
        title="Hand Cricket"
        back="/"
        actions={
          <a className="icon-btn" href={href('/hand-cricket/rules')} aria-label="How to play">
            <IconHelp />
          </a>
        }
      />
      <main className="page page--narrow hc-home">
        <p className="hc-home__lede">
          Raise fingers to score. The thumb alone is a six. If the bowler shows <em>exactly</em> the same hand as you, you’re out.
        </p>

        <div className="mode-list" role="radiogroup" aria-label="Game mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className="mode"
              onClick={() => setMode(m.id)}
            >
              <span className="mode__radio" aria-hidden />
              <span>
                <strong>{m.title}</strong>
                <span>{m.text}</span>
              </span>
            </button>
          ))}
        </div>

        <section className="section setup" aria-label="Match settings">
          <div className="field">
            <div className="field__label">Overs per side<span>Six balls an over. One wicket each.</span></div>
            <Segmented label="Overs" value={overs} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={setOvers} />
          </div>
          {mode === 'bot' && (
            <div className="field">
              <div className="field__label">Bot difficulty</div>
              <Segmented<Difficulty>
                label="Bot difficulty"
                value={difficulty}
                options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
                onChange={setDifficulty}
              />
            </div>
          )}
          {mode === 'local' && (
            <div className="field field--stack">
              <label className="field__label" htmlFor="p2">Second player’s name<span>You play as {me.name}.</span></label>
              <input id="p2" className="text-input" value={p2} maxLength={16} onChange={(e) => setP2(e.target.value)} />
            </div>
          )}
        </section>

        <button type="button" className="btn btn--primary btn--lg btn--block hc-home__go" onClick={start}>
          {mode === 'online' ? 'Go to online rooms' : 'Start match'}
        </button>
      </main>
    </div>
  );
}
