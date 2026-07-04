import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from "@pixiv/three-vrm";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ?? scene + lighting (soft 3-point) ??????????????????????????????????????????
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

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 0.98, 2.7);
camera.lookAt(0, 0.92, 0);

let vrm: VRM | null = null;
let autoBlink = true;
let lookAtViewer = true;
let clothesOn = true;
let clothing: THREE.Object3D[] = [];

// editor state
const exprState: Record<string, number> = {};
const poseState: Record<string, { x: number; y: number; z: number }> = {};
const scaleState: Record<string, number> = {};

const setPose = (b: string, axis: "x" | "y" | "z", v: number): void => {
  (poseState[b] ??= { x: 0, y: 0, z: 0 })[axis] = v;
};

// ?? editor UI shell ??????????????????????????????????????????????????????????
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.35 system-ui, sans-serif; color: #e6e9ef; }
    #stage { display: grid; grid-template-columns: 1fr 320px; height: 100vh; }
    #view { width: 100%; height: 100%; display: block; background: #1d2129; }
    #panel { background: #14171c; border-left: 1px solid #2a2f37; padding: 12px 14px; overflow-y: auto; }
    #panel h1 { font-size: 15px; margin: 0 0 2px; }
    #panel .sub { color: #8b93a1; font-size: 11px; margin-bottom: 10px; }
    details { border-top: 1px solid #242a33; padding: 4px 0; }
    summary { cursor: pointer; font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
              color: #8da0bd; padding: 6px 0; user-select: none; }
    .row { margin: 4px 0; }
    .row label { display: flex; justify-content: space-between; }
    .row label span:last-child { color: #9aa3b2; font-variant-numeric: tabular-nums; }
    .row input[type=range] { width: 100%; accent-color: #6f9dff; height: 16px; }
    .tog { display:flex; gap:8px; align-items:center; margin:5px 0; }
    .grp { columns: 1; }
  </style>
  <div id="stage">
    <canvas id="view"></canvas>
    <div id="panel">
      <h1>automovie 쨌 human editor</h1>
      <div class="sub" id="status">loading model??/div>
      <div class="tog"><input type="checkbox" id="clothes" checked/><label for="clothes">Clothes</label></div>
      <div class="tog"><input type="checkbox" id="look" checked/><label for="look">Look at viewer</label></div>
      <div class="tog"><input type="checkbox" id="blink" checked/><label for="blink">Auto-blink</label></div>
      <details open><summary>Expression</summary><div id="expr" class="grp"></div></details>
      <details open><summary>Proportions (bone scale)</summary><div id="prop" class="grp"></div></details>
      <details open><summary>Pose ??head &amp; torso</summary><div id="pose-core" class="grp"></div></details>
      <details><summary>Pose ??arms</summary><div id="pose-arms" class="grp"></div></details>
      <details><summary>Pose ??legs</summary><div id="pose-legs" class="grp"></div></details>
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

const slider = (
  host: Element,
  label: string,
  min: number,
  max: number,
  val: number,
  step: number,
  set: (n: number) => void,
): void => {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label><span>${label}</span><span class="v">${val.toFixed(2)}</span></label>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" />`;
  const input = row.querySelector("input")!;
  const out = row.querySelector(".v")!;
  input.addEventListener("input", () => {
    const n = Number(input.value);
    set(n);
    out.textContent = n.toFixed(2);
  });
  host.appendChild(row);
};

// ?? control definitions ??????????????????????????????????????????????????????
const EXPRESSIONS = [
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
];

interface PoseSpec {
  bone: VRMHumanBoneName;
  axis: "x" | "y" | "z";
  label: string;
  min: number;
  max: number;
  def?: number;
}
const ARM = 0.95; // default arms-down
const POSE_CORE: PoseSpec[] = [
  { bone: "head", axis: "x", label: "Head nod", min: -0.5, max: 0.5 },
  { bone: "head", axis: "y", label: "Head turn", min: -0.7, max: 0.7 },
  { bone: "head", axis: "z", label: "Head tilt", min: -0.4, max: 0.4 },
  { bone: "neck", axis: "x", label: "Neck nod", min: -0.4, max: 0.4 },
  { bone: "spine", axis: "x", label: "Spine bend", min: -0.4, max: 0.4 },
  { bone: "spine", axis: "y", label: "Spine twist", min: -0.5, max: 0.5 },
  { bone: "chest", axis: "x", label: "Chest bend", min: -0.3, max: 0.3 },
  { bone: "hips", axis: "y", label: "Hips turn", min: -0.6, max: 0.6 },
];
const ARMS: PoseSpec[] = [
  {
    bone: "leftUpperArm",
    axis: "z",
    label: "L arm down",
    min: -1.4,
    max: 0.2,
    def: ARM,
  },
  {
    bone: "leftUpperArm",
    axis: "x",
    label: "L arm forward",
    min: -1.0,
    max: 1.0,
  },
  { bone: "leftLowerArm", axis: "y", label: "L elbow", min: -1.6, max: 0 },
  { bone: "leftHand", axis: "z", label: "L wrist", min: -0.7, max: 0.7 },
  {
    bone: "rightUpperArm",
    axis: "z",
    label: "R arm down",
    min: -0.2,
    max: 1.4,
    def: -ARM,
  },
  {
    bone: "rightUpperArm",
    axis: "x",
    label: "R arm forward",
    min: -1.0,
    max: 1.0,
  },
  { bone: "rightLowerArm", axis: "y", label: "R elbow", min: 0, max: 1.6 },
  { bone: "rightHand", axis: "z", label: "R wrist", min: -0.7, max: 0.7 },
];
const LEGS: PoseSpec[] = [
  {
    bone: "leftUpperLeg",
    axis: "x",
    label: "L hip raise",
    min: -0.6,
    max: 1.4,
  },
  {
    bone: "leftUpperLeg",
    axis: "z",
    label: "L hip spread",
    min: -0.3,
    max: 0.6,
  },
  { bone: "leftLowerLeg", axis: "x", label: "L knee", min: -2.0, max: 0 },
  { bone: "leftFoot", axis: "x", label: "L ankle", min: -0.6, max: 0.6 },
  {
    bone: "rightUpperLeg",
    axis: "x",
    label: "R hip raise",
    min: -0.6,
    max: 1.4,
  },
  {
    bone: "rightUpperLeg",
    axis: "z",
    label: "R hip spread",
    min: -0.6,
    max: 0.3,
  },
  { bone: "rightLowerLeg", axis: "x", label: "R knee", min: -2.0, max: 0 },
  { bone: "rightFoot", axis: "x", label: "R ankle", min: -0.6, max: 0.6 },
];

interface ScaleSpec {
  bones: VRMHumanBoneName[];
  label: string;
}
const PROPS: ScaleSpec[] = [
  { bones: ["hips"], label: "Height" },
  { bones: ["head"], label: "Head size" },
  { bones: ["neck"], label: "Neck length" },
  { bones: ["chest", "spine"], label: "Torso" },
  { bones: ["leftHand", "rightHand"], label: "Hand size" },
  { bones: ["leftFoot", "rightFoot"], label: "Foot size" },
  {
    bones: ["leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm"],
    label: "Arm thickness",
  },
  {
    bones: ["leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"],
    label: "Leg thickness",
  },
];

// ?? build editor after load ??????????????????????????????????????????????????
const mountEditor = (): void => {
  // expressions present on the model
  const em = vrm?.expressionManager;
  const exprHost = document.querySelector("#expr")!;
  for (const name of EXPRESSIONS)
    if (em?.getExpression(name)) {
      exprState[name] = 0;
      slider(exprHost, name, 0, 1, 0, 0.01, (n) => (exprState[name] = n));
    }

  // proportions (uniform bone scale, 0.7..1.5)
  const propHost = document.querySelector("#prop")!;
  for (const p of PROPS) {
    for (const b of p.bones) scaleState[b] = 1;
    slider(propHost, p.label, 0.7, 1.5, 1, 0.01, (n) => {
      for (const b of p.bones) scaleState[b] = n;
    });
  }

  // pose, grouped
  const mountPose = (specs: PoseSpec[], host: Element): void => {
    for (const s of specs) {
      const def = s.def ?? 0;
      setPose(s.bone, s.axis, def);
      slider(host, s.label, s.min, s.max, def, 0.01, (n) =>
        setPose(s.bone, s.axis, n),
      );
    }
  };
  mountPose(POSE_CORE, document.querySelector("#pose-core")!);
  mountPose(ARMS, document.querySelector("#pose-arms")!);
  mountPose(LEGS, document.querySelector("#pose-legs")!);

  // toggles
  document
    .querySelector<HTMLInputElement>("#clothes")!
    .addEventListener(
      "change",
      (e) => (clothesOn = (e.target as HTMLInputElement).checked),
    );
  document
    .querySelector<HTMLInputElement>("#look")!
    .addEventListener(
      "change",
      (e) => (lookAtViewer = (e.target as HTMLInputElement).checked),
    );
  document
    .querySelector<HTMLInputElement>("#blink")!
    .addEventListener(
      "change",
      (e) => (autoBlink = (e.target as HTMLInputElement).checked),
    );
};

// ?? load the VRM ?????????????????????????????????????????????????????????????
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));
const gazeTarget = new THREE.Object3D();
scene.add(gazeTarget);

loader.load(
  "/models/Vita.vrm",
  (gltf) => {
    const loaded = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    VRMUtils.rotateVRM0(loaded);
    loaded.scene.traverse((o) => {
      o.frustumCulled = false;
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      const named = Array.isArray(mat) ? mat[0]?.name : mat?.name;
      if (named && named.includes("CLOTH")) clothing.push(o);
    });
    scene.add(loaded.scene);
    if (loaded.lookAt) loaded.lookAt.target = gazeTarget;
    vrm = loaded;
    // Model "Vita" ??VRoid sample, CC0 (public domain): fully MIT-compatible.
    status.textContent = "Model: Vita 쨌 CC0 (public domain)";
    mountEditor();
    (window as unknown as { __automovie: Record<string, unknown> }).__automovie =
      {
        ready: true,
      };
  },
  undefined,
  (err) => (status.textContent = "load error: " + String(err)),
);

// ?? render loop ??????????????????????????????????????????????????????????????
const clock = new THREE.Clock();
let elapsed = 0;
const tick = (): void => {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  elapsed += dt;

  if (vrm !== null) {
    const h = vrm.humanoid;
    // proportions: scale on the RAW skeleton (the normalized rig drives only
    // rotation, so scale set here persists through vrm.update).
    for (const bone in scaleState) {
      const raw = h.getRawBoneNode(bone as VRMHumanBoneName);
      if (raw !== null) raw.scale.setScalar(scaleState[bone]!);
    }
    // pose: rotation on the normalized rig.
    for (const bone in poseState) {
      const node = h.getNormalizedBoneNode(bone as VRMHumanBoneName);
      const r = poseState[bone]!;
      if (node !== null) node.rotation.set(r.x, r.y, r.z);
    }
    // expressions + blink
    const em = vrm.expressionManager;
    if (em) {
      for (const name in exprState) em.setValue(name, exprState[name]!);
      em.setValue(
        "blink",
        autoBlink ? Math.max(0, 1 - Math.abs(((elapsed % 3.2) - 0.1) * 12)) : 0,
      );
    }
    // gaze
    gazeTarget.position.set(
      camera.position.x + Math.sin(elapsed * 0.6) * 0.25,
      camera.position.y,
      lookAtViewer ? camera.position.z : -5,
    );
    for (const o of clothing) o.visible = clothesOn;

    vrm.update(dt);
  }
  gl.render(scene, camera);
};
tick();
