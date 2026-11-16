/**
 * The 3D stage: a cricket pitch seen from behind the player's crease, with the
 * player's hand nearest the camera and the opponent's hand at the far crease.
 * Both hands are palm-down with their backs to the camera, except for the six,
 * which turns into a side-on thumbs-up.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Finger } from '@plyo/engine';
import { HandRig } from './HandRig.ts';
import { SKIN_TONES } from './skinTones.ts';

/** `wide` frames for landscape desktop panels, `portrait` for phones. */
export type CameraPreset = 'wide' | 'portrait';

export interface HandStageOptions {
  playerSkin?: string;
  opponentSkin?: string;
  leftHanded?: boolean;
  preset?: CameraPreset;
  /** Cap on device pixel ratio (phones default lower to save battery). */
  maxPixelRatio?: number;
  /** Colours for the two sleeves: [player, opponent]. */
  sleeves?: [string, string];
  /** Called once both hands are loaded and the first frame has rendered. */
  onReady?: () => void;
}

const HAND_HEIGHT = 0.62;
const WRIST_Z = 2.3;

function pitchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#24503a' : '#285740';
    g.fillRect(0, i * 64, 512, 64);
  }
  const x0 = 104;
  const x1 = 408;
  const clay = g.createLinearGradient(x0, 0, x1, 0);
  clay.addColorStop(0, '#a98a57');
  clay.addColorStop(0.5, '#c2a26a');
  clay.addColorStop(1, '#a98a57');
  g.fillStyle = clay;
  g.fillRect(x0, 0, x1 - x0, 1024);
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '80,56,26' : '255,240,210'},${Math.random() * 0.07})`;
    g.fillRect(x0 + Math.random() * (x1 - x0), Math.random() * 1024, 2, 2);
  }
  g.strokeStyle = 'rgba(248,247,240,0.9)';
  g.lineWidth = 6;
  for (const y of [338, 686]) {
    g.beginPath();
    g.moveTo(x0 - 30, y);
    g.lineTo(x1 + 30, y);
    g.stroke();
  }
  for (const [a, b] of [[238, 382], [642, 786]]) {
    for (const x of [156, 356]) {
      g.beginPath();
      g.moveTo(x, a);
      g.lineTo(x, b);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class HandStage {
  player: HandRig | null = null;
  opponent: HandRig | null = null;
  onFingerTap: ((finger: Finger) => void) | null = null;
  interactive = false;
  readonly ready: Promise<void>;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  private raf = 0;
  private last = 0;
  private resizeObserver: ResizeObserver;
  private disposables: { dispose(): void }[] = [];
  private raycaster = new THREE.Raycaster();
  private container: HTMLElement;
  private preset: CameraPreset;
  private disposed = false;
  private ground: THREE.Object3D[] = [];
  private fixedView: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private frameAvg = 1 / 60;
  private frames = 0;
  private degraded = false;

  constructor(container: HTMLElement, opts: HandStageOptions = {}) {
    this.container = container;
    this.preset = opts.preset ?? 'wide';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio ?? 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'hand-stage__canvas';
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    this.disposables.push(env);

    this.buildPitch();
    this.buildLights();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointer);
    document.addEventListener('visibilitychange', this.handleVisibility);

    const [pSleeve, oSleeve] = opts.sleeves ?? ['#ece8dc', '#22384a'];
    this.ready = Promise.all([
      HandRig.create({ skin: opts.playerSkin ?? SKIN_TONES[1], sleeve: pSleeve, stripe: '#b8322a', leftHanded: opts.leftHanded, tilt: 0.06 }),
      HandRig.create({ skin: opts.opponentSkin ?? SKIN_TONES[3], sleeve: oSleeve, stripe: '#d9a640', tilt: 0.34 }),
    ]).then(([player, opponent]) => {
      if (this.disposed) {
        player.dispose();
        opponent.dispose();
        return;
      }
      player.root.position.set(0, HAND_HEIGHT, WRIST_Z);
      opponent.root.position.set(0, HAND_HEIGHT, -WRIST_Z);
      opponent.root.rotation.y = Math.PI;
      this.scene.add(player.root, opponent.root);
      this.player = player;
      this.opponent = opponent;
      this.start();
      opts.onReady?.();
    });
  }

  private buildPitch() {
    const tex = pitchTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const geo = new THREE.PlaneGeometry(9, 18);
    geo.rotateX(-Math.PI / 2);
    const plane = new THREE.Mesh(geo, mat);
    plane.receiveShadow = true;
    this.scene.add(plane);
    // Outfield beyond the strip so wide frames never show the void.
    const turfMat = new THREE.MeshStandardMaterial({ color: '#24503a', roughness: 1 });
    const turfGeo = new THREE.PlaneGeometry(80, 80);
    turfGeo.rotateX(-Math.PI / 2);
    const turf = new THREE.Mesh(turfGeo, turfMat);
    turf.position.y = -0.002;
    turf.receiveShadow = true;
    this.scene.add(turf);
    this.ground.push(plane, turf);
    this.scene.fog = new THREE.Fog('#132820', 16, 34);
    this.disposables.push(tex, mat, geo, turfMat, turfGeo);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#3b2f1d', 0.65));
    const key = new THREE.DirectionalLight('#fff1dc', 2.6);
    key.position.set(-3.5, 7.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 5, bottom: -5, near: 1, far: 22 });
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#b9d4ff', 1.3);
    rim.position.set(3.5, 4, -6);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#ffd8c4', 0.55);
    fill.position.set(4, 2.5, 6);
    this.scene.add(fill);
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    if (this.fixedView) {
      this.camera.position.copy(this.fixedView.pos);
      this.camera.lookAt(this.fixedView.target);
      this.camera.updateProjectionMatrix();
      return;
    }
    // Behind the player's crease, low enough that an upright thumb reads side-on.
    const elevation = THREE.MathUtils.degToRad(this.preset === 'portrait' ? 46 : 42);
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const target = new THREE.Vector3(0, 0.45, 0.25);
    // Half extents of what must stay in frame, measured from the target.
    const needH = 2.85 * Math.sin(elevation) + 0.75 * Math.cos(elevation);
    const needW = 1.3;
    const dist = Math.max(needH / Math.tan(halfV), needW / (Math.tan(halfV) * aspect)) + (this.preset === 'wide' ? 1.6 : 0.2);
    this.camera.position.set(0, target.y + Math.sin(elevation) * dist, target.z + Math.cos(elevation) * dist);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
  }

  private handlePointer = (e: PointerEvent) => {
    if (!this.interactive || !this.onFingerTap || !this.player) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.player.pickables, false)[0];
    const finger = hit?.object.userData.finger as Finger | undefined;
    if (finger) this.onFingerTap(finger);
  };

  private handleVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (this.player) this.start();
  };

  /** Drop to 1× resolution if frames stay slow, to keep ordinary phones smooth. */
  private adapt(raw: number) {
    if (this.degraded || raw > 0.5) return;
    this.frameAvg = this.frameAvg * 0.95 + raw * 0.05;
    if (++this.frames > 90 && this.frameAvg > 1 / 30 && this.renderer.getPixelRatio() > 1) {
      this.degraded = true;
      this.renderer.setPixelRatio(1);
      this.resize();
    }
  }

  private start() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now: number) => {
      const raw = (now - this.last) / 1000;
      const dt = Math.min(0.1, raw);
      this.last = now;
      this.adapt(raw);
      this.player?.update(dt);
      this.opponent?.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setInteractive(on: boolean) {
    this.interactive = on;
    this.renderer.domElement.style.cursor = on ? 'pointer' : 'default';
  }

  /** Art direction: hide the pitch (for transparent key art). */
  setGroundVisible(visible: boolean) {
    this.ground.forEach((g) => (g.visible = visible));
    this.scene.fog = visible ? new THREE.Fog('#132820', 16, 34) : null;
  }

  /** Art direction: lock the camera to a custom view (null restores automatic framing). */
  setView(pos: [number, number, number] | null, target: [number, number, number] = [0, 0.5, 0], fov = 30) {
    this.fixedView = pos ? { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) } : null;
    this.camera.fov = fov;
    this.resize();
  }

  /** Render one frame immediately (used by tests and snapshots). */
  renderNow() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointer);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.player?.dispose();
    this.opponent?.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
