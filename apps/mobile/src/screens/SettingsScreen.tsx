import { useState } from 'react';
import { Segmented, Switch, haptic, prefs, profile, sfx, type MotionPref } from '@plyo/core';
import { isNative } from '../native.ts';

export function SettingsScreen() {
  const p = prefs.use();
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => prefs.set((x) => ({ ...x, [k]: v }));
  return (
    <div>
      <header className="m-head"><h1>Settings</h1></header>
      <section className="m-section">
        <div className="m-row"><span>Sound</span><Switch label="Sound" checked={p.sound} onChange={(v) => { set('sound', v); if (v) setTimeout(sfx.tap, 30); }} /></div>
        <div className="m-row"><span>Haptics</span><Switch label="Haptics" checked={p.haptics} onChange={(v) => { set('haptics', v); if (v) setTimeout(() => haptic('success'), 30); }} /></div>
        <div className="m-row"><span>Motion</span><Segmented<MotionPref> label="Motion" value={p.motion} options={[{ value: 'system', label: 'Device' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Less' }]} onChange={(v) => set('motion', v)} /></div>
      </section>
      <section className="m-section">
        <h2 className="m-label">Online</h2>
        <label className="m-row m-row--stack">
          <span>Game server <small>{isNative ? 'Required in the app, e.g. wss://plyo.example.com/ws' : 'Empty uses this site’s server.'}</small></span>
          <input className="input" placeholder={isNative ? 'wss://…/ws' : 'Same as this site'} value={p.serverUrl} spellCheck={false} autoCapitalize="off" onChange={(e) => set('serverUrl', e.target.value.trim())} />
        </label>
      </section>
      <section className="m-section">
        <div className="m-row">
          <span>Reset all data</span>
          {confirm ? (
            <span className="row"><button className="btn btn--quiet" onClick={() => setConfirm(false)}>Keep</button><button className="btn btn--primary" onClick={() => { prefs.reset(); profile.reset(); setConfirm(false); }}>Reset</button></span>
          ) : (
            <button className="btn btn--line" onClick={() => setConfirm(true)}>Reset…</button>
          )}
        </div>
      </section>
    </div>
  );
}
