import { useState } from 'react';
import { OVER_OPTIONS } from '../games/hand-cricket/engine/match.ts';
import { prefs, type MotionPref } from '../platform/prefs.ts';
import { profile } from '../platform/profile.ts';
import { sfx } from '../platform/sound.ts';
import { Segmented, Switch } from '../shell/Shell.tsx';
import type { Difficulty } from '../games/hand-cricket/engine/ai.ts';

export function SettingsScreen() {
  const p = prefs.use();
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => prefs.set((x) => ({ ...x, [k]: v }));

  return (
    <div className="page--narrow" style={{ margin: '0 auto' }}>
      <h1>Settings</h1>

      <section className="section" aria-labelledby="s-sound">
        <h2 id="s-sound">Sound and feel</h2>
        <div className="field">
          <div className="field__label">Sound effects<span>Countdown, reveals, runs and wickets.</span></div>
          <Switch label="Sound effects" checked={p.sound} onChange={(v) => { set('sound', v); if (v) setTimeout(sfx.tap, 30); }} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="vol">Volume</label>
          <input
            id="vol"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.volume}
            disabled={!p.sound}
            onChange={(e) => set('volume', Number(e.target.value))}
            onPointerUp={() => sfx.runs(3)}
            style={{ width: '45%', accentColor: '#c83a2c' }}
          />
        </div>
        <div className="field">
          <div className="field__label">Vibration<span>Short buzzes on wickets and sixes, where supported.</span></div>
          <Switch label="Vibration" checked={p.haptics} onChange={(v) => set('haptics', v)} />
        </div>
        <div className="field">
          <div className="field__label">Motion<span>“Device” follows your system setting.</span></div>
          <Segmented<MotionPref>
            label="Motion"
            value={p.motion}
            options={[{ value: 'system', label: 'Device' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Less' }]}
            onChange={(v) => set('motion', v)}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="s-game">
        <h2 id="s-game">Hand Cricket</h2>
        <div className="field">
          <div className="field__label">Default overs</div>
          <Segmented
            label="Default overs"
            value={p.defaultOvers}
            options={OVER_OPTIONS.map((o) => ({ value: o, label: String(o) }))}
            onChange={(v) => set('defaultOvers', v)}
          />
        </div>
        <div className="field">
          <div className="field__label">Bot difficulty<span>Harder bots learn your habits faster.</span></div>
          <Segmented<Difficulty>
            label="Bot difficulty"
            value={p.difficulty}
            options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]}
            onChange={(v) => set('difficulty', v)}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="s-online">
        <h2 id="s-online">Online</h2>
        <label className="field__label" htmlFor="server" style={{ display: 'block', marginBottom: '0.4rem' }}>
          Game server address
          <span>Leave empty to use the server this app is hosted on. Example: wss://plyo.example.com/ws</span>
        </label>
        <input
          id="server"
          className="text-input"
          placeholder="Same as this site"
          value={p.serverUrl}
          spellCheck={false}
          onChange={(e) => set('serverUrl', e.target.value.trim())}
        />
      </section>

      <section className="section" aria-labelledby="s-data">
        <h2 id="s-data">Data</h2>
        <div className="field">
          <div className="field__label">Reset everything<span>Clears your name, stats and settings on this device.</span></div>
          {confirmReset ? (
            <span style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn--ghost" type="button" onClick={() => setConfirmReset(false)}>Keep</button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => { prefs.reset(); profile.reset(); setConfirmReset(false); }}
              >
                Reset
              </button>
            </span>
          ) : (
            <button className="btn btn--ghost" type="button" onClick={() => setConfirmReset(true)}>Reset…</button>
          )}
        </div>
      </section>
    </div>
  );
}
