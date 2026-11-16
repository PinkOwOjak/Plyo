/**
 * React glue for the 3D arena, shared by both apps: creates the HandStage and
 * directs it — live previews while choosing, the fist-pump countdown, the
 * simultaneous reveal, and run/six/out feedback.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { FIST, currentInnings, other, outReason, type Gesture, type Side } from '@plyo/engine';
import { HandStage, SKIN_TONES, webglAvailable, type CameraPreset } from '@plyo/hand3d';
import { haptic, prefersReducedMotion } from './prefs.ts';
import { profile } from './profile.ts';
import { sfx } from './sound.ts';
import type { MatchSession } from './session.ts';

export interface StageOptions {
  preset: CameraPreset;
  opponentSkin?: number;
  maxPixelRatio?: number;
  sleeves?: [string, string];
}

/** Creates the stage inside `host` and returns it once both hands are loaded. */
export function useHandStage(host: RefObject<HTMLDivElement | null>, opts: StageOptions) {
  const [stage, setStage] = useState<HandStage | null>(null);
  const [supported] = useState(() => (typeof document === 'undefined' ? false : webglAvailable()));
  const p = profile.use();
  const { preset, opponentSkin = 3, maxPixelRatio, sleeves } = opts;
  const sleeveKey = sleeves?.join(',');

  useEffect(() => {
    if (!supported || !host.current) return;
    let alive = true;
    const s = new HandStage(host.current, {
      preset,
      playerSkin: SKIN_TONES[p.skin] ?? SKIN_TONES[1],
      opponentSkin: SKIN_TONES[opponentSkin] ?? SKIN_TONES[3],
      leftHanded: p.leftHanded,
      maxPixelRatio,
      sleeves: sleeveKey ? (sleeveKey.split(',') as [string, string]) : undefined,
    });
    void s.ready.then(() => alive && setStage(s));
    if (import.meta.env?.DEV) (window as unknown as { __plyoStage?: HandStage }).__plyoStage = s;
    return () => {
      alive = false;
      setStage(null);
      s.dispose();
    };
  }, [supported, host, preset, p.skin, p.leftHanded, opponentSkin, maxPixelRatio, sleeveKey]);

  return { stage, supported };
}

export interface Banner {
  kind: 'runs' | 'six' | 'out' | 'dot';
  big: string;
  small: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drives the hands for a session. `preview` is the near player's current
 * selection, shown live on their hand when the session allows it.
 */
export function useArenaDirector(stage: HandStage | null, session: MatchSession, preview: Gesture | null) {
  const [count, setCount] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [lastShown, setLastShown] = useState<[Gesture, Gesture] | null>(null);
  const doneRef = useRef(session.revealDone);
  useEffect(() => {
    doneRef.current = session.revealDone;
  });
  const { reveal, nearSide, names, kind } = session;
  const nearPicking = session.pickers.includes(nearSide) && !session.hidePreview;
  const choosing = session.pickers.length > 0 || session.drawDeadline !== null;

  // Between balls: preview your own hand while choosing; opponent holds a fist.
  useEffect(() => {
    if (!stage?.player || !stage.opponent || revealing || reveal) return;
    if (nearPicking && preview) {
      stage.player.setGesture(preview, { stagger: true });
    } else if (choosing) {
      stage.player.setGesture(FIST, { stagger: true });
    } else {
      return;
    }
    stage.opponent.setGesture(FIST, { stagger: true });
    const pump = session.drawDeadline !== null && !prefersReducedMotion();
    stage.player.setMotion(pump ? 'pump' : 'idle', 0.5);
    stage.opponent.setMotion(pump ? 'pump' : 'idle', 0.5);
  }, [stage, nearPicking, preview, choosing, revealing, reveal, session.drawDeadline]);

  useEffect(() => {
    stage?.setInteractive(nearPicking && !revealing);
  }, [stage, nearPicking, revealing]);

  // The reveal: three fist pumps, then both hands at once.
  useEffect(() => {
    if (!reveal) return;
    let cancelled = false;
    const reduced = prefersReducedMotion();
    const beat = reduced ? 140 : 420;
    const run = async () => {
      setRevealing(true);
      setBanner(null);
      const pl = stage?.player;
      const op = stage?.opponent;
      if (kind !== 'duel') {
        pl?.setGesture(FIST, { stagger: true });
        op?.setGesture(FIST, { stagger: true });
        if (!reduced) {
          pl?.setMotion('pump', beat / 1000);
          op?.setMotion('pump', beat / 1000);
        }
        for (const n of [3, 2, 1]) {
          if (cancelled) return;
          setCount(n);
          sfx.tick();
          await wait(beat);
        }
      }
      if (cancelled) return;
      setCount(null);
      setLastShown(reveal.gestures);
      pl?.setMotion('still');
      op?.setMotion('still');
      pl?.setGesture(reveal.gestures[nearSide], { stagger: true });
      op?.setGesture(reveal.gestures[other(nearSide)], { stagger: true });
      pl?.impact();
      op?.impact();
      sfx.reveal();
      haptic('heavy');
      await wait(reduced ? 250 : 750);
      if (cancelled) return;

      const inn = currentInnings(reveal.after)!;
      const ball = inn.balls[inn.balls.length - 1];
      const batter = names[inn.battingSide];
      if (ball.out) {
        setBanner({ kind: 'out', big: 'Out', small: `${outReason(reveal.after.config.outMode, ball.batting)}. ${batter} is out.` });
        sfx.out();
        haptic('warning');
        (inn.battingSide === nearSide ? pl : op)?.recoil();
      } else if (ball.runs === 6) {
        setBanner({ kind: 'six', big: 'Six', small: `Thumb up from ${batter}` });
        sfx.six();
        haptic('success');
      } else if (ball.runs === 0) {
        setBanner({ kind: 'dot', big: '0', small: 'Closed fist, no run' });
        sfx.dot();
      } else {
        setBanner({ kind: 'runs', big: `+${ball.runs}`, small: `${batter} scores ${ball.runs}` });
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
    // Each reveal id runs exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal?.id]);

  return { count, banner, revealing, lastShown };
}

export function sideOtherThan(s: Side): Side {
  return other(s);
}
