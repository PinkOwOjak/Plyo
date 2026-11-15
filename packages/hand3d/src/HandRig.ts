/**
 * A stylised, procedurally built 3D right hand with five independently
 * articulated digits.
 *
 * Local space: the wrist sits at the origin, fingers extend along −Z, the back
 * of the hand faces +Y and the palm faces −Y (down, towards the table). For a
 * right hand seen from above with fingers pointing away, the thumb is on −X.
 *
 * One model and one set of reusable finger poses render all 32 gestures: each
 * digit blends between an "extended" and a "folded" pose with a damped spring.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FINGERS, toFingerStates, type Finger, type Gesture } from '../engine/gestures.ts';

import { SKIN_TONES } from './skinTones.ts';

export { SKIN_TONES };

interface DigitSpec {
  finger: Exclude<Finger, 'thumb'>;
  x: number;
  z: number;
  splay: number;
  radius: number;
  lengths: [number, number, number];
}

const DIGITS: DigitSpec[] = [
  { finger: 'index', x: -0.315, z: -0.985, splay: 0.07, radius: 0.104, lengths: [0.4, 0.25, 0.2] },
  { finger: 'middle', x: -0.105, z: -1.03, splay: 0.0, radius: 0.108, lengths: [0.45, 0.28, 0.21] },
  { finger: 'ring', x: 0.105, z: -1.0, splay: -0.06, radius: 0.102, lengths: [0.42, 0.26, 0.2] },
  { finger: 'little', x: 0.3, z: -0.93, splay: -0.15, radius: 0.09, lengths: [0.32, 0.19, 0.17] },
];

/** Joint angles (radians, about local X; negative curls towards the palm). */
const FINGER_EXTENDED = [0.06, -0.08, -0.06] as const;
const FINGER_FOLDED = [-1.5, -1.78, -1.05] as const;

interface ThumbPose {
  yaw: number;
  pitch: number;
  roll: number;
  mcp: number;
  ip: number;
}
const THUMB_EXTENDED: ThumbPose = { yaw: 0.92, pitch: 0.08, roll: -0.35, mcp: 0.05, ip: 0.08 };
const THUMB_FOLDED: ThumbPose = { yaw: -0.2, pitch: -0.62, roll: 0.55, mcp: 0.85, ip: 0.75 };

/** Damped spring state for one digit (0 = extended, 1 = folded). */
interface DigitState {
  curl: number;
  velocity: number;
  target: number;
  /** Time (seconds) before the digit starts moving to its target. */
  delay: number;
}

interface FingerRig {
  base: THREE.Group;
  joints: [THREE.Group, THREE.Group, THREE.Group];
  splay: number;
}

interface ThumbRig {
  base: THREE.Group;
  mcp: THREE.Group;
  ip: THREE.Group;
}

export type HandMotion = 'idle' | 'pump' | 'still';

export interface HandModelOptions {
  skin?: string;
  sleeve?: string;
  stripe?: string;
  leftHanded?: boolean;
}

function roundedPalmGeometry(): THREE.BufferGeometry {
  const w = 0.9;
  const h = 0.3;
  const d = 1.0;
  const r = 0.14;
  const geo = new THREE.BoxGeometry(w, h, d, 14, 6, 16);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = new THREE.Vector3(
      THREE.MathUtils.clamp(v.x, -inner.x, inner.x),
      THREE.MathUtils.clamp(v.y, -inner.y, inner.y),
      THREE.MathUtils.clamp(v.z, -inner.z, inner.z),
    );
    const n = v.clone().sub(c);
    if (n.lengthSq() > 1e-9) v.copy(c.add(n.normalize().multiplyScalar(r)));
    // Shift so the wrist edge is at z = 0 and the knuckle edge at z = −1.
    let z = v.z - d / 2;
    const t = -z; // 0 at wrist, 1 at knuckles
    const xn = v.x / (w / 2);
    // Narrower at the wrist, widest across the knuckles.
    let x = v.x * THREE.MathUtils.lerp(0.84, 1.0, Math.min(1, t * 1.4));
    // Domed back of the hand, flatter palm.
    let y = v.y + (v.y > 0 ? 0.05 : 0.015) * (1 - xn * xn);
    // Knuckle line bows forward in the middle.
    z -= 0.045 * (1 - xn * xn) * Math.max(0, t - 0.6) * 2.5;
    // Fleshy thumb mound on the thumb side, underneath, near the wrist.
    const mound = Math.max(0, -xn - 0.2) * Math.max(0, 1 - Math.abs(t - 0.35) * 2.2);
    if (v.y < 0) y -= 0.07 * mound;
    x -= 0.03 * mound;
    pos.setXYZ(i, x, y, z);
  }
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  const merged = mergeVertices(geo, 1e-4);
  merged.computeVertexNormals();
  return merged;
}

