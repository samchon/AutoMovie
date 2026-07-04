import { Matrix4, resolveFrame } from "@automovie/engine";
import { IAutoMovieIKDriver, IAutoMovieNode } from "@automovie/interface";
import { mountViewer } from "@automovie/viewer";
import * as THREE from "three";

// ── a core-node scene: a 3-bone arm (shoulder → elbow → wrist) + a goal ──────
const IDENTITY = {
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const node = (
  id: string,
  parent: string | null,
  x: number,
  y: number,
  z: number,
): IAutoMovieNode => ({
  id,
  name: null,
  parent,
  kind: "bone",
  transform: { translation: { x, y, z }, ...IDENTITY },
  mesh: null,
  camera: null,
  light: null,
  skin: null,
});

const target = node("target", null, 1.6, 0.8, 0.6);
const nodes: IAutoMovieNode[] = [
  node("shoulder", null, 0, 0.9, 0),
  node("elbow", "shoulder", 1.2, 0, 0), // upper-arm length 1.2
  node("wrist", "elbow", 1.0, 0, 0), // forearm length 1.0
  target,
];

const ik: IAutoMovieIKDriver = {
  type: "ik",
  chain: ["shoulder", "elbow", "wrist"],
  goal: "target",
  pole: null,
  solver: "twoBone",
  iterations: null,
  influence: 1,
};

// ── three.js scaffolding ─────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x191c22);
scene.add(new THREE.GridHelper(6, 12, 0x445066, 0x2a3040));
scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(2, 4, 3);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
camera.position.set(1.0, 1.4, 3.4);
camera.lookAt(0.8, 0.7, 0);

const joint = (color: number, r: number): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );

const dots: Record<string, THREE.Mesh> = {
  shoulder: joint(0x6f9dff, 0.08),
  elbow: joint(0x6f9dff, 0.07),
  wrist: joint(0x9ad0ff, 0.06),
};
Object.values(dots).forEach((m) => scene.add(m));

const goalDot = joint(0xff5d5d, 0.07);
scene.add(goalDot);

const boneMat = new THREE.LineBasicMaterial({ color: 0xcfe0ff });
const boneGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
]);
scene.add(new THREE.Line(boneGeo, boneMat));

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <style>
    body { margin: 0; font: 13px system-ui, sans-serif; color: #dfe3ea; }
    #view { width: 100vw; height: 100vh; display: block; }
    #cap { position: fixed; top: 14px; left: 16px; max-width: 360px; }
    #cap h1 { font-size: 15px; margin: 0 0 4px; }
    #cap p { margin: 0; color: #9aa3b2; }
  </style>
  <canvas id="view"></canvas>
  <div id="cap">
    <h1>automovie · engine drivers</h1>
    <p>Two-bone IK (the core resolver) bends a 3-joint arm so its wrist tracks
       the red goal, recomputed every frame. No AI — just resolveFrame.</p>
  </div>
`;
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;

const pos = (world: Map<string, number[]>, id: string): THREE.Vector3 => {
  const p = Matrix4.position(world.get(id)!);
  return new THREE.Vector3(p.x, p.y, p.z);
};

let frame = 0;
mountViewer(canvas, scene, camera, (elapsed) => {
  // sweep the goal through a circle the arm can mostly reach
  target.transform.translation = {
    x: 1.4 + 0.5 * Math.cos(elapsed * 1.3),
    y: 0.9 + 0.6 * Math.sin(elapsed * 1.3),
    z: 0.4 * Math.sin(elapsed * 0.7),
  };

  const { world } = resolveFrame({
    nodes,
    clip: null,
    limits: [],
    drivers: [ik],
    seconds: 0,
  });

  const s = pos(world, "shoulder");
  const e = pos(world, "elbow");
  const w = pos(world, "wrist");
  dots.shoulder!.position.copy(s);
  dots.elbow!.position.copy(e);
  dots.wrist!.position.copy(w);
  goalDot.position.copy(pos(world, "target"));
  boneGeo.setFromPoints([s, e, w]);
  boneGeo.attributes.position!.needsUpdate = true;

  frame++;
});

// headless-verification hook
(window as unknown as { __automovie: unknown }).__automovie = {
  ready: true,
  frames: () => frame,
};
