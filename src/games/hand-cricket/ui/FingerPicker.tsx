import { useEffect } from 'react';
import { FINGERS, FINGER_LABELS, runsFor, toFingerStates, toggleFinger, describeGesture, type Gesture } from '../engine/gestures.ts';
import { sfx } from '../../../platform/sound.ts';

interface Props {
  value: Gesture;
  onChange: (g: Gesture) => void;
  onSubmit: () => void;
  role: 'bat' | 'bowl';
  disabled?: boolean;
  submitLabel?: string;
}

/** Five finger toggles laid out like a hand, plus the play button. Keys 1–5 toggle, Enter plays. */
export function FingerPicker({ value, onChange, onSubmit, role, disabled, submitLabel }: Props) {
  const states = toFingerStates(value);
  const runs = runsFor(value);

  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 5) {
        e.preventDefault();
        const f = FINGERS[n - 1];
        const next = toggleFinger(value, f);
        sfx.toggle(next[n - 1] === '1');
        onChange(next);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, onSubmit, disabled]);

  return (
    <div className={`picker${disabled ? ' picker--disabled' : ''}`}>
      <div className="picker__hand" role="group" aria-label="Fingers: tap to raise or fold">
        {FINGERS.map((f, i) => (
          <button
            key={f}
            type="button"
            className={`finger finger--${f}`}
            aria-pressed={states[i]}
            disabled={disabled}
            onClick={() => {
              const next = toggleFinger(value, f);
              sfx.toggle(next[i] === '1');
              onChange(next);
            }}
          >
            <span className="finger__pill" aria-hidden />
            <span className="finger__name">{FINGER_LABELS[f]}</span>
            <span className="visually-hidden">{states[i] ? 'raised' : 'folded'}, key {i + 1}</span>
          </button>
        ))}
      </div>
      <div className="picker__readout">
        <div className="picker__code" aria-label={`Hand code ${value}`}>
          {value.split('').map((b, i) => (
            <span key={i} className={`bit${b === '1' ? ' bit--on' : ''}`}>{b}</span>
          ))}
        </div>
        <p className="picker__desc">
          {describeGesture(value)}
          <span>
            {role === 'bat'
              ? runs === 6
                ? ' · six if not matched'
                : ` · ${runs} run${runs === 1 ? '' : 's'} if not matched`
              : ' · out if it matches exactly'}
          </span>
        </p>
        <button type="button" className="btn btn--primary btn--lg picker__go" onClick={onSubmit} disabled={disabled}>
          {submitLabel ?? (role === 'bat' ? 'Play shot' : 'Bowl')}
        </button>
      </div>
    </div>
  );
}