/** Capsule from the local origin along −Z, slightly flattened. */
function segmentGeometry(radius: number, length: number): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 16);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -length / 2);
  g.scale(1, 0.86, 1);
  return g;
}

export class HandModel {
  readonly root = new THREE.Group();
  /** Inner group that receives procedural motion (pump, impact, idle). */
  readonly body = new THREE.Group();
  readonly skin: THREE.MeshPhysicalMaterial;
  readonly pickables: THREE.Mesh[] = [];

  private fingers: FingerRig[] = [];
  private thumb!: ThumbRig;
  private digits: DigitState[] = FINGERS.map(() => ({ curl: 1, velocity: 0, target: 1, delay: 0 }));
  private gesture: Gesture = '00000';
  private motion: HandMotion = 'idle';
  private time = 0;
  private pumpStart = 0;
  private pumpPeriod = 0.5;
  private impactAt = -10;
  private recoilAt = -10;
  private disposables: { dispose(): void }[] = [];
  private nail: THREE.MeshPhysicalMaterial;

  constructor(opts: HandModelOptions = {}) {
    this.skin = new THREE.MeshPhysicalMaterial({
      color: opts.skin ?? SKIN_TONES[1],
      roughness: 0.52,
      metalness: 0,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ff9a7a'),
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
    });
    this.nail = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(opts.skin ?? SKIN_TONES[1]).lerp(new THREE.Color('#f7d4c8'), 0.22),
      roughness: 0.35,
      clearcoat: 0.5,
      clearcoatRoughness: 0.35,
    });
    const sleeve = new THREE.MeshStandardMaterial({ color: opts.sleeve ?? '#f4f1e8', roughness: 0.92 });
    const stripe = new THREE.MeshStandardMaterial({ color: opts.stripe ?? '#1d4d3a', roughness: 0.85 });
    this.disposables.push(this.skin, this.nail, sleeve, stripe);

    this.root.add(this.body);
    this.buildPalm();
    this.buildFingers();
    this.buildThumb();
    this.buildForearm(sleeve, stripe);
    if (opts.leftHanded) this.body.scale.x = -1;

    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.applyPose();
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, finger?: Finger) {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    this.disposables.push(geo);
    if (finger) {
      m.userData.finger = finger;
      this.pickables.push(m);
    }
    return m;
  }

  private buildPalm() {
    this.mesh(roundedPalmGeometry(), this.skin, this.body);
  }

  private buildFingers() {
    for (const spec of DIGITS) {
      const base = new THREE.Group();
      base.position.set(spec.x, 0.03, spec.z + 0.1);
      base.rotation.y = spec.splay;
      this.body.add(base);

      // Knuckle bump on the back of the hand.
      const knuckle = this.mesh(new THREE.SphereGeometry(spec.radius * 1.08, 16, 12), this.skin, this.body);
      knuckle.position.set(spec.x, 0.075, spec.z + 0.07);
      knuckle.scale.set(1, 0.7, 1.1);

      const joints: THREE.Group[] = [];
      let parent: THREE.Object3D = base;
      spec.lengths.forEach((len, i) => {
        const joint = new THREE.Group();
        if (i > 0) joint.position.z = -spec.lengths[i - 1];
        parent.add(joint);
        const radius = spec.radius * [1, 0.92, 0.84][i];
        this.mesh(segmentGeometry(radius, len), this.skin, joint, spec.finger);
        if (i === 2) {
          const nail = this.mesh(new THREE.SphereGeometry(1, 16, 8), this.nail, joint, spec.finger);
          nail.scale.set(radius * 0.72, radius * 0.22, len * 0.42);
          nail.position.set(0, radius * 0.7, -len * 0.62);
          nail.rotation.x = -0.08;
        }
        joints.push(joint);
        parent = joint;
      });
      this.fingers.push({ base, joints: joints as FingerRig['joints'], splay: spec.splay });
    }
  }

  private buildThumb() {
    const base = new THREE.Group();
    base.position.set(-0.3, -0.04, -0.2);
    base.rotation.order = 'YXZ';
    this.body.add(base);
    const metaLen = 0.36;
    const proxLen = 0.26;
    const distLen = 0.22;
    this.mesh(segmentGeometry(0.13, metaLen), this.skin, base, 'thumb');
    const mcp = new THREE.Group();
    mcp.position.z = -metaLen;
    mcp.rotation.order = 'YXZ';
    base.add(mcp);
    this.mesh(segmentGeometry(0.112, proxLen), this.skin, mcp, 'thumb');
    const ip = new THREE.Group();
    ip.position.z = -proxLen;
    ip.rotation.order = 'YXZ';
    mcp.add(ip);
    this.mesh(segmentGeometry(0.104, distLen), this.skin, ip, 'thumb');
    const nail = this.mesh(new THREE.SphereGeometry(1, 16, 8), this.nail, ip, 'thumb');
    nail.scale.set(0.076, 0.024, distLen * 0.42);
    nail.position.set(0, 0.075, -distLen * 0.62);
    this.thumb = { base, mcp, ip };
  }

  private buildForearm(sleeve: THREE.Material, stripe: THREE.Material) {
    const arm = new THREE.Group();
    arm.scale.set(1.2, 0.74, 1);
    this.body.add(arm);
    // Wrist and forearm, starting inside the palm so the joint blends.
    const wrist = new THREE.CylinderGeometry(0.33, 0.29, 1.3, 28, 1, true);
    wrist.rotateX(Math.PI / 2);
    wrist.translate(0, 0, 0.35);
    this.mesh(wrist, this.skin, arm);

    const cuffZ = 0.78;
    const sleeveGeo = new THREE.CylinderGeometry(0.46, 0.44, 2.6, 32, 1, false);
    sleeveGeo.rotateX(Math.PI / 2);
    sleeveGeo.translate(0, 0, cuffZ + 1.3);
    this.mesh(sleeveGeo, sleeve, arm);
    const rim = this.mesh(new THREE.TorusGeometry(0.44, 0.06, 12, 32), sleeve, arm);
    rim.position.z = cuffZ;
    [0.2, 0.32].forEach((dz) => {
      const band = this.mesh(new THREE.TorusGeometry(0.455, 0.03, 8, 32), stripe, arm);
      band.position.z = cuffZ + dz;
    });
  }

  /** Change the displayed gesture. Fingers move with a slight natural stagger. */
  setGesture(gesture: Gesture, opts: { stagger?: boolean; instant?: boolean } = {}) {
    const states = toFingerStates(gesture);
    const order = [1, 2, 3, 4, 0];
    states.forEach((extended, i) => {
      const d = this.digits[i];
      const target = extended ? 0 : 1;
      if (opts.instant) {
        d.curl = target;
        d.velocity = 0;
      }
      if (d.target !== target) d.delay = opts.stagger ? order.indexOf(i) * 0.035 : 0;
      d.target = target;
    });
    this.gesture = gesture;
  }

  getGesture() {
    return this.gesture;
  }

  /** True when every digit has settled at its target. */
  isSettled() {
    return this.digits.every((d) => Math.abs(d.curl - d.target) < 0.02 && Math.abs(d.velocity) < 0.05);
  }

  setMotion(motion: HandMotion, period = 0.5) {
    if (motion === 'pump') {
      this.pumpStart = this.time;
      this.pumpPeriod = period;
    }
    this.motion = motion;
  }

  /** A short downward slam, used at the reveal. */
  impact() {
    this.impactAt = this.time;
  }

  /** A recoil shake, used for the batter when out. */
  recoil() {
    this.recoilAt = this.time;
  }

  setSkin(color: string) {
    this.skin.color.set(color);
    this.nail.color.set(color).lerp(new THREE.Color('#f7d4c8'), 0.22);
  }

  update(dt: number) {
    this.time += dt;
    const k = 210;
    const c = 2 * Math.sqrt(k) * 0.72;
    // On very slow frames (≤ 10 fps) snap to the pose so the gesture is never misread.
    const snap = dt >= 0.1;
    for (const d of this.digits) {
      if (snap) {
        d.curl = d.target;
        d.velocity = 0;
        d.delay = 0;
        continue;
      }
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      // Semi-implicit Euler in small steps for stability on slow frames.
      let rem = Math.min(dt, 0.1);
      while (rem > 0) {
        const h = Math.min(rem, 1 / 120);
        d.velocity += (k * (d.target - d.curl) - c * d.velocity) * h;
        d.curl += d.velocity * h;
        rem -= h;
      }
      d.curl = THREE.MathUtils.clamp(d.curl, -0.12, 1.1);
    }
    this.applyPose();
    this.applyBodyMotion();
  }

  private applyPose() {
    const t = this.time;
    this.fingers.forEach((rig, i) => {
      const curl = this.digits[i + 1].curl;
      const idle = this.motion === 'idle' ? Math.sin(t * 1.3 + i * 0.9) * 0.025 : 0;
      rig.base.rotation.y = rig.splay * (1 - curl * 0.85);
      rig.joints.forEach((j, n) => {
        j.rotation.x = THREE.MathUtils.lerp(FINGER_EXTENDED[n], FINGER_FOLDED[n], curl) + idle * (1 - curl);
      });
    });
    const tc = this.digits[0].curl;
    const lerp = (a: number, b: number) => THREE.MathUtils.lerp(a, b, tc);
    const { base, mcp, ip } = this.thumb;
    base.rotation.set(
      lerp(THUMB_EXTENDED.pitch, THUMB_FOLDED.pitch),
      lerp(THUMB_EXTENDED.yaw, THUMB_FOLDED.yaw),
      lerp(THUMB_EXTENDED.roll, THUMB_FOLDED.roll),
    );
    const mcpFlex = lerp(THUMB_EXTENDED.mcp, THUMB_FOLDED.mcp);
    const ipFlex = lerp(THUMB_EXTENDED.ip, THUMB_FOLDED.ip);
    mcp.rotation.set(-mcpFlex * 0.45, -mcpFlex * 0.8, 0);
    ip.rotation.set(-ipFlex * 0.5, -ipFlex * 0.75, 0);
  }

  private applyBodyMotion() {
    const t = this.time;
    let y = 0;
    let pitch = 0;
    if (this.motion === 'idle') {
      y = Math.sin(t * 1.6) * 0.03;
      pitch = Math.sin(t * 1.1) * 0.015;
    } else if (this.motion === 'pump') {
      const p = ((t - this.pumpStart) / this.pumpPeriod) % 1;
      // Lift quickly, drop with a little snap: the "one, two, three" shake.
      const s = p < 0.55 ? Math.sin((p / 0.55) * Math.PI * 0.5) : Math.cos(((p - 0.55) / 0.45) * Math.PI * 0.5);
      y = s * 0.32;
      pitch = s * 0.22;
    }
    const since = t - this.impactAt;
    if (since >= 0 && since < 0.45) {
      const e = Math.exp(-since * 9) * Math.cos(since * 28);
      y -= 0.14 * e;
      pitch -= 0.05 * e;
    }
    const recoil = t - this.recoilAt;
    let roll = 0;
    if (recoil >= 0 && recoil < 0.8) roll = Math.sin(recoil * 40) * 0.08 * Math.exp(-recoil * 5);
    this.body.position.y = y;
    this.body.rotation.x = pitch;
    this.body.rotation.z = roll;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
