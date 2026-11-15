import { useRef, type ReactNode } from 'react';
import type { MatchSession } from '@plyo/core';
import { useArenaDirector, useHandStage } from '@plyo/core/arena';
import type { Gesture } from '@plyo/engine';

/** Portrait arena: 3D stage plus countdown and call overlays. */
export function Arena({ session, preview, children, flipCalls }: { session: MatchSession; preview: Gesture | null; children?: ReactNode; flipCalls?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const { stage, supported } = useHandStage(host, { preset: 'portrait', maxPixelRatio: 2 });
  const { count, banner, lastShown } = useArenaDirector(stage, session, preview);
  const { names, nearSide } = session;
  const far = nearSide === 0 ? 1 : 0;
  return (
    <div className="arena">
      <div ref={host} className="arena__stage" aria-hidden />
      {!supported && (
        <div className="arena__fallback">
          <p>3D isn’t available here.</p>
          {lastShown && <p className="code">{lastShown[nearSide]} v {lastShown[far]}</p>}
        </div>
      )}
      {children}
      {count !== null && <div className="countdown" key={count}>{count}</div>}
      {banner && (
        <div className={`call call--${banner.kind}`} role="status">
          <strong>{banner.big}</strong>
          <span>{banner.small}</span>
          {flipCalls && <strong className="call__mirror" aria-hidden>{banner.big}</strong>}
        </div>
      )}
      <span className="arena__tag arena__tag--far">{names[far]}</span>
      <span className="arena__tag arena__tag--near">{names[nearSide]}</span>
    </div>
  );
}
