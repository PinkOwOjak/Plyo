/**
 * A rigged, single-mesh 3D right hand with five independently articulated
 * digits, driven by forward kinematics over the bones of one skinned mesh.
 *
 * Model: WebXR "generic-hand" (MIT, see assets/LICENSE-webxr-hand.md). Its 25
 * joints are siblings, so this class computes the joint chain itself: every
 * joint rotation moves all joints further along the digit.
 *
 * Local space of `root`: wrist at the origin, fingers extend along −Z, the
 * back of the hand faces +Y and the palm faces −Y. The forearm runs to +Z.
 * For a right hand seen from above with fingers pointing away, the thumb is on −X.
 *
 * Poses:
 *  - Every gesture blends each digit between "extended" and "folded".
 *  - Thumb-only (10000, the six) has its own dedicated pose: a closed fist with
 *    the thumb held straight up, forearm rolled so the thumb side is on top,
 *    and the arm turned slightly so the back of the thumb faces the viewer.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toFingerStates, type Gesture } from '@plyo/engine';
import handUrl from './assets/hand-right.glb';
import { SKIN_TONES } from './skinTones.ts';

const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky'] as const;
const SEGMENTS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'] as const;
const THUMB_SEGMENTS = ['metacarpal', 'phalanx-proximal', 'phalanx-distal', 'tip'] as const;

/** Scene units per metre of the source model. */
const SCALE = 10.5;

export type HandMotion = 'idle' | 'pump' | 'still';

export interface HandRigOptions {
  skin?: string;
  sleeve?: string;
  stripe?: string;
  leftHanded?: boolean;
  /** Wrist lift (radians) so extended fingers face a camera they point towards. */
  tilt?: number;
}

interface Joint {
  bone: THREE.Bone;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
}

interface Spring {
  value: number;
  velocity: number;
  target: number;
  delay: number;
}

/** Finger joint angles in radians (positive curls towards the palm). */
const FINGER_EXT = { mcp: 0.1, pip: 0.12, dip: 0.08 };
const FINGER_FOLD = { mcp: 1.5, pip: 1.85, dip: 1.15 };
const SPLAY = [0.1, 0.0, -0.08, -0.17];

let template: Promise<THREE.Group> | null = null;

