import { FINGERS, FINGER_LABELS, toFingerStates, toggleFinger, type Gesture } from '@plyo/engine';
import { haptic, sfx } from '@plyo/core';

/** Five large finger pads arranged like a hand (thumb low on the left). */
export function Pads({ value, onChange, active }: { value: Gesture; onChange: (g: Gesture) => void; active: boolean }) {
  const states = toFingerStates(value);
  return (
    <div className={`pads${active ? '' : ' is-idle'}`} role="group" aria-label="Fingers">
      {FINGERS.map((f, i) => (
        <button
          key={f}
          type="button"
          className={`pad pad--${f}`}
          aria-pressed={states[i]}
          aria-label={`${FINGER_LABELS[f]} ${states[i] ? 'raised' : 'folded'}`}
          disabled={!active}
          onPointerDown={(e) => {
            // Respond on touch-down for a snappier feel; ignore the follow-up click.
            e.preventDefault();
            if (!active) return;
            const next = toggleFinger(value, f);
            haptic('select');
            sfx.toggle(next[i] === '1');
            onChange(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange(toggleFinger(value, f));
            }
          }}
        >
          <span className="pad__fill" aria-hidden />
          <span className="pad__name">{FINGER_LABELS[f]}</span>
        </button>
      ))}
    </div>
  );
}
