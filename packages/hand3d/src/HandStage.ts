/**
 * The 3D stage: a cricket pitch seen from above, with the player's hand at
 * the near crease and the opponent's hand at the far crease. Both hands are
 * palm-down with their backs to the camera.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Finger } from '../engine/gestures.ts';
import { HandModel, SKIN_TONES } from './HandModel.ts';

export interface HandStageOptions {
  playerSkin?: string;
  opponentSkin?: string;
  leftHanded?: boolean;
  reducedMotion?: boolean;
}

const HAND_HEIGHT = 0.62;
const WRIST_Z = 2.35;

function pitchTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 1024;
  const g = c.getContext('2d')!;
  // Mown outfield stripes.
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#2b5a40' : '#2f6345';
    g.fillRect(0, i * 64, 512, 64);
  }
  // Clay strip with a soft worn edge.
  const x0 = 96;
  const x1 = 416;
  const clay = g.createLinearGradient(x0, 0, x1, 0);
  clay.addColorStop(0, '#b8955c');
  clay.addColorStop(0.5, '#cdac72');
  clay.addColorStop(1, '#b8955c');
  g.fillStyle = clay;
  g.fillRect(x0, 0, x1 - x0, 1024);
  // Grain.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '90,64,30' : '255,245,220'},${Math.random() * 0.08})`;
    g.fillRect(x0 + Math.random() * (x1 - x0), Math.random() * 1024, 2, 2);
  }
  // Popping and return creases at both ends.
  g.strokeStyle = 'rgba(250,250,244,0.92)';
  g.lineWidth = 6;
  for (const y of [336, 688]) {
    g.beginPath();
    g.moveTo(x0 - 30, y);
    g.lineTo(x1 + 30, y);
    g.stroke();
  }
  for (const y of [[236, 380], [644, 788]]) {
    for (const x of [150, 362]) {
      g.beginPath();
      g.moveTo(x, y[0]);
      g.lineTo(x, y[1]);
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export class HandStage {
  readonly player: HandModel;
  readonly opponent: HandModel;
  onFingerTap: ((finger: Finger) => void) | null = null;
  interactive = false;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 1, 0.1, 80);
  private raf = 0;
  private last = 0;
  private resizeObserver: ResizeObserver;
  private disposables: { dispose(): void }[] = [];
  private raycaster = new THREE.Raycaster();
  private container: HTMLElement;

  constructor(container: HTMLElement, opts: HandStageOptions = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'hand-stage__canvas';
    container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    this.disposables.push(env);

    this.buildPitch();
    this.buildLights();

    this.player = new HandModel({
      skin: opts.playerSkin ?? SKIN_TONES[1],
      sleeve: '#f4f1e8',
      stripe: '#c83a2c',
      leftHanded: opts.leftHanded,
    });
    this.player.root.position.set(0, HAND_HEIGHT, WRIST_Z);
    this.scene.add(this.player.root);

    this.opponent = new HandModel({
      skin: opts.opponentSkin ?? SKIN_TONES[3],
      sleeve: '#1f3f5c',
      stripe: '#f4c54a',
    });
    this.opponent.root.position.set(0, HAND_HEIGHT, -WRIST_Z);
    this.opponent.root.rotation.y = Math.PI;
    this.scene.add(this.opponent.root);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointer);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.start();
  }

  private buildPitch() {
    const tex = pitchTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    const geo = new THREE.PlaneGeometry(9, 18);
    geo.rotateX(-Math.PI / 2);
    const plane = new THREE.Mesh(geo, mat);
    plane.receiveShadow = true;
    this.scene.add(plane);
    this.disposables.push(tex, mat, geo);
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#e4ecff', '#4a3a22', 0.7));
    const key = new THREE.DirectionalLight('#fff3e2', 2.4);
    key.position.set(-3.2, 8, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 5;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#bcd8ff', 1.1);
    rim.position.set(3, 4, -6);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#ffd9c2', 0.5);
    fill.position.set(4, 3, 6);
    this.scene.add(fill);
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep both hands (z ≈ ±3.1) and an extended thumb (x ≈ ±1.4) in frame.
    const elevation = THREE.MathUtils.degToRad(62);
    const halfV = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const needH = 2.6 * Math.sin(elevation) + 0.6 * Math.cos(elevation);
    const needW = 1.45;
    const dist = Math.max(needH / Math.tan(halfV), needW / (Math.tan(halfV) * aspect)) + 0.3;
    this.camera.position.set(0, Math.sin(elevation) * dist, Math.cos(elevation) * dist + 0.1);
    this.camera.lookAt(0, 0.25, 0.1);
    this.camera.updateProjectionMatrix();
  }

  private handlePointer = (e: PointerEvent) => {
    if (!this.interactive || !this.onFingerTap) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.player.pickables, false)[0];
    const finger = hit?.object.userData.finger as Finger | undefined;
    if (finger) this.onFingerTap(finger);
  };

  private handleVisibility = () => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else this.start();
  };

  private start() {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now: number) => {
      const raw = (now - this.last) / 1000;
      const dt = Math.min(0.1, raw);
      this.last = now;
      this.adapt(raw);
      this.player.update(dt);
      this.opponent.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frameAvg = 1 / 60;
  private frames = 0;
  private degraded = false;

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

  setInteractive(on: boolean) {
    this.interactive = on;
    this.renderer.domElement.style.cursor = on ? 'pointer' : 'default';
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointer);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.player.dispose();
    this.opponent.dispose();
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
