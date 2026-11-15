import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FIST, describeGesture, toggleFinger, type Finger, type Gesture } from '../engine/gestures.ts';
import { currentInnings, other, type MatchState, type Side } from '../engine/match.ts';
import type { HandStage } from '../hand/HandStage.ts';
import { prefersReducedMotion, prefs, vibrate } from '../../../platform/prefs.ts';
import { href } from '../../../platform/router.ts';
import { sfx } from '../../../platform/sound.ts';
import { IconBack, IconHelp, IconMute, IconSound } from '../../../shell/icons.tsx';
import { FingerPicker } from './FingerPicker.tsx';
import { HandArena } from './HandArena.tsx';
import { Scoreboard } from './Scoreboard.tsx';

export interface Reveal {
  id: number;
  /** Gestures indexed by side. */
  gestures: [Gesture, Gesture];
  /** Match state after this ball. */
  after: MatchState;
}

export interface PickerSpec {
  side: Side;
  /** Hide the live preview on the 3D hand (pass & play). */
  hidden: boolean;
}

interface Props {
  title: string;
  backHref: string;
  state: MatchState;
  names: [string, string];
  nearSide: Side;
  picker: PickerSpec | null;
  waiting?: ReactNode;
  onSubmit: (g: Gesture) => void;
  reveal: Reveal | null;
  onRevealDone: (id: number) => void;
  overlay?: ReactNode;
  opponentSkin?: number;
  /** Extra overlay inside the 3D arena (e.g. online opponent status). */
  arenaExtra?: ReactNode;
  /** Called instead of plain navigation when leaving (online uses it to leave the room). */
  onBack?: () => void;
}

