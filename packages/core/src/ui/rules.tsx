/** OUT-rule chooser with explanations, shared by both apps (styled per app). */
import { OUT_MODES, OUT_MODE_INFO, isOutUnder, type Gesture, type OutMode } from '@plyo/engine';
import { Glyph } from './primitives.tsx';

function Example({ batting, bowling, mode }: { batting: Gesture; bowling: Gesture; mode: OutMode }) {
  const out = isOutUnder(mode, batting, bowling);
  return (
    <span className="rule-ex">
      <span className="rule-ex__hand">
        <Glyph g={batting} /> <span className="code">{batting}</span>
      </span>
      <span className="rule-ex__vs">vs</span>
      <span className="rule-ex__hand">
        <Glyph g={bowling} /> <span className="code">{bowling}</span>
      </span>
      <span className={`rule-ex__verdict${out ? ' is-out' : ''}`}>{out ? 'Out' : 'Not out'}</span>
    </span>
  );
}

export function RuleModePicker({ value, onChange, disabled }: { value: OutMode; onChange?: (m: OutMode) => void; disabled?: boolean }) {
  return (
    <div className="rules-pick" role="radiogroup" aria-label="OUT rule">
      {OUT_MODES.map((m) => {
        const info = OUT_MODE_INFO[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            disabled={disabled}
            className="rule-opt"
            onClick={() => onChange?.(m)}
          >
            <span className="rule-opt__head">
              <span className="rule-opt__mark" aria-hidden />
              <strong>{info.name}</strong>
            </span>
            <span className="rule-opt__summary">{info.summary}</span>
            <span className="rule-opt__detail">{info.detail}</span>
            <Example batting="01111" bowling="11101" mode={m} />
            {m === 'count' && <Example batting="10000" bowling="01000" mode={m} />}
          </button>
        );
      })}
    </div>
  );
}
