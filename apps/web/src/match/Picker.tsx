import { useEffect } from 'react';
import { FINGERS, FINGER_LABELS, describeGesture, runsFor, toFingerStates, toggleFinger, type Gesture } from '@plyo/engine';
import { sfx } from '@plyo/core';

interface Props {
  value: Gesture;
  onChange: (g: Gesture) => void;
  onSubmit: () => void;
  role: 'bat' | 'bowl';
  active: boolean;
  submitLabel: string;
}

/** Desktop picker: five keycaps (keys 1–5, thumb first) and a play button (Enter). */
export function Picker({ value, onChange, onSubmit, role, active, submitLabel }: Props) {
  const states = toFingerStates(value);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        const next = toggleFinger(value, FINGERS[n - 1]);
        sfx.toggle(next[n - 1] === '1');
        onChange(next);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, value, onChange, onSubmit]);

  const runs = runsFor(value);
  return (
    <div className={`picker${active ? '' : ' is-idle'}`}>
      <div className="picker__keys" role="group" aria-label="Fingers (keys 1 to 5)">
        {FINGERS.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`key key--${f}`}
            aria-pressed={states[i]}
            disabled={!active}
            onClick={() => {
              const next = toggleFinger(value, f);
              sfx.toggle(next[i] === '1');
              onChange(next);
            }}
          >
            <span className="key__bar" aria-hidden />
            <span className="key__name">{FINGER_LABELS[f]}</span>
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </div>
      <div className="picker__readout">
        <span className="code picker__code">{value}</span>
        <span className="picker__desc">
          {describeGesture(value)}
          <small>{role === 'bat' ? (runs === 6 ? 'Six if not out' : `${runs} run${runs === 1 ? '' : 's'} if not out`) : 'Out if it matches under the rule'}</small>
        </span>
      </div>
      <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onSubmit} disabled={!active}>
        {submitLabel}
        {active && <kbd className="kbd-hint">Enter</kbd>}
      </button>
    </div>
  );
}
