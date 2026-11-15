import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Finger } from '../engine/gestures.ts';
import { SKIN_TONES } from '../hand/HandModel.ts';
import { HandStage, webglAvailable } from '../hand/HandStage.ts';
import { profile } from '../../../platform/profile.ts';

interface Props {
  onReady: (stage: HandStage | null) => void;
  onFingerTap?: (finger: Finger) => void;
  interactive: boolean;
  opponentSkin?: number;
  children?: ReactNode;
  fallback?: ReactNode;
}

/** Hosts the Three.js stage and overlays (names, countdown, result banners). */
export function HandArena({ onReady, onFingerTap, interactive, opponentSkin = 3, children, fallback }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HandStage | null>(null);
  const [supported] = useState(() => webglAvailable());
  const p = profile.use();
  const tapRef = useRef(onFingerTap);
  const readyRef = useRef(onReady);

  useEffect(() => {
    tapRef.current = onFingerTap;
    readyRef.current = onReady;
  });

  useEffect(() => {
    if (!supported || !host.current) return;
    const stage = new HandStage(host.current, {
      playerSkin: SKIN_TONES[p.skin] ?? SKIN_TONES[1],
      opponentSkin: SKIN_TONES[opponentSkin] ?? SKIN_TONES[3],
      leftHanded: p.leftHanded,
    });
    stage.onFingerTap = (f) => tapRef.current?.(f);
    stageRef.current = stage;
    if (import.meta.env.DEV) (window as unknown as { __plyoStage?: HandStage }).__plyoStage = stage;
    readyRef.current(stage);
    return () => {
      readyRef.current(null);
      stage.dispose();
      stageRef.current = null;
    };
    // Rebuild only when the look of the hands changes.
  }, [supported, p.skin, p.leftHanded, opponentSkin]);

  useEffect(() => {
    stageRef.current?.setInteractive(interactive);
  }, [interactive]);

  return (
    <div className="arena">
      <div ref={host} className="arena__stage" aria-hidden />
      {!supported && (
        <div className="arena__fallback" role="note">
          <p>This device can’t show the 3D hands (WebGL is unavailable). You can still play: the finger readouts below show every hand.</p>
          {fallback}
        </div>
      )}
      {children}
    </div>
  );
}
