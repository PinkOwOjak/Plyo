import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { currentInnings, describeGesture, other, toggleFinger, type Finger, type Gesture, type Side } from '@plyo/engine';
import {
  IconBack,
  IconMute,
  IconSound,
  href,
  prefs,
  sessionOverlay,
  sfx,
  type MatchSession,
} from '@plyo/core';
import { useArenaDirector, useHandStage } from '@plyo/core/arena';
import { Picker } from './Picker.tsx';
import { ScoreBug } from './ScoreBug.tsx';

interface Props {
  session: MatchSession;
  title: string;
  exitHref: string;
  onExit?: () => void;
  arenaNote?: ReactNode;
  breakNote?: ReactNode;
}

/** Desktop match layout: arena left, broadcast sidebar right. */
export function MatchScreen({ session, title, exitHref, onExit, arenaNote, breakNote }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const { stage, supported } = useHandStage(host, { preset: 'wide' });
  const [sel, setSel] = useState<Record<Side, Gesture>>({ 0: '01000', 1: '01000' });
  const p = prefs.use();
  const { state, names, nearSide, pickers } = session;
  const picker: Side | null = pickers[0] ?? null;
  const value = picker !== null ? sel[picker] : sel[nearSide];
  const preview = session.hidePreview ? null : value;
  const { count, banner, revealing, lastShown } = useArenaDirector(stage, session, preview);
  const cur = currentInnings(state);
  const roleSide = picker ?? nearSide;
  const role: 'bat' | 'bowl' = cur?.battingSide === roleSide ? 'bat' : 'bowl';

  const setValue = useCallback((g: Gesture) => picker !== null && setSel((s) => ({ ...s, [picker]: g })), [picker]);
  const submit = useCallback(() => {
    if (picker === null || revealing) return;
    sfx.tap();
    session.submit(picker, sel[picker]);
  }, [picker, revealing, session, sel]);

  // Tap a finger on your own 3D hand to toggle it.
  useEffect(() => {
    if (!stage) return;
    stage.onFingerTap = (f: Finger) => {
      if (picker !== nearSide || session.hidePreview) return;
      const next = toggleFinger(sel[nearSide], f);
      sfx.toggle(true);
      setValue(next);
    };
  }, [stage, picker, nearSide, session.hidePreview, sel, setValue]);

  const exit = onExit ? (
    <button className="btn btn--line btn--lg" onClick={onExit}>Leave</button>
  ) : (
    <a className="btn btn--line btn--lg" href={href(exitHref)}>Leave</a>
  );
  const overlay = sessionOverlay(session, exit, { breakNote });
  const far = other(nearSide);
  const prompt = revealing
    ? 'Hands on the pitch'
    : picker !== null
      ? `${session.hidePreview ? `${names[picker]}, choose in secret. ` : ''}${role === 'bat' ? 'Batting: stay clear of the bowler’s hand.' : 'Bowling: match the batter to take the wicket.'}`
      : session.status;

  return (
    <div className="match">
      <header className="match__bar">
        {onExit ? (
          <button className="icon-btn" type="button" aria-label="Leave match" onClick={onExit}><IconBack /></button>
        ) : (
          <a className="icon-btn" href={href(exitHref)} aria-label="Leave match"><IconBack /></a>
        )}
        <h1 className="match__title">{title}</h1>
        <button
          className="icon-btn"
          type="button"
          aria-pressed={!p.sound}
          aria-label={p.sound ? 'Mute sound' : 'Turn sound on'}
          onClick={() => prefs.set((x) => ({ ...x, sound: !x.sound }))}
        >
          {p.sound ? <IconSound /> : <IconMute />}
        </button>
      </header>

      <div className="match__body">
        <div className="arena">
          <div ref={host} className="arena__stage" aria-hidden />
          {!supported && (
            <div className="arena__fallback">
              <p>3D isn’t available on this device. Hands are shown as codes.</p>
              {lastShown && (
                <p className="code">
                  {names[nearSide]} {lastShown[nearSide]} · {names[far]} {lastShown[far]}
                </p>
              )}
            </div>
          )}
          <span className="arena__tag arena__tag--far">{names[far]}</span>
          <span className="arena__tag arena__tag--near">{names[nearSide]}</span>
          {arenaNote}
          {count !== null && <div className="countdown" key={count}>{count}</div>}
          {banner && (
            <div className={`call call--${banner.kind}`} role="status">
              <strong>{banner.big}</strong>
              <span>{banner.small}</span>
            </div>
          )}
          {lastShown && !revealing && !banner && (
            <p className="arena__last">
              Last ball: {describeGesture(lastShown[cur?.battingSide ?? 0])} vs {describeGesture(lastShown[other(cur?.battingSide ?? 0)])}
            </p>
          )}
        </div>

        <aside className="side">
          <ScoreBug state={state} names={names} nearSide={nearSide} />
          <div className="side__controls">
            <p className="side__prompt" aria-live="polite">{prompt}</p>
            <Picker
              value={value}
              onChange={setValue}
              onSubmit={submit}
              role={role}
              active={picker !== null && !revealing}
              submitLabel={picker === null || revealing ? 'Waiting' : session.hidePreview ? `Lock in for ${names[picker]}` : role === 'bat' ? 'Play shot' : 'Bowl'}
            />
          </div>
        </aside>
      </div>
      {overlay && <div className="overlay">{overlay}</div>}
    </div>
  );
}
