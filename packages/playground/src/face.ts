import { validateFaceResult } from "@autofilm/engine";
import {
  CANONICAL_FACE_INDICES,
  CANONICAL_FACE_POSITIONS,
  CANONICAL_FACE_UVS,
  buildFaceMorphs,
} from "@autofilm/forge";
import {
  AutoFilmFaceParameterName,
  IAutoFilmFaceParameter,
} from "@autofilm/interface";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// The face editor end to end, no asset files: the canonical base and the 17
// morph targets come straight out of @autofilm/forge, the sliders ARE an
// IAutoFilmFace document (validated by the engine on every change), and
// three.js plays the weights as standard morph-target influences.

// ── scene + lighting ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c2027);
scene.add(new THREE.HemisphereLight(0xffffff, 0x47506a, 1.2));
const key = new THREE.DirectionalLight(0xfff2e2, 1.6);
key.position.set(0.6, 0.5, 1.4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd2ff, 0.7);
rim.position.set(-0.8, 0.4, -1.0);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 10);
camera.position.set(0.05, 0.02, 0.55);
camera.lookAt(0, 0, 0);

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.35 system-ui, sans-serif; color: #e6e9ef; }
    #stage { display: grid; grid-template-columns: 1fr 310px; height: 100vh; }
    #view { width: 100%; height: 100%; display: block; background: #1c2027; }
    #panel { background: #14171c; border-left: 1px solid #2a2f37; padding: 12px 14px; overflow-y: auto; }
    #panel h1 { font-size: 15px; margin: 0 0 2px; }
    #panel .sub { color: #8b93a1; font-size: 11px; margin-bottom: 10px; }
    .row { margin: 6px 0; }
    .row label { display: flex; justify-content: space-between; }
    .row label span:last-child { color: #9aa3b2; font-variant-numeric: tabular-nums; }
    .row input { width: 100%; accent-color: #6f9dff; }
    #doc { margin-top: 10px; padding: 8px; background: #0e1014; border-radius: 6px;
           color: #9aa3b2; font: 11px/1.5 ui-monospace, monospace; white-space: pre-wrap; }
  </style>
  <div id="stage">
    <canvas id="view"></canvas>
    <div id="panel">
      <h1>autofilm · face editor</h1>
      <div class="sub" id="status">canonical base + 17 sliders, all from @autofilm/forge</div>
      <div id="morphs"></div>
      <div id="doc"></div>
    </div>
  </div>
`;
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const status = document.querySelector<HTMLElement>("#status")!;
const doc = document.querySelector<HTMLElement>("#doc")!;
const gl = new THREE.WebGLRenderer({ canvas, antialias: true });
const resize = (): void => {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  gl.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
};
gl.setPixelRatio(1);
resize();
window.addEventListener("resize", resize);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.update();
// expose for the headless screenshot harness
(window as unknown as { __cam: unknown }).__cam = {
  set: (
    px: number,
    py: number,
    pz: number,
    tx: number,
    ty: number,
    tz: number,
  ) => {
    camera.position.set(px, py, pz);
    controls.target.set(tx, ty, tz);
    controls.update();
  },
};

// ── face mesh from forge ─────────────────────────────────────────────────────
const morphs = buildFaceMorphs();
const NAMES = Object.keys(morphs) as AutoFilmFaceParameterName[];

const geometry = new THREE.BufferGeometry();
geometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(CANONICAL_FACE_POSITIONS, 3),
);
geometry.setAttribute(
  "uv",
  new THREE.Float32BufferAttribute(CANONICAL_FACE_UVS, 2),
);
geometry.setIndex(CANONICAL_FACE_INDICES);
// glTF-style DELTA morph targets (three defaults to absolute ones)
geometry.morphTargetsRelative = true;
geometry.morphAttributes.position = NAMES.map(
  (name) => new THREE.Float32BufferAttribute(morphs[name], 3),
);
geometry.computeVertexNormals();

const mesh = new THREE.Mesh(
  geometry,
  new THREE.MeshStandardMaterial({
    color: 0xd6d6dd,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  }),
);
mesh.morphTargetInfluences = NAMES.map(() => 0);
scene.add(mesh);

// ── sliders = the IAutoFilmFace document ─────────────────────────────────────
const weights = new Map<AutoFilmFaceParameterName, number>();

const refresh = (): void => {
  const parameters: IAutoFilmFaceParameter[] = [...weights.entries()]
    .filter(([, w]) => w !== 0)
    .map(([parameter, weight]) => ({ parameter, weight }));
  const result = validateFaceResult({ parameters });
  status.textContent = result.success
    ? `valid IAutoFilmFace — ${parameters.length} parameter(s) set`
    : `INVALID: ${result.violations[0]!.expected}`;
  doc.textContent = JSON.stringify({ parameters }, null, 1);
};
refresh();

for (const [idx, name] of NAMES.entries()) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label><span>${name}</span><span class="v">0.00</span></label>
    <input type="range" min="-2" max="2" step="0.05" value="0" />`;
  const input = row.querySelector("input")!;
  const out = row.querySelector(".v")!;
  input.addEventListener("input", () => {
    const w = Number(input.value);
    mesh.morphTargetInfluences![idx] = w;
    weights.set(name, w);
    out.textContent = w.toFixed(2);
    geometry.computeVertexNormals();
    refresh();
  });
  document.querySelector("#morphs")!.appendChild(row);
}

// expose programmatic control for the screenshot harness
(window as unknown as { __setFace: unknown }).__setFace = (
  params: Partial<Record<AutoFilmFaceParameterName, number>>,
): void => {
  NAMES.forEach((name, idx) => {
    const w = params[name] ?? 0;
    mesh.morphTargetInfluences![idx] = w;
    weights.set(name, w);
    const row = document.querySelectorAll("#morphs .row")[idx]!;
    (row.querySelector("input") as HTMLInputElement).value = String(w);
    row.querySelector(".v")!.textContent = w.toFixed(2);
  });
  geometry.computeVertexNormals();
  refresh();
};

// ── loop ─────────────────────────────────────────────────────────────────────
const tick = (): void => {
  controls.update();
  gl.render(scene, camera);
  requestAnimationFrame(tick);
};
tick();
