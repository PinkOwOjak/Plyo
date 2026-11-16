import { useState } from 'react';
import { SKIN_TONES } from '@plyo/hand3d/skinTones';
import { Segmented, cleanName, profile, type StatMode } from '@plyo/core';

const MODE_LABEL: Record<StatMode, string> = { bot: 'Bot', local: 'Same screen', online: 'Online' };

export function ProfileScreen() {
  const p = profile.use();
  const [name, setName] = useState(p.name);
  const modes = Object.keys(MODE_LABEL) as StatMode[];
  const played = modes.reduce((n, m) => n + p.stats[m].played, 0);
  const won = modes.reduce((n, m) => n + p.stats[m].won, 0);

  return (
    <div className="profile">
      <header className="page-head">
        <h1>{p.name}</h1>
        <p className="dim">{played ? `${played} matches, ${won} won` : 'No matches yet'}</p>
      </header>
      <div className="profile__grid">
        <section>
          <h2>Player</h2>
          <label className="field field--stack">
            <span className="field__label">Name<small>On scoreboards and to online opponents.</small></span>
            <input
              className="input"
              value={name}
              maxLength={16}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const n = cleanName(name);
                setName(n);
                profile.set((x) => ({ ...x, name: n }));
              }}
            />
          </label>
          <div className="field">
            <span className="field__label">Hand colour</span>
            <div className="swatches" role="radiogroup" aria-label="Hand colour">
              {SKIN_TONES.map((c, i) => (
                <button key={c} type="button" role="radio" aria-checked={p.skin === i} aria-label={`Tone ${i + 1}`} className="swatch" style={{ background: c }} onClick={() => profile.set((x) => ({ ...x, skin: i }))} />
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label">Playing hand</span>
            <Segmented label="Playing hand" value={p.leftHanded ? 'left' : 'right'} options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]} onChange={(v) => profile.set((x) => ({ ...x, leftHanded: v === 'left' }))} />
          </div>
        </section>
        <section>
          <h2>Career</h2>
          <dl className="stats">
            <div><dt>Win rate</dt><dd>{played ? Math.round((won / played) * 100) : 0}%</dd></div>
            <div><dt>Best innings</dt><dd>{p.bestInnings}</dd></div>
            <div><dt>Runs</dt><dd>{p.totalRuns}</dd></div>
            <div><dt>Sixes</dt><dd>{p.sixes}</dd></div>
            <div><dt>Ducks</dt><dd>{p.ducks}</dd></div>
          </dl>
          <table className="scorecard scorecard--wide">
            <thead><tr><th scope="col">Mode</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">T</th></tr></thead>
            <tbody>
              {modes.map((m) => (
                <tr key={m}><td>{MODE_LABEL[m]}</td><td>{p.stats[m].played}</td><td>{p.stats[m].won}</td><td>{p.stats[m].lost}</td><td>{p.stats[m].tied}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="faint small">Same-screen results count from player one’s side. Stats stay on this device.</p>
        </section>
      </div>
    </div>
  );
}
