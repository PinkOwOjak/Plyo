import { useState } from 'react';
import { OVER_OPTIONS, type Difficulty } from '@plyo/engine';
import { Segmented, Switch, prefs, profile, sfx, type MotionPref } from '@plyo/core';

export function SettingsScreen() {
  const p = prefs.use();
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => prefs.set((x) => ({ ...x, [k]: v }));
  return (
    <div className="settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>
      <div className="settings__cols">
        <section>
          <h2>Sound and motion</h2>
          <div className="field">
            <span className="field__label">Sound effects</span>
            <Switch label="Sound effects" checked={p.sound} onChange={(v) => { set('sound', v); if (v) setTimeout(sfx.tap, 30); }} />
          </div>
          <label className="field">
            <span className="field__label">Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={p.volume} disabled={!p.sound} onChange={(e) => set('volume', Number(e.target.value))} onPointerUp={() => sfx.runs(3)} />
          </label>
          <div className="field">
            <span className="field__label">Vibration<small>Where the device supports it.</small></span>
            <Switch label="Vibration" checked={p.haptics} onChange={(v) => set('haptics', v)} />
          </div>
          <div className="field">
            <span className="field__label">Motion<small>Device follows your system setting.</small></span>
            <Segmented<MotionPref> label="Motion" value={p.motion} options={[{ value: 'system', label: 'Device' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Less' }]} onChange={(v) => set('motion', v)} />
          </div>
        </section>
        <section>
          <h2>Match defaults</h2>
          <div className="field">
            <span className="field__label">Overs</span>
            <Segmented label="Default overs" value={p.defaultOvers} options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))} onChange={(v) => set('defaultOvers', v)} />
          </div>
          <div className="field">
            <span className="field__label">Bot</span>
            <Segmented<Difficulty> label="Bot difficulty" value={p.difficulty} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} onChange={(v) => set('difficulty', v)} />
          </div>
          <label className="field field--stack">
            <span className="field__label">Game server<small>Empty uses this site’s server. Example: wss://plyo.example.com/ws</small></span>
            <input className="input" placeholder="Same as this site" value={p.serverUrl} spellCheck={false} onChange={(e) => set('serverUrl', e.target.value.trim())} />
          </label>
          <div className="field">
            <span className="field__label">Reset<small>Clears name, stats and settings on this device.</small></span>
            {confirm ? (
              <span className="row">
                <button className="btn btn--quiet" onClick={() => setConfirm(false)}>Keep</button>
                <button className="btn btn--primary" onClick={() => { prefs.reset(); profile.reset(); setConfirm(false); }}>Reset</button>
              </span>
            ) : (
              <button className="btn btn--line" onClick={() => setConfirm(true)}>Reset…</button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
