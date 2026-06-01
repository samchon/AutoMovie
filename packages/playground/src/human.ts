import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ── scene + lighting (soft 3-point) ──────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2129);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4f60, 1.35));
const key = new THREE.DirectionalLight(0xfff4e6, 1.55);
key.position.set(1.6, 2.6, 2.4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
fill.position.set(-2.2, 1.4, 1.2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xbcd2ff, 0.9);
rim.position.set(-0.6, 2.4, -2.6);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
camera.position.set(0, 1.34, 2.15);
camera.lookAt(0, 1.26, 0);

let vrm: VRM | null = null;
let autoBlink = true;
let lookAtViewer = true;

// ── editor UI ────────────────────────────────────────────────────────────────
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 13px/1.4 system-ui, sans-serif; color: #e6e9ef; }
    #stage { display: grid; grid-template-columns: 1fr 300px; height: 100vh; }
    #view { width: 100%; height: 100%; display: block; background: #1d2129; }
    #panel { background: #14171c; border-left: 1px solid #2a2f37; padding: 14px; overflow-y: auto; }
    #panel h1 { font-size: 15px; margin: 0 0 2px; }
    #panel .sub { color: #8b93a1; font-size: 11px; margin-bottom: 12px; }
    #panel h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #7f8a9c; margin: 16px 0 6px; }
    .row { margin: 7px 0; }
    .row label { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .row label span:last-child { color: #9aa3b2; font-variant-numeric: tabular-nums; }
    .row input[type=range] { width: 100%; accent-color: #6f9dff; }
    .tog { display:flex; gap:8px; align-items:center; margin:6px 0; }
  </style>
  <div id="stage">
    <canvas id="view"></canvas>
    <div id="panel">
      <h1>motica · human editor</h1>
      <div class="sub" id="status">loading model…</div>
      <h2>Expression</h2>
      <div id="expr"></div>
      <h2>Pose &amp; gaze</h2>
      <div id="pose"></div>
    </div>
  </div>
`;
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const status = document.querySelector<HTMLElement>("#status")!;

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

// expression sliders
const exprState: Record<string, number> = {};
const EXPRESSIONS = ["happy", "angry", "sad", "relaxed", "Surprised"];
const mountExpr = (): void => {
  const host = document.querySelector("#expr")!;
  for (const name of EXPRESSIONS) {
    exprState[name] = 0;
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label><span>${name}</span><span class="v">0.00</span></label>
      <input type="range" min="0" max="1" step="0.01" value="0" />`;
    const input = row.querySelector("input")!;
    const out = row.querySelector(".v")!;
    input.addEventListener("input", () => {
      exprState[name] = Number(input.value);
      out.textContent = Number(input.value).toFixed(2);
    });
    host.appendChild(row);
  }
};

// pose / gaze controls
let headYaw = 0;
let armDown = 0.95;
const mountPose = (): void => {
  const host = document.querySelector("#pose")!;
  const slider = (
    label: string,
    min: number,
    max: number,
    val: number,
    set: (n: number) => void,
  ): void => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label><span>${label}</span><span class="v">${val.toFixed(2)}</span></label>
      <input type="range" min="${min}" max="${max}" step="0.01" value="${val}" />`;
    const input = row.querySelector("input")!;
    const out = row.querySelector(".v")!;
    input.addEventListener("input", () => {
      set(Number(input.value));
      out.textContent = Number(input.value).toFixed(2);
    });
    host.appendChild(row);
  };
  slider("Head turn", -0.6, 0.6, 0, (n) => (headYaw = n));
  slider("Arms down", 0, 1.3, armDown, (n) => (armDown = n));

  const toggle = (
    label: string,
    val: boolean,
    set: (b: boolean) => void,
  ): void => {
    const row = document.createElement("div");
    row.className = "tog";
    row.innerHTML = `<input type="checkbox" ${val ? "checked" : ""}/><span>${label}</span>`;
    const input = row.querySelector("input")!;
    input.addEventListener("change", () => set(input.checked));
    host.appendChild(row);
  };
  toggle("Look at viewer", lookAtViewer, (b) => (lookAtViewer = b));
  toggle("Auto-blink", autoBlink, (b) => (autoBlink = b));
};

// ── load the VRM ─────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
const gazeTarget = new THREE.Object3D();
scene.add(gazeTarget);

loader.load(
  "/models/AvatarSample_A.vrm",
  (gltf) => {
    const loaded = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(loaded);
    loaded.scene.traverse((o) => (o.frustumCulled = false));
    scene.add(loaded.scene);
    if (loaded.lookAt) loaded.lookAt.target = gazeTarget;
    vrm = loaded;
    status.textContent = "AvatarSample_A · VRoid";
    mountExpr();
    mountPose();
    (window as unknown as { __motica: Record<string, unknown> }).__motica = {
      ready: true,
    };
  },
  undefined,
  (err) => (status.textContent = "load error: " + String(err)),
);

// ── render loop ──────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;
const tick = (): void => {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  elapsed += dt;

  if (vrm !== null) {
    // expressions
    const em = vrm.expressionManager;
    if (em) {
      for (const name of EXPRESSIONS) em.setValue(name, exprState[name] ?? 0);
      const blink = autoBlink
        ? Math.max(0, 1 - Math.abs(((elapsed % 3.2) - 0.1) * 12))
        : 0;
      em.setValue("blink", blink);
    }
    // pose: arms down + head turn, on the normalized rig
    const h = vrm.humanoid;
    const lUp = h.getNormalizedBoneNode("leftUpperArm");
    const rUp = h.getNormalizedBoneNode("rightUpperArm");
    if (lUp !== null) lUp.rotation.z = armDown;
    if (rUp !== null) rUp.rotation.z = -armDown;
    const head = h.getNormalizedBoneNode("head");
    if (head !== null) head.rotation.y = headYaw;
    // gaze: a point near the camera, swaying slightly
    gazeTarget.position.set(
      camera.position.x + Math.sin(elapsed * 0.6) * 0.25,
      camera.position.y,
      lookAtViewer ? camera.position.z : -5,
    );

    vrm.update(dt);
  }
  gl.render(scene, camera);
};
tick();
