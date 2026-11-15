// Dev-only: renders key art from the game's own 3D hand on a transparent background.
// /keyart.html?shot=six | duel
import { HandStage } from '@plyo/hand3d';

const shot = new URLSearchParams(location.search).get('shot') ?? 'six';
const stage = new HandStage(document.getElementById('s')!, { preset: 'wide', maxPixelRatio: 2 });
await stage.ready;
stage.setGroundVisible(false);
stage.player!.setMotion('still');
stage.opponent!.setMotion('still');
if (shot === 'six') {
  stage.player!.root.visible = false;
  stage.opponent!.setGesture('10000', { instant: true });
  stage.setView([1.9, 1.75, 1.2], [-0.15, 1.1, -1.75], 30);
} else {
  stage.player!.setGesture('01111', { instant: true });
  stage.opponent!.setGesture('10000', { instant: true });
  stage.setView([6.4, 2.6, 0.6], [0, 0.85, 0], 32);
}
for (let i = 0; i < 30; i++) {
  stage.player!.update(0.05);
  stage.opponent!.update(0.05);
}
document.body.dataset.ready = '1';
