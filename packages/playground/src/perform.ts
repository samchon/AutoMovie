import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// A short authored performance ??a beautiful character actually moving and
// emoting ??rendered deterministically (renderAt(t)) so the same clip captures
// frame-for-frame to video. This is automovie's whole point: structured motion data
// ??a deterministic engine ??a reproducible render, here on a VRoid (CC0) face.

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x191c22);
scene.add(new THREE.HemisphereLight(0xffffff, 0x44485a, 1.45));
const key = new THREE.DirectionalLight(0xfff3e6, 1.7);
key.position.set(1.6, 2.8, 2.4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xa8c4ff, 1.0);
rim.position.set(-1.4, 2.2, -2.2);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(26, 9 / 16, 0.1, 100);
camera.position.set(0, 1.15, 2.5);
camera.lookAt(0, 1.05, 0);

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<style>body{margin:0;background:#191c22}#view{display:block}</style><canvas id="view"></canvas>`;
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const W = 720,
  H = 1280;
canvas.width = W;
canvas.height = H;
const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
gl.setSize(W, H, false);
gl.setPixelRatio(1);

let vrm: VRM | null = null;
const gaze = new THREE.Object3D();
scene.add(gaze);

const EXPR = ["happy", "angry", "sad", "relaxed", "surprised"];
export const DURATION = 5.0;

interface Track {
  target: string;
  keys: [number, number][];
}
// arms-down rest is z = 짹0.95 (VRoid VRM0 after rotateVRM0)
const TRACKS: Track[] = [
  { target: "leftUpperArm.z", keys: [[0, 0.95]] },
  { target: "leftLowerArm.z", keys: [[0, 0.1]] },
  {
    target: "rightUpperArm.z",
    keys: [
      [0, -0.95],
      [1.1, 0.65],
      [3.7, 0.65],
      [4.5, -0.95],
      [5, -0.95],
    ],
  },
  {
    target: "rightUpperArm.x",
    keys: [
      [0, 0],
      [1.1, -0.25],
      [4.5, 0],
    ],
  },
  {
    target: "rightLowerArm.z",
    keys: [
      [1.1, 0.2],
      [1.7, 0.7],
      [2.2, -0.2],
      [2.7, 0.7],
      [3.2, -0.2],
      [3.7, 0.3],
    ],
  },
  {
    target: "head.y",
    keys: [
      [0, 0.16],
      [1.0, -0.04],
      [3.6, -0.04],
      [5, 0.16],
    ],
  },
  {
    target: "head.x",
    keys: [
      [0, 0.02],
      [2.5, -0.06],
      [5, 0.02],
    ],
  },
  {
    target: "head.z",
    keys: [
      [0, 0],
      [1.4, 0.06],
      [3.4, -0.04],
      [5, 0],
    ],
  },
  {
    target: "spine.y",
    keys: [
      [0, 0],
      [2.5, 0.07],
      [5, 0],
    ],
  },
  {
    target: "chest.x",
    keys: [
      [0, 0],
      [1.2, 0.045],
      [2.4, 0],
      [3.6, 0.045],
      [5, 0],
    ],
  },
  {
    target: "expr.happy",
    keys: [
      [0, 0.06],
      [1.1, 0.85],
      [3.9, 0.85],
      [4.6, 0.18],
      [5, 0.06],
    ],
  },
  { target: "expr.relaxed", keys: [[0, 0.22]] },
];

const evalTrack = (keys: [number, number][], t: number): number => {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 0; i < keys.length - 1; ++i) {
    const [t0, v0] = keys[i]!;
    const [t1, v1] = keys[i + 1]!;
    if (t >= t0 && t <= t1) {
      let a = (t - t0) / (t1 - t0);
      a = a * a * (3 - 2 * a); // smoothstep
      return v0 + (v1 - v0) * a;
    }
  }
  return keys[keys.length - 1]![1];
};

const renderAt = (t: number, dt = 1 / 30): void => {
  if (vrm === null) return;
  const pose: Record<string, { x: number; y: number; z: number }> = {};
  const expr: Record<string, number> = {};
  for (const tr of TRACKS) {
    const v = evalTrack(tr.keys, t);
    const [a, b] = tr.target.split(".");
    if (a === "expr") expr[b!] = v;
    else (pose[a!] ??= { x: 0, y: 0, z: 0 })[b as "x" | "y" | "z"] = v;
  }
  const h = vrm.humanoid;
  for (const bone in pose) {
    const node = h.getNormalizedBoneNode(bone as VRMHumanBoneName);
    if (node) node.rotation.set(pose[bone]!.x, pose[bone]!.y, pose[bone]!.z);
  }
  const em = vrm.expressionManager;
  if (em) {
    for (const k of EXPR) em.setValue(k, expr[k] ?? 0);
    em.setValue("blink", Math.max(0, 1 - Math.abs(((t % 2.6) - 0.12) * 14)));
  }
  gaze.position.set(camera.position.x, camera.position.y, camera.position.z);
  if (vrm.lookAt) vrm.lookAt.target = gaze;
  vrm.update(dt);
  gl.render(scene, camera);
};

// deterministic capture entry for the headless harness
(window as unknown as { __renderAt: (t: number) => void }).__renderAt = (t) =>
  renderAt(t, 1 / 30);
const capture = new URLSearchParams(location.search).has("capture");

const loader = new GLTFLoader();
loader.register((p) => new VRMLoaderPlugin(p));
loader.load("/models/Vita.vrm", (gltf) => {
  const v = gltf.userData.vrm as VRM;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(v);
  v.scene.traverse((o) => (o.frustumCulled = false));
  scene.add(v.scene);
  vrm = v;
  renderAt(0);
  (window as unknown as { __automovie: Record<string, unknown> }).__automovie = {
    ready: true,
    duration: DURATION,
  };
});

// live playback (skipped in ?capture mode so the harness drives time exactly)
const clock = new THREE.Clock();
const tick = (): void => {
  requestAnimationFrame(tick);
  if (!capture && vrm !== null) renderAt(clock.getElapsedTime() % DURATION);
};
tick();
