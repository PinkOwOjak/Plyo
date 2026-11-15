// Dev-only harness: /dev/lab.html?p=01111&o=11101
import { HandStage } from '../src/games/hand-cricket/hand/HandStage.ts';
import { isGesture } from '../src/games/hand-cricket/engine/gestures.ts';
const q = new URLSearchParams(location.search);
const stage = new HandStage(document.getElementById('s')!);
const p = q.get('p'); const o = q.get('o');
if (isGesture(p)) stage.player.setGesture(p, { instant: true });
if (isGesture(o)) stage.opponent.setGesture(o, { instant: true });
stage.player.setMotion('still'); stage.opponent.setMotion('still');
(window as unknown as { stage: HandStage }).stage = stage;
