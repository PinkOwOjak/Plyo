import { useState } from 'react';
import { SKIN_TONES } from '../games/hand-cricket/hand/skinTones.ts';
import { cleanName, profile, type StatMode } from '../platform/profile.ts';
import { Segmented } from '../shell/Shell.tsx';

const MODE_LABEL: Record<StatMode, string> = { bot: 'vs Bot', local: 'Pass & play', online: 'Online' };

export function ProfileScreen() {
  const p = profile.use();
  const [name, setName] = useState(p.name);
  const total = (['bot', 'local', 'online'] as StatMode[]).reduce(
    (a, m) => ({ played: a.played + p.stats[m].played, won: a.won + p.stats[m].won }),
    { played: 0, won: 0 },
  );
  const winRate = total.played ? Math.round((total.won / total.played) * 100) : 0;

  return (
    <div className="page--narrow" style={{ margin: '0 auto' }}>
      <h1>Profile</h1>

      <section className="section" aria-labelledby="you">
        <h2 id="you">You</h2>
        <label className="field__label" htmlFor="name" style={{ display: 'block', marginBottom: '0.4rem' }}>
          Player name
          <span>Shown on the scoreboard and to online opponents.</span>
        </label>
        <input
          id="name"
          className="text-input"
          value={name}
          maxLength={16}
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const n = cleanName(name);
            setName(n);
            profile.set((x) => ({ ...x, name: n }));
          }}
        />
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <div className="field__label">
            Hand colour
            <span>Skin tone of your 3D hand.</span>
          </div>
          <div className="swatches" role="radiogroup" aria-label="Hand colour">
            {SKIN_TONES.map((c, i) => (
              <button
                key={c}
                type="button"
                className="swatch"
                role="radio"
                aria-checked={p.skin === i}
                aria-label={`Tone ${i + 1}`}
                style={{ background: c }}
                onClick={() => profile.set((x) => ({ ...x, skin: i }))}
              />
            ))}
          </div>
        </div>
        <div className="field">
          <div className="field__label">
            Playing hand
            <span>Which hand you play with.</span>
          </div>
          <Segmented
            label="Playing hand"
            value={p.leftHanded ? 'left' : 'right'}
            options={[{ value: 'right', label: 'Right' }, { value: 'left', label: 'Left' }]}
            onChange={(v) => profile.set((x) => ({ ...x, leftHanded: v === 'left' }))}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="career">
        <h2 id="career">Career</h2>
        <div className="stat-grid">
          <div className="stat"><strong>{total.played}</strong><span>Matches</span></div>
          <div className="stat"><strong>{winRate}%</strong><span>Win rate</span></div>
          <div className="stat"><strong>{p.bestInnings}</strong><span>Best innings</span></div>
          <div className="stat"><strong>{p.totalRuns}</strong><span>Career runs</span></div>
          <div className="stat"><strong>{p.sixes}</strong><span>Sixes</span></div>
          <div className="stat"><strong>{p.ducks}</strong><span>Ducks</span></div>
        </div>
        <table className="table" style={{ marginTop: '1rem' }}>
          <thead>
            <tr><th scope="col">Mode</th><th scope="col">Played</th><th scope="col">Won</th><th scope="col">Lost</th><th scope="col">Tied</th></tr>
          </thead>
          <tbody>
            {(Object.keys(MODE_LABEL) as StatMode[]).map((m) => (
              <tr key={m}>
                <td>{MODE_LABEL[m]}</td>
                <td>{p.stats[m].played}</td>
                <td>{p.stats[m].won}</td>
                <td>{p.stats[m].lost}</td>
                <td>{p.stats[m].tied}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: '0.88rem', marginTop: '0.6rem' }}>
          Pass & play results count from your side (player one). Stats are stored on this device only.
        </p>
      </section>
    </div>
  );
}