export function loadHandTemplate(): Promise<THREE.Group> {
  template ??= new GLTFLoader().loadAsync(handUrl).then((g) => g.scene);
  return template;
}

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class HandRig {
  /** Positioned by the stage. Forearm extends to +Z. */
  readonly root = new THREE.Group();
  /** Arm yaw + procedural motion. */
  private arm = new THREE.Group();
  /** Forearm roll (the six pose turns the thumb side up). */
  private roll = new THREE.Group();
  /** Wrist flexion. */
  private wrist = new THREE.Group();
  readonly skin: THREE.MeshPhysicalMaterial;
  /** Meshes that can be tapped; userData.finger is set on the proxies. */
  readonly pickables: THREE.Object3D[] = [];

  private mesh!: THREE.SkinnedMesh;
  private fingers: Joint[][] = [];
  private thumb: Joint[] = [];
  private wristJoint!: Joint;
  /** Hand frame in model space: S = towards thumb side, N = palm normal, F = towards fingertips. */
  private S = v();
  private N = v();
  private F = v();
  private digits: Spring[] = Array.from({ length: 5 }, () => ({ value: 1, velocity: 0, target: 1, delay: 0 }));
  /** 0 = standard palm-down pose, 1 = the six (thumbs-up) pose. */
  private six: Spring = { value: 0, velocity: 0, target: 0, delay: 0 };
  private gesture: Gesture = '00000';
  private motion: HandMotion = 'idle';
  private time = 0;
  private pumpStart = 0;
  private pumpPeriod = 0.5;
  private impactAt = -10;
  private recoilAt = -10;
  private disposables: { dispose(): void }[] = [];
  private tilt: number;

  private constructor(source: THREE.Group, opts: HandRigOptions) {
    this.skin = new THREE.MeshPhysicalMaterial({
      color: opts.skin ?? SKIN_TONES[1],
      roughness: 0.48,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#ff8a6a'),
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      specularIntensity: 0.6,
    });
    this.disposables.push(this.skin);

    this.tilt = opts.tilt ?? 0;
    this.root.add(this.arm);
    this.arm.add(this.roll);
    this.roll.add(this.wrist);

    const model = cloneSkinned(source) as THREE.Group;
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
        const m = o as THREE.SkinnedMesh;
        m.material = this.skin;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        this.mesh = m;
      }
    });
    const bone = (name: string) => {
      const b = model.getObjectByName(name) as THREE.Bone | undefined;
      if (!b) throw new Error(`Hand model is missing joint ${name}`);
      return { bone: b, restPos: b.position.clone(), restQuat: b.quaternion.clone() };
    };
    this.wristJoint = bone('wrist');
    this.thumb = THUMB_SEGMENTS.map((s) => bone(`thumb-${s}`));
    this.fingers = FINGER_NAMES.map((f) => SEGMENTS.map((s) => bone(`${f}-finger-${s}`)));

    // Hand frame from the rest pose.
    const wristP = this.wristJoint.restPos;
    const middleKnuckle = this.fingers[1][1].restPos;
    this.F.subVectors(middleKnuckle, wristP).normalize();
    this.S.subVectors(this.fingers[0][1].restPos, this.fingers[3][1].restPos);
    this.S.addScaledVector(this.F, -this.S.dot(this.F)).normalize();
    this.N.crossVectors(this.S, this.F).normalize();

    // Orient the model so S → −X, N → −Y, F → −Z, wrist at the origin.
    const toModel = new THREE.Matrix4().makeBasis(this.S.clone().negate(), this.N.clone().negate(), this.F.clone().negate());
    const toLocal = toModel.clone().transpose();
    model.quaternion.setFromRotationMatrix(toLocal);
    model.scale.setScalar(SCALE);
    model.position.copy(wristP.clone().applyMatrix4(toLocal).multiplyScalar(-SCALE));
    this.wrist.add(model);
    if (opts.leftHanded) this.root.scale.x = -1;

    this.buildNails(opts.skin ?? SKIN_TONES[1]);
    this.buildForearm(opts);
    this.buildPickProxies();
    this.applyPose();
  }

  static async create(opts: HandRigOptions = {}): Promise<HandRig> {
    return new HandRig(await loadHandTemplate(), opts);
  }

  private nailMat!: THREE.MeshPhysicalMaterial;

  /**
   * Fingernails, attached to each distal bone so they follow every pose.
   * The source model has no nails; they are what makes the back of a digit
   * readable at a glance (and the thumbnail is key to the six pose).
   */
  private buildNails(skin: string) {
    this.nailMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(skin).lerp(new THREE.Color('#f1cfc4'), 0.28),
      roughness: 0.38,
      clearcoat: 0.45,
      clearcoatRoughness: 0.3,
    });
    this.disposables.push(this.nailMat);
    const back = this.N.clone().negate();

    const addNail = (distal: Joint, tip: Joint, radius: number, dorsal: THREE.Vector3, depth = radius * 0.66) => {
      const along = tip.restPos.clone().sub(distal.restPos);
      const len = along.length();
      const fwd = along.clone().normalize();
      const up = dorsal.clone().addScaledVector(fwd, -dorsal.dot(fwd)).normalize();
      const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
      // Nail centre: towards the tip, sitting on the dorsal surface.
      const centre = distal.restPos.clone().addScaledVector(fwd, len * 0.62).addScaledVector(up, depth);
      const basis = new THREE.Matrix4().makeBasis(side, up, fwd);
      const qModel = new THREE.Quaternion().setFromRotationMatrix(basis);
      const geo = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      geo.scale(radius * 0.62, radius * 0.3, len * 0.44);
      this.disposables.push(geo);
      const nail = new THREE.Mesh(geo, this.nailMat);
      const invRest = distal.restQuat.clone().invert();
      nail.position.copy(centre.sub(distal.restPos).applyQuaternion(invRest));
      nail.quaternion.copy(invRest.multiply(qModel));
      nail.castShadow = false;
      distal.bone.add(nail);
    };

    const radii = [0.0086, 0.0089, 0.0084, 0.0075];
    this.fingers.forEach((chain, i) => addNail(chain[3], chain[4], radii[i], back));
    // Thumbnail: the thumb tip is flatter than it is wide, so the thinnest axis of
    // its cross-section is the back-to-pad axis. Measure it from the skinned
    // vertices, then pick the side facing away from the fingers.
    const t = this.thumb;
    const m = this.measureDorsal(t[2], t[3]);
    addNail(t[2], t[3], 0.0104, m?.dir ?? back, m ? m.depth * 0.82 : undefined);
  }

  /** Back-of-digit direction for a distal segment, from the mesh's own shape. */
  private measureDorsal(distal: Joint, tip: Joint): { dir: THREE.Vector3; depth: number } | null {
    const geo = this.mesh.geometry;
    const pos = geo.attributes.position;
    const idx = geo.attributes.skinIndex;
    const wt = geo.attributes.skinWeight;
    const bi = this.mesh.skeleton.bones.indexOf(distal.bone);
    if (bi < 0 || !idx || !wt) return null;
    const axis = tip.restPos.clone().sub(distal.restPos).normalize();
    const pts: THREE.Vector3[] = [];
    const p = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (idx.getComponent(i, k) === bi) w += wt.getComponent(i, k);
      if (w > 0.6) pts.push(p.fromBufferAttribute(pos, i).clone());
    }
    if (pts.length < 12) return null;
    const c = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(pts.length);
    // Orthonormal basis of the plane across the digit.
    const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const w2 = new THREE.Vector3().crossVectors(axis, u).normalize();
    let suu = 0;
    let sww = 0;
    let suw = 0;
    for (const q of pts) {
      const d = q.clone().sub(c);
      const a = d.dot(u);
      const b = d.dot(w2);
      suu += a * a;
      sww += b * b;
      suw += a * b;
    }
    // Minor eigenvector of the 2×2 covariance = thinnest direction.
    const tr = suu + sww;
    const det = suu * sww - suw * suw;
    const lMin = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const ev = Math.abs(suw) > 1e-12 ? new THREE.Vector2(lMin - sww, suw) : suu < sww ? new THREE.Vector2(1, 0) : new THREE.Vector2(0, 1);
    const dir = u.clone().multiplyScalar(ev.x).addScaledVector(w2, ev.y).normalize();
    // The pad faces the fingers; the nail faces away from them.
    const fingers = this.fingers[0][2].restPos.clone().lerp(this.fingers[1][2].restPos, 0.5);
    if (dir.dot(c.clone().sub(fingers)) < 0) dir.negate();
    // Surface depth along that direction, from the bone line.
    const depth = Math.max(...pts.map((q) => q.clone().sub(distal.restPos).dot(dir)));
    return { dir, depth };
  }

  private buildForearm(opts: HandRigOptions) {
    const sleeve = new THREE.MeshStandardMaterial({ color: opts.sleeve ?? '#ece8dc', roughness: 0.9 });
    const stripe = new THREE.MeshStandardMaterial({ color: opts.stripe ?? '#b8322a', roughness: 0.8 });
    this.disposables.push(sleeve, stripe);
    const arm = new THREE.Group();
    arm.scale.set(1.22, 0.8, 1);
    this.roll.add(arm);
    // Tapered forearm from inside the wrist out past the cuff.
    // Sized to the hand mesh's wrist section (≈0.55 × 0.39 units, centred on the axis).
    const fore = new THREE.CylinderGeometry(0.285, 0.226, 1.2, 36, 6, true);
    fore.rotateX(Math.PI / 2);
    fore.translate(0, 0, 0.55);
    const foreMesh = new THREE.Mesh(fore, this.skin);
    const cuffZ = 0.8;
    const sleeveGeo = new THREE.CylinderGeometry(0.44, 0.42, 3, 40, 1, false);
    sleeveGeo.rotateX(Math.PI / 2);
    sleeveGeo.translate(0, 0, cuffZ + 1.5);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeve);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.055, 14, 40), sleeve);
    rim.position.set(0, 0, cuffZ);
    const bands = [0.2, 0.31].map((dz) => {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.022, 8, 40), stripe);
      b.position.set(0, 0, cuffZ + dz);
      return b;
    });
    for (const m of [foreMesh, sleeveMesh, rim, ...bands]) {
      m.castShadow = true;
      m.receiveShadow = true;
      arm.add(m);
      this.disposables.push(m.geometry);
    }
  }

  /** Invisible capsules around each digit for tap-to-toggle picking. */
  private buildPickProxies() {
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    this.disposables.push(mat);
    const names = ['thumb', 'index', 'middle', 'ring', 'little'] as const;
    names.forEach((finger) => {
      const geo = new THREE.SphereGeometry(0.17, 8, 6);
      this.disposables.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.userData.finger = finger;
      this.pickables.push(m);
      this.wrist.add(m);
    });
  }

  // ---------------------------------------------------------------- posing

  setGesture(gesture: Gesture, opts: { stagger?: boolean; instant?: boolean } = {}) {
    const states = toFingerStates(gesture);
    const order = [1, 2, 3, 4, 0];
    const isSix = gesture === '10000';
    states.forEach((extended, i) => {
      const d = this.digits[i];
      const target = extended ? 0 : 1;
      if (opts.instant) {
        d.value = target;
        d.velocity = 0;
      }
      if (d.target !== target) d.delay = opts.stagger ? order.indexOf(i) * 0.035 : 0;
      d.target = target;
    });
    this.six.target = isSix ? 1 : 0;
    if (opts.instant) {
      this.six.value = this.six.target;
      this.six.velocity = 0;
    }
    this.gesture = gesture;
    this.applyPose();
  }

  getGesture() {
    return this.gesture;
  }

  isSettled() {
    return [...this.digits, this.six].every((d) => Math.abs(d.value - d.target) < 0.02 && Math.abs(d.velocity) < 0.05);
  }

  setMotion(motion: HandMotion, period = 0.5) {
    if (motion === 'pump') {
      this.pumpStart = this.time;
      this.pumpPeriod = period;
    }
    this.motion = motion;
  }

  impact() {
    this.impactAt = this.time;
  }

  recoil() {
    this.recoilAt = this.time;
  }

  setSkin(color: string) {
    this.skin.color.set(color);
    this.nailMat.color.set(color).lerp(new THREE.Color('#f1cfc4'), 0.28);
  }

  update(dt: number) {
    this.time += dt;
    const snap = dt >= 0.1; // very slow frame: snap so a gesture is never misread
    const step = (d: Spring, k: number, damping: number) => {
      if (snap) {
        d.value = d.target;
        d.velocity = 0;
        d.delay = 0;
        return;
      }
      if (d.delay > 0) {
        d.delay -= dt;
        return;
      }
      const c = 2 * Math.sqrt(k) * damping;
      let rem = Math.min(dt, 0.1);
      while (rem > 0) {
        const h = Math.min(rem, 1 / 120);
        d.velocity += (k * (d.target - d.value) - c * d.velocity) * h;
        d.value += d.velocity * h;
        rem -= h;
      }
    };
    this.digits.forEach((d) => {
      step(d, 210, 0.72);
      d.value = THREE.MathUtils.clamp(d.value, -0.1, 1.08);
    });
    step(this.six, 120, 0.85);
    this.six.value = THREE.MathUtils.clamp(this.six.value, 0, 1.03);
    this.applyPose();
    this.applyBodyMotion();
  }

  /** Rotation of angle a (radians) about axis in model space. */
  private rot(axis: THREE.Vector3, a: number) {
    return new THREE.Quaternion().setFromAxisAngle(axis, a);
  }

  /**
   * Place a chain of joints. `rots[i]` is the rotation applied at joint i
   * (cumulative down the chain). Each joint keeps its rest offset from the
   * previous joint, rotated by everything before it.
   */
  private placeChain(chain: Joint[], rots: THREE.Quaternion[]) {
    const cum = new THREE.Quaternion();
    const pos = chain[0].restPos.clone();
    chain.forEach((j, i) => {
      if (i > 0) {
        const offset = j.restPos.clone().sub(chain[i - 1].restPos).applyQuaternion(cum);
        pos.add(offset);
      }
      cum.multiply(rots[i] ?? new THREE.Quaternion());
      j.bone.position.copy(pos);
      j.bone.quaternion.copy(cum).multiply(j.restQuat);
    });
  }

  private applyPose() {
    const sixT = THREE.MathUtils.smoothstep(this.six.value, 0, 1);
    const t = this.time;

    // Fingers: cumulative flexion about each finger's own flex axis.
    this.fingers.forEach((chain, f) => {
      const curl = Math.max(this.digits[f + 1].value, sixT);
      const idle = this.motion === 'idle' ? Math.sin(t * 1.3 + f * 0.9) * 0.03 * (1 - curl) : 0;
      const dir = chain[4].restPos.clone().sub(chain[1].restPos).normalize();
      const flexAxis = new THREE.Vector3().crossVectors(dir, this.N).normalize();
      const lerp = (a: number, b: number) => THREE.MathUtils.lerp(a, b, curl);
      // Folded fingers tuck a little more for the tight fist of the six.
      const tight = 1 + 0.08 * sixT;
      const splay = this.rot(this.N, SPLAY[f] * (1 - curl * 0.9));
      const mcp = this.rot(flexAxis, (lerp(FINGER_EXT.mcp, FINGER_FOLD.mcp) + idle) * tight);
      const cup = this.rot(this.F, (f - 1.5) * 0.04 * curl);
      this.placeChain(chain, [
        cup,
        splay.multiply(mcp),
        this.rot(flexAxis, lerp(FINGER_EXT.pip, FINGER_FOLD.pip) * tight),
        this.rot(flexAxis, lerp(FINGER_EXT.dip, FINGER_FOLD.dip)),
        new THREE.Quaternion(),
      ]);
    });

    // Thumb: aim each segment along a direction in the hand frame.
    const { S, N, F } = this;
    const mix = (s: number, n: number, f: number) => S.clone().multiplyScalar(s).addScaledVector(N, n).addScaledVector(F, f).normalize();
    const poses = {
      extended: [mix(0.75, 0.32, 0.58), mix(0.86, 0.12, 0.5), mix(0.86, 0.06, 0.5)],
      folded: [mix(0.3, 0.75, 0.6), mix(-0.55, 0.6, 0.6), mix(-0.95, 0.25, 0.2)],
      six: [mix(0.78, 0.35, 0.52), mix(0.97, 0.02, 0.24), mix(0.98, -0.04, 0.2)],
    };
    const tc = this.digits[0].value;
    const dirs = [0, 1, 2].map((i) => {
      const base = poses.extended[i].clone().lerp(poses.folded[i], tc).normalize();
      return base.lerp(poses.six[i], sixT).normalize();
    });
    // Absolute rotation per segment (rest direction → target), then relative to the previous segment.
    const abs = dirs.map((d, i) =>
      new THREE.Quaternion().setFromUnitVectors(this.thumb[i + 1].restPos.clone().sub(this.thumb[i].restPos).normalize(), d),
    );
    const local = abs.map((w, i) => (i === 0 ? w.clone() : abs[i - 1].clone().invert().multiply(w)));
    this.placeChain(this.thumb, [...local, new THREE.Quaternion()]);

    // Pick proxies follow the digit tips.
    this.mesh.skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
    const tips = [this.thumb[2], ...this.fingers.map((c) => c[3])];
    tips.forEach((j, i) => {
      const p = this.pickables[i];
      const world = j.bone.getWorldPosition(new THREE.Vector3());
      p.position.copy(this.wrist.worldToLocal(world));
    });

    // Six pose: roll the forearm so the thumb side is up, flex the wrist back a
    // little, and turn the arm so the back of the thumb faces the camera.
    this.roll.rotation.z = -Math.PI / 2 * sixT;
    this.wrist.rotation.x = THREE.MathUtils.lerp(this.tilt, 0.12, sixT);
    this.arm.rotation.y = -0.5 * sixT;
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
    let shake = 0;
    if (recoil >= 0 && recoil < 0.8) shake = Math.sin(recoil * 40) * 0.08 * Math.exp(-recoil * 5);
    this.arm.position.y = y;
    this.arm.rotation.x = pitch;
    this.arm.rotation.z = shake;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
