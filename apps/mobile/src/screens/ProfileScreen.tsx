import { useState } from 'react';
import { SKIN_TONES } from '@plyo/hand3d/skinTones';
import { Segmented, cleanName, profile, type StatMode } from '@plyo/core';

export function ProfileScreen() {
  const p = profile.use();
  const [name, setName] = useState(p.name);
  const modes: StatMode[] = ['bot', 'local', 'online'];
  const played = modes.reduce((n, m) => n + p.stats[m].played, 0);
  const won = modes.reduce((n, m) => n + p.stats[m].won, 0);
  return (
    <div>
      <header className="m-head"><h1>{p.name}</h1><span className="m-head__me">{played} played · {won} won</span></header>
      <dl className="m-stats">
        <div><dt>Best</dt><dd>{p.bestInnings}</dd></div>
        <div><dt>Runs</dt><dd>{p.totalRuns}</dd></div>
        <div><dt>Sixes</dt><dd>{p.sixes}</dd></div>
        <div><dt>Ducks</dt><dd>{p.ducks}</dd></div>
      </dl>
      <section className="m-section">
        <h2 className="m-label">Player</h2>
        <label className="m-row m-row--stack">
          <span>Name</span>
          <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} onBlur={() => { const n = cleanName(name); setName(n); profile.set((x) => ({ ...x, name: n })); }} />
        </label>
        <div className="m-row">
          <span>Hand colour</span>
          <div className="swatches" role="radiogroup" aria-label="Hand colour">
            {SKIN_TONES.map((c, i) => (
              <button key={c} type="button" role="radio" aria-checked={p.skin === i} aria-label={`Tone ${i + 1}`} className="swatch" style={{ background: c }} onClick={() => profile.set((x) => ({ ...x, skin: i }))} />
            ))}
          </div>
        </div>
        <div className="m-row">
          <span>Playing hand</span>
          <Segmented label="Playing hand" value={p.leftHanded ? 'left' : 'right'} options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]} onChange={(v) => profile.set((x) => ({ ...x, leftHanded: v === 'left' }))} />
        </div>
      </section>
      <section className="m-section">
        <h2 className="m-label">By mode</h2>
        <ul className="m-table">
          {modes.map((m) => (
            <li key={m}><span>{m === 'bot' ? 'Bot' : m === 'local' ? 'This phone' : 'Online'}</span><b>{p.stats[m].won}–{p.stats[m].lost}{p.stats[m].tied ? `–${p.stats[m].tied}` : ''}</b></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
