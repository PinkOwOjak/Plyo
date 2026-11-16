// Dev-only hand lab: /lab.html?p=01111&o=11101&preset=portrait
import { HandStage } from '@plyo/hand3d';
import { isGesture } from '@plyo/engine';

const q = new URLSearchParams(location.search);
const preset = q.get('preset') === 'portrait' ? 'portrait' : 'wide';
const stage = new HandStage(document.getElementById('s')!, { preset });
(window as unknown as { stage: HandStage }).stage = stage;
await stage.ready;
const p = q.get('p');
const o = q.get('o');
stage.player!.setMotion('still');
stage.opponent!.setMotion('still');
if (isGesture(p)) stage.player!.setGesture(p, { instant: true });
if (isGesture(o)) stage.opponent!.setGesture(o, { instant: true });
document.body.dataset.ready = '1';

if (q.get('probe')) {
  const THREE = await import('three');
  const rig = stage.player! as unknown as { root: import('three').Group };
  rig.root.updateMatrixWorld(true);
  let mesh: import('three').SkinnedMesh | null = null;
  rig.root.traverse((o) => { if ((o as import('three').SkinnedMesh).isSkinnedMesh) mesh = o as import('three').SkinnedMesh; });
  const m = mesh! as import('three').SkinnedMesh;
  const pos = m.geometry.attributes.position;
  const inv = new THREE.Matrix4().copy(rig.root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const slices: Record<string, number[][]> = {};
  for (let i = 0; i < pos.count; i++) {
    m.getVertexPosition(i, v);
    v.applyMatrix4(m.matrixWorld).applyMatrix4(inv);
    const key = (Math.round(v.z * 10) / 10).toFixed(1);
    (slices[key] ??= []).push([v.x, v.y]);
  }
  const out: Record<string, unknown> = {};
  for (const [k, pts] of Object.entries(slices).sort((a, b) => +a[0] - +b[0])) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    out[k] = { n: pts.length, x: [Math.min(...xs).toFixed(3), Math.max(...xs).toFixed(3)], y: [Math.min(...ys).toFixed(3), Math.max(...ys).toFixed(3)] };
  }
  console.log(JSON.stringify(out));
}
