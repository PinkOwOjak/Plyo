import { useEffect, useRef, useState } from 'react';
import { toFingerStates, type Gesture } from '@plyo/engine';

/** Scoreboard digits that flip when they change. */
export function Digits({ value, min = 1, className = '' }: { value: number; min?: number; className?: string }) {
  const digits = String(value).padStart(min, ' ').split('');
  const prev = useRef(digits);
  const [keys, setKeys] = useState<number[]>(() => digits.map(() => 0));
  useEffect(() => {
    const changed = digits.map((d, i) => d !== prev.current[i]);
    if (changed.some(Boolean)) setKeys((k) => digits.map((_, i) => (changed[i] ? (k[i] ?? 0) + 1 : (k[i] ?? 0))));
    prev.current = digits;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span className={`digits ${className}`} aria-label={String(value)}>
      {digits.map((d, i) => (
        <span key={`${i}-${keys[i]}`} className={`digit${keys[i] ? ' digit--flip' : ''}`} aria-hidden>
          {d === ' ' ? ' ' : d}
        </span>
      ))}
    </span>
  );
}

/** Five bars, thumb first, for tables and examples. */
export function Glyph({ g }: { g: Gesture }) {
  return (
    <span className="glyph" role="img" aria-label={`Hand ${g}`}>
      {toFingerStates(g).map((on, i) => (
        <i key={i} className={on ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

/** Seconds remaining until an epoch-ms deadline, updated twice a second. */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}