type Banner = { kind: 'runs' | 'six' | 'out' | 'dot'; big: string; small: string } | null;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function MatchView(props: Props) {
  const { state, names, nearSide, picker, reveal, onRevealDone, onSubmit } = props;
  const [stage, setStage] = useState<HandStage | null>(null);
  const [selection, setSelection] = useState<Record<Side, Gesture>>({ 0: '01000', 1: '01000' });
  const [count, setCount] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [revealing, setRevealing] = useState(false);
  const [lastShown, setLastShown] = useState<[Gesture, Gesture] | null>(null);
  const p = prefs.use();
  const doneRef = useRef(onRevealDone);
  useEffect(() => {
    doneRef.current = onRevealDone;
  });

  const pickSide = picker?.side ?? null;
  const pickValue = pickSide !== null ? selection[pickSide] : selection[nearSide];
  const cur = currentInnings(state);
  const roleSide = pickSide ?? nearSide;
  const role: 'bat' | 'bowl' = cur?.battingSide === roleSide ? 'bat' : 'bowl';
  const nearPreview = !!picker && !picker.hidden && picker.side === nearSide && !revealing;

  // Idle presentation between balls: preview your own hand, opponent holds a fist.
  useEffect(() => {
    if (!stage || revealing || reveal) return;
    if (nearPreview) {
      stage.player.setGesture(pickValue, { stagger: true });
      stage.player.setMotion('idle');
      stage.opponent.setGesture(FIST, { stagger: true });
      stage.opponent.setMotion('idle');
    } else if (picker) {
      stage.player.setGesture(FIST, { stagger: true });
      stage.opponent.setGesture(FIST, { stagger: true });
      stage.player.setMotion('idle');
      stage.opponent.setMotion('idle');
    }
  }, [stage, nearPreview, pickValue, picker, revealing, reveal]);

  // The reveal sequence: pump fists three times, then show both hands at once.
  useEffect(() => {
    if (!reveal) return;
    let cancelled = false;
    const reduced = prefersReducedMotion();
    const beat = reduced ? 140 : 420;
    const run = async () => {
      setRevealing(true);
      setBanner(null);
      if (stage) {
        stage.player.setGesture(FIST, { stagger: true });
        stage.opponent.setGesture(FIST, { stagger: true });
        if (!reduced) {
          stage.player.setMotion('pump', beat / 1000);
          stage.opponent.setMotion('pump', beat / 1000);
        }
      }
      for (const n of [3, 2, 1]) {
        if (cancelled) return;
        setCount(n);
        sfx.tick();
        await wait(beat);
      }
      if (cancelled) return;
      setCount(null);
      const near = reveal.gestures[nearSide];
      const far = reveal.gestures[other(nearSide)];
      setLastShown(reveal.gestures);
      if (stage) {
        stage.player.setMotion('still');
        stage.opponent.setMotion('still');
        stage.player.setGesture(near, { stagger: true });
        stage.opponent.setGesture(far, { stagger: true });
        stage.player.impact();
        stage.opponent.impact();
      }
      sfx.reveal();
      await wait(reduced ? 250 : 750);
      if (cancelled) return;

      const inn = currentInnings(reveal.after)!;
      const ball = inn.balls[inn.balls.length - 1];
      const batterName = names[inn.battingSide];
      if (ball.out) {
        setBanner({ kind: 'out', big: 'Out', small: `Exact same hand: ${ball.batting}. ${batterName} is out.` });
        sfx.out();
        vibrate([60, 40, 120]);
        if (stage) (inn.battingSide === nearSide ? stage.player : stage.opponent).recoil();
      } else if (ball.runs === 6) {
        setBanner({ kind: 'six', big: 'Six', small: `Thumb only beats ${ball.bowling}` });
        sfx.six();
        vibrate(40);
      } else if (ball.runs === 0) {
        setBanner({ kind: 'dot', big: '0', small: `Closed fist · different from ${ball.bowling}` });
        sfx.dot();
      } else {
        setBanner({
          kind: 'runs',
          big: `+${ball.runs}`,
          small: `${ball.batting} vs ${ball.bowling} · not the same hand`,
        });
        sfx.runs(ball.runs);
      }
      await wait(reduced ? 900 : 1300);
      if (cancelled) return;
      setBanner(null);
      setRevealing(false);
      doneRef.current(reveal.id);
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Each reveal id runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.id]);

  const setPick = useCallback(
    (g: Gesture) => {
      if (pickSide === null) return;
      setSelection((s) => ({ ...s, [pickSide]: g }));
    },
    [pickSide],
  );

  const submit = useCallback(() => {
    if (pickSide === null || revealing) return;
    sfx.tap();
    onSubmit(selection[pickSide]);
  }, [pickSide, revealing, onSubmit, selection]);

  const onFingerTap = useCallback(
    (f: Finger) => {
      if (pickSide === null || !nearPreview) return;
      const next = toggleFinger(selection[pickSide], f);
      sfx.toggle(next !== selection[pickSide]);
      setPick(next);
    },
    [pickSide, nearPreview, selection, setPick],
  );

  const farSide = other(nearSide);
  const pickerName = pickSide !== null ? names[pickSide] : '';

  return (
    <div className="match">
      <header className="topbar match__top">
        {props.onBack ? (
          <button className="icon-btn" type="button" aria-label="Leave match" onClick={props.onBack}>
            <IconBack />
          </button>
        ) : (
          <a className="icon-btn" href={href(props.backHref)} aria-label="Leave match">
            <IconBack />
          </a>
        )}
        <h1 className="topbar__title">{props.title}</h1>
        <a className="icon-btn" href={href('/hand-cricket/rules')} aria-label="Rules">
          <IconHelp />
        </a>
        <button
          className="icon-btn"
          type="button"
          aria-label={p.sound ? 'Mute sound' : 'Turn sound on'}
          aria-pressed={!p.sound}
          onClick={() => prefs.set((x) => ({ ...x, sound: !x.sound }))}
        >
          {p.sound ? <IconSound /> : <IconMute />}
        </button>
      </header>

      <div className="match__grid">
        <div className="match__score">
          <Scoreboard state={state} names={names} nearSide={nearSide} />
        </div>

        <div className="match__arena">
          <HandArena
            onReady={setStage}
            onFingerTap={onFingerTap}
            interactive={nearPreview}
            opponentSkin={props.opponentSkin}
            fallback={
              lastShown && (
                <p className="arena__readout">
                  {names[nearSide]}: {lastShown[nearSide]} ({describeGesture(lastShown[nearSide])}) · {names[farSide]}:{' '}
                  {lastShown[farSide]} ({describeGesture(lastShown[farSide])})
                </p>
              )
            }
          >
            <span className="tag tag--far">{names[farSide]}</span>
            <span className="tag tag--near">{names[nearSide]}</span>
            {count !== null && (
              <div className="countdown" key={count} aria-live="assertive">
                {count}
              </div>
            )}
            {banner && (
              <div className={`banner banner--${banner.kind}`} role="status">
                <strong>{banner.big}</strong>
                <span>{banner.small}</span>
              </div>
            )}
            {props.arenaExtra}
            {nearPreview && !banner && <p className="arena__hint">Tap a finger to raise or fold it</p>}
          </HandArena>
        </div>

        <div className="match__controls">
          <p className="controls__prompt" aria-live="polite">
            {revealing
              ? 'Hands on the pitch…'
              : picker
                ? `${picker.hidden ? `${pickerName}, choose in secret. ` : ''}${
                    role === 'bat' ? 'You’re batting: avoid the bowler’s exact hand.' : 'You’re bowling: copy the batter’s exact hand to get them out.'
                  }`
                : props.waiting ?? ''}
          </p>
          <FingerPicker
            value={pickValue}
            onChange={setPick}
            onSubmit={submit}
            role={role}
            disabled={!picker || revealing}
            submitLabel={!picker || revealing ? 'Waiting…' : picker.hidden ? `Lock in for ${pickerName}` : undefined}
          />
        </div>
      </div>

      {props.overlay && <div className="overlay">{props.overlay}</div>}
    </div>
  );
}
