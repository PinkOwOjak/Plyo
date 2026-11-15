/**
 * Synthesised sound effects (Web Audio, no asset downloads).
 * Every effect respects the sound and volume preferences.
 */
import { prefs } from './prefs.ts';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  const p = prefs.get();
  if (!p.sound) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  master!.gain.value = p.volume * 0.6;
  return { ctx, out: master! };
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.at ?? 0);
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { at?: number; gain?: number; freq?: number; q?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + (opts.at ?? 0);
  const buf = a.ctx.createBuffer(1, Math.ceil(a.ctx.sampleRate * dur), a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = opts.freq ?? 900;
  filter.Q.value = opts.q ?? 0.8;
  const g = a.ctx.createGain();
  g.gain.value = opts.gain ?? 0.4;
  src.connect(filter).connect(g).connect(a.out);
  src.start(t);
}

export const sfx = {
  tap: () => tone(660, 0.06, { type: 'triangle', gain: 0.12 }),
  toggle: (on: boolean) => tone(on ? 740 : 520, 0.07, { type: 'triangle', gain: 0.14 }),
  tick: () => tone(440, 0.09, { type: 'square', gain: 0.08 }),
  reveal: () => {
    tone(140, 0.22, { type: 'sine', gain: 0.55, slide: 60 });
    noise(0.12, { gain: 0.25, freq: 400 });
  },
  runs: (n: number) => {
    const base = 520;
    for (let i = 0; i < Math.min(n, 5); i++) tone(base * Math.pow(1.122, i * 2), 0.14, { type: 'triangle', gain: 0.16, at: i * 0.06 });
  },
  six: () => {
    noise(0.05, { gain: 0.5, freq: 2400, q: 2 });
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'triangle', gain: 0.2, at: 0.05 + i * 0.08 }));
    noise(1.1, { at: 0.1, gain: 0.18, freq: 1200, q: 0.4 });
  },
  dot: () => tone(300, 0.12, { type: 'sine', gain: 0.15 }),
  out: () => {
    noise(0.04, { gain: 0.6, freq: 3000, q: 3 });
    tone(220, 0.5, { type: 'sawtooth', gain: 0.14, slide: 110, at: 0.05 });
    noise(0.9, { at: 0.12, gain: 0.2, freq: 500, q: 0.5 });
  },
  win: () => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, { type: 'triangle', gain: 0.18, at: i * 0.11 })),
  lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.4, { type: 'sine', gain: 0.18, at: i * 0.16 })),
  coin: () => {
    for (let i = 0; i < 6; i++) tone(1800 + i * 120, 0.05, { type: 'square', gain: 0.04, at: i * 0.09 });
  },
};
