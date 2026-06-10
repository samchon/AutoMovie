import { validateFaceResult } from "@autofilm/engine";
import {
  CANONICAL_FACE_INDICES,
  CANONICAL_FACE_POSITIONS,
  CANONICAL_FACE_UVS,
  IForgeHairParameters,
  IForgeSkullParameters,
  IForgeTailParameters,
  buildEyeShells,
  buildFaceMorphs,
  buildHairShell,
  buildHairTails,
  buildSkullShell,
} from "@autofilm/forge";
import { AutoFilmFaceParameterName, IAutoFilmFace } from "@autofilm/interface";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The character-head editor end to end, no asset files: face geometry + the
// 17 morph sliders, the parametric skull/hair shells, and the region colors
// all come from pure parameters — a character preset is one JSON document.

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
camera.position.set(0.05, 0.03, 0.62);
camera.lookAt(0, 0.02, 0);

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.35 system-ui, sans-serif; color: #e6e9ef; }
    #stage { display: grid; grid-template-columns: 1fr 310px; height: 100vh; }
    #view { width: 100%; height: 100%; display: block; background: #1c2027; }
    #panel { background: #14171c; border-left: 1px solid #2a2f37; padding: 12px 14px; overflow-y: auto; }
    #panel h1 { font-size: 15px; margin: 0 0 2px; }
    #panel h2 { font-size: 12px; margin: 12px 0 4px; color: #aab3c5; }
    #panel .sub { color: #8b93a1; font-size: 11px; margin-bottom: 10px; }
    .row { margin: 6px 0; }
    .row label { display: flex; justify-content: space-between; }
    .row label span:last-child { color: #9aa3b2; font-variant-numeric: tabular-nums; }
    .row input[type=range] { width: 100%; accent-color: #6f9dff; }
    .colors { display: flex; gap: 10px; }
    .colors label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #9aa3b2; }
    button { background:#222a36; color:#e6e9ef; border:1px solid #2a2f37; border-radius:4px; padding:3px 10px; margin-right:4px; cursor:pointer; }
    select { width: 100%; background: #0e1014; color: #e6e9ef; border: 1px solid #2a2f37;
             border-radius: 4px; padding: 4px; }
    #doc { margin-top: 10px; padding: 8px; background: #0e1014; border-radius: 6px;
           color: #9aa3b2; font: 10px/1.45 ui-monospace, monospace; white-space: pre-wrap; }
  </style>
  <div id="stage">
    <div style="position:relative">
      <canvas id="view"></canvas>
      <img id="ref" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0;pointer-events:none" />
    </div>
    <div id="panel">
      <h1>autofilm · face editor</h1>
      <div class="sub" id="status">pure-parameter character head</div>
      <h2>workbench</h2>
      <div class="row"><label><span>camera</span></label>
        <button data-cam="front">front</button>
        <button data-cam="q34">3/4</button>
        <button data-cam="side">side</button>
      </div>
      <div class="row"><label><span>reference overlay</span><span class="v" id="refv">off</span></label>
        <select id="refsel">
          <option value="">none</option>
          <option value="/models/hero1-ref-front.png">hero1 front</option>
          <option value="/models/hero1-ref-34.png">hero1 3/4</option>
          <option value="/models/hero1-ref-side.png">hero1 side</option>
        </select>
        <input id="refop" type="range" min="0" max="1" step="0.05" value="0.5" />
      </div>
      <div class="row"><label><span>photographed head</span></label>
        <input id="photohead" type="checkbox" /> show multi-view textured head
      </div>
      <h2>preset</h2>
      <select id="preset">
        <option value="neutral">neutral</option>
        <option value="hero1">hero/1</option>
        <option value="hero2">hero/2</option>
        <option value="hero3">hero/3</option>
      </select>
      <h2>face shape</h2>
      <div id="morphs"></div>
      <h2>identity (character data)</h2>
      <div id="identity"></div>
      <h2>skull</h2>
      <div id="skull"></div>
      <h2>hair</h2>
      <div id="hair"></div>
      <h2>tails</h2>
      <div id="tails"></div>
      <h2>colors</h2>
      <div class="colors">
        <label>skin<input type="color" id="cSkin" value="#e8c4ae" /></label>
        <label>hair<input type="color" id="cHair" value="#3a3027" /></label>
        <label>lips<input type="color" id="cLips" value="#c97a72" /></label>
        <label>iris<input type="color" id="cIris" value="#3a2a20" /></label>
      </div>
      <div id="doc"></div>
    </div>
  </div>
`;
const canvas = document.querySelector<HTMLCanvasElement>("#view")!;
const status = document.querySelector<HTMLElement>("#status")!;
const docOut = document.querySelector<HTMLElement>("#doc")!;
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
controls.target.set(0, 0.02, 0);
controls.enableDamping = true;
controls.update();
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

// ── face mesh (morphable, region-colored) ────────────────────────────────────
const morphs = buildFaceMorphs();
const NAMES = Object.keys(morphs) as AutoFilmFaceParameterName[];

const faceGeometry = new THREE.BufferGeometry();
faceGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(CANONICAL_FACE_POSITIONS, 3),
);
faceGeometry.setAttribute(
  "uv",
  new THREE.Float32BufferAttribute(CANONICAL_FACE_UVS, 2),
);
// cut the eyelid-cover triangles so the eyeballs read through the openings
const EYE_SETS = [
  new Set([
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  ]),
  new Set([
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
    398,
  ]),
];
const faceIndices: number[] = [];
for (let t = 0; t < CANONICAL_FACE_INDICES.length; t += 3) {
  const tri = [
    CANONICAL_FACE_INDICES[t]!,
    CANONICAL_FACE_INDICES[t + 1]!,
    CANONICAL_FACE_INDICES[t + 2]!,
  ];
  if (EYE_SETS.some((set) => tri.every((v) => set.has(v)))) continue;
  faceIndices.push(...tri);
}
faceGeometry.setIndex(faceIndices); // cut by default; photo mode restores covers
// glTF-style DELTA morph targets (three defaults to absolute ones)
faceGeometry.morphTargetsRelative = true;
const identityDelta = new Float32Array(CANONICAL_FACE_POSITIONS.length);
faceGeometry.morphAttributes.position = [
  ...NAMES.map((name) => new THREE.Float32BufferAttribute(morphs[name], 3)),
  new THREE.Float32BufferAttribute(identityDelta, 3),
];
const IDENTITY = NAMES.length; // morph slot of the per-character likeness
// likeness deltas are character DATA (not in the repo): loaded when present
let identityLoaded = false;
let identityUrl = "";
const loadIdentity = (url: string): Promise<void> => {
  if (url === identityUrl) return Promise.resolve();
  identityUrl = url;
  identityLoaded = false;
  identityDelta.fill(0);
  const done = (): void => {
    (
      faceGeometry.morphAttributes.position[IDENTITY] as THREE.BufferAttribute
    ).needsUpdate = true;
  };
  if (!url) {
    done();
    return Promise.resolve();
  }
  return fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { identity: number[] } | null) => {
      if (!j || identityUrl !== url) return;
      identityDelta.set(j.identity);
      identityLoaded = true;
    })
    .catch(() => undefined)
    .then(done);
};
void loadIdentity("/models/hero1-identity.json");
faceGeometry.computeVertexNormals();

// region weights for coloring: lips / brows / eye openings, gaussian-feathered
const LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37,
  39, 40, 185, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311,
  312, 13, 82, 81, 80, 191,
];
const BROWS = [
  70, 63, 105, 66, 107, 46, 53, 52, 65, 55, 300, 293, 334, 296, 336, 276, 283,
  282, 295, 285,
];
const EYES = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384,
  398,
];
const regionWeight = (
  pos: number[],
  seeds: number[],
  sigma: number,
): Float32Array => {
  const w = new Float32Array(468);
  for (let i = 0; i < 468; i++) {
    let best = Infinity;
    for (const sd of seeds) {
      const d2 =
        (pos[i * 3]! - pos[sd * 3]!) ** 2 +
        (pos[i * 3 + 1]! - pos[sd * 3 + 1]!) ** 2 +
        (pos[i * 3 + 2]! - pos[sd * 3 + 2]!) ** 2;
      if (d2 < best) best = d2;
    }
    w[i] = Math.exp(-best / (2 * sigma * sigma));
  }
  return w;
};

const colors = {
  skin: "#e8c4ae",
  hair: "#3a3027",
  lips: "#c97a72",
  iris: "#3a2a20",
};
const colorAttr = new THREE.Float32BufferAttribute(
  new Float32Array(468 * 3),
  3,
);
faceGeometry.setAttribute("color", colorAttr);
const paintFace = (): void => {
  const pos = morphedFacePositions();
  const lipW = regionWeight(pos, LIPS, 0.004);
  const browW = regionWeight(pos, BROWS, 0.004);
  const eyeW = regionWeight(pos, EYES, 0.0022);
  const skin = new THREE.Color(colors.skin);
  const lips = new THREE.Color(colors.lips);
  const brow = new THREE.Color(colors.hair).multiplyScalar(0.7);
  const eye = new THREE.Color("#4a3a30");
  const c = new THREE.Color();
  for (let i = 0; i < 468; i++) {
    c.copy(skin)
      .lerp(lips, lipW[i]!)
      .lerp(brow, browW[i]!)
      .lerp(eye, 0.45 * eyeW[i]!);
    colorAttr.setXYZ(i, c.r, c.g, c.b);
  }
  colorAttr.needsUpdate = true;
};

const faceMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.75,
  metalness: 0,
  side: THREE.DoubleSide,
});
const faceMesh = new THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
>(faceGeometry, faceMaterial);
// per-character photo skin baked into the canonical UV layout (character
// data, not in the repo): swaps in when present
let photoMaterialRef: THREE.MeshBasicMaterial | null = null;
const skinCache = new Map<string, THREE.Texture>();
const loadSkin = (url: string): THREE.Texture => {
  let t = skinCache.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url, matchSkullTone);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    skinCache.set(url, t);
  } else if (t.image) matchSkullTone(t);
  return t;
};
// the parametric skull/neck must wear the photographed person's skin tone or
// the face plate reads as a pasted mask — sample the skin texture's mean
// color (the canonical-UV bake is mostly facial skin) on load and apply it
// whenever photo-skin mode is on
let photoTone: THREE.Color | null = null;
let skinModeOn = false;
const applySkullTone = (): void => {
  skullMaterial.color.set(
    skinModeOn && photoTone ? photoTone : new THREE.Color(colors.skin),
  );
};
const matchSkullTone = (tex: THREE.Texture): void => {
  const im = tex.image as HTMLImageElement | undefined;
  if (!im || !im.width) return;
  const cv = document.createElement("canvas");
  const W = (cv.width = 64);
  const H = (cv.height = 64);
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(im, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! < 128) continue;
    r += d[i]!;
    g += d[i + 1]!;
    b += d[i + 2]!;
    n++;
  }
  if (n === 0) return;
  photoTone = new THREE.Color()
    .setRGB(r / n / 255, g / n / 255, b / n / 255)
    .convertSRGBToLinear();
  applySkullTone();
};
(window as unknown as { __loadSkin: unknown }).__loadSkin = (url: string) => {
  if (!photoMaterialRef) return;
  photoMaterialRef.map = loadSkin(url);
  photoMaterialRef.needsUpdate = true;
};
new THREE.TextureLoader().load("/models/hero1-face.png", (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // the bake uses the glTF top-left UV convention
  // UNLIT in photo mode: re-shading photographed pixels shifts how features
  // read (the detector-free overlay proved the data itself is pixel-exact)
  const photoMaterial = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
  });
  photoMaterialRef = photoMaterial;
  (window as unknown as { __setSkin: unknown }).__setSkin = (on: boolean) => {
    faceMesh.material = on ? photoMaterial : faceMaterial;
    // photo skin carries painted eyes: restore the lid covers, park the
    // sphere eyeballs; sculpt mode cuts the covers and brings them back
    faceGeometry.setIndex(on ? [...CANONICAL_FACE_INDICES] : faceIndices);
    for (const m of eyeMeshes) m.visible = !on;
    skinModeOn = on;
    applySkullTone();
    applyShellLighting();
  };
});
faceMesh.morphTargetInfluences = [...NAMES.map(() => 0), 0];
scene.add(faceMesh);

// ── parametric skull + hair ──────────────────────────────────────────────────
const skullParams: IForgeSkullParameters = { width: 0, crown: 0, depth: 0 };
const skullMaterial = new THREE.MeshStandardMaterial({
  color: colors.skin,
  roughness: 0.8,
  metalness: 0,
});
const skullUnlit = new THREE.MeshBasicMaterial({ color: colors.skin });
let skullMesh: THREE.Mesh | null = null;
const rebuildSkull = (): void => {
  if (skullMesh) {
    scene.remove(skullMesh);
    skullMesh.geometry.dispose();
  }
  const skull = buildSkullShell(skullParams);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(skull.positions, 3),
  );
  g.setIndex(skull.indices);
  g.computeVertexNormals();
  skullMesh = new THREE.Mesh(g, skinModeOn ? skullUnlit : skullMaterial);
  scene.add(skullMesh);
};
rebuildSkull();

const hairParams: IForgeHairParameters = {
  length: 0.4,
  volume: 0.4,
  bangs: 0.5,
  curtain: 0.5,
};
const hairMaterial = new THREE.MeshStandardMaterial({
  color: colors.hair,
  roughness: 0.38,
  metalness: 0.05,
  side: THREE.DoubleSide,
  vertexColors: true, // strand-wise light variation breaks the plastic look
});
// Paint per-strand lightness onto the hair shell so it reads as hair, not a
// molded helmet: clumps of strands vary in tone, a soft "angel ring"
// highlight bands the upper dome, and tips fall into shadow. The shell is a
// strand grid (yaw columns × descent rows); strand boundaries are where the
// vertex y jumps back UP (each strand descends monotonically from the crown).
const KEY_DIR = new THREE.Vector3(0.6, 0.5, 1.4).normalize();
const paintHairStrands = (g: THREE.BufferGeometry): void => {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const starts: number[] = [0];
  for (let i = 1; i < pos.count; i++)
    if (pos.getY(i) > pos.getY(i - 1) + 1e-6) starts.push(i);
  starts.push(pos.count);
  const hash = (n: number): number => {
    const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const color = new Float32Array(pos.count * 3);
  for (let s = 0; s < starts.length - 1; s++) {
    const a = starts[s]!;
    const b = starts[s + 1]!;
    const clump = hash(Math.floor(s / 4));
    const fine = hash(s);
    for (let i = a; i < b; i++) {
      const v = b - a > 1 ? (i - a) / (b - a - 1) : 0;
      let L = 0.52 + 0.42 * clump + 0.5 * fine;
      L += 0.85 * Math.exp(-(((v - 0.22) / 0.12) ** 2)); // angel-ring band
      L *= 1 - 0.3 * Math.min(1, Math.max(0, (v - 0.68) / 0.32)); // tip shade
      // baked key-light lambert: keeps the dome's form when the shell goes
      // unlit in photo mode (mild enough not to double-shade the lit mode)
      const ndl =
        nor.getX(i) * KEY_DIR.x +
        nor.getY(i) * KEY_DIR.y +
        nor.getZ(i) * KEY_DIR.z;
      L *= 0.62 + 0.38 * Math.max(0, ndl);
      color[i * 3] = L;
      color[i * 3 + 1] = L;
      color[i * 3 + 2] = L;
    }
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
};
const hairUnlit = new THREE.MeshBasicMaterial({
  color: colors.hair,
  side: THREE.DoubleSide,
  vertexColors: true,
});
// the photo-skin face is unlit (re-shading photographed pixels distorts), so
// in photo mode the skull/hair go unlit too — one exposure system, no
// glowing-mask contrast; the strand vertex colors carry the shading
const applyShellLighting = (): void => {
  skullUnlit.color.copy(skullMaterial.color);
  hairUnlit.color.copy(hairMaterial.color);
  if (skullMesh) skullMesh.material = skinModeOn ? skullUnlit : skullMaterial;
  if (hairMesh) hairMesh.material = skinModeOn ? hairUnlit : hairMaterial;
};
let hairMesh: THREE.Mesh | null = null;
const rebuildHair = (): void => {
  if (hairMesh) {
    scene.remove(hairMesh);
    hairMesh.geometry.dispose();
  }
  const hair = buildHairShell(hairParams, skullParams);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(hair.positions, 3),
  );
  g.setIndex(hair.indices);
  g.computeVertexNormals();
  paintHairStrands(g);
  hairMesh = new THREE.Mesh(g, skinModeOn ? hairUnlit : hairMaterial);
  scene.add(hairMesh);
};
rebuildHair();

const tailParams: IForgeTailParameters = {
  length: 0,
  height: 0.4,
  spread: 0.4,
  width: 0.5,
};
let tailMeshes: THREE.Mesh[] = [];
const rebuildTails = (): void => {
  for (const m of tailMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  tailMeshes = [];
  const { right, left } = buildHairTails(tailParams, skullParams);
  for (const part of [right, left]) {
    if (part.positions.length === 0) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    g.setIndex(part.indices);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, hairMaterial);
    scene.add(mesh);
    tailMeshes.push(mesh);
  }
};
rebuildTails();

// ── eyeballs (follow the morphed face; iris colored by frontness) ───────────
const eyeMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.25,
  metalness: 0,
});
let eyeMeshes: THREE.Mesh[] = [];
const morphedFacePositions = (): number[] => {
  const out = [...CANONICAL_FACE_POSITIONS];
  NAMES.forEach((name, m) => {
    const w = faceMesh.morphTargetInfluences![m]!;
    if (!w) return;
    const d = morphs[name];
    for (let k = 0; k < out.length; k++) out[k]! += w * d[k]!;
  });
  const wi = faceMesh.morphTargetInfluences![IDENTITY]!;
  if (wi)
    for (let k = 0; k < out.length; k++) out[k]! += wi * identityDelta[k]!;
  return out;
};
const rebuildEyes = (): void => {
  for (const m of eyeMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  eyeMeshes = [];
  const shells = buildEyeShells(morphedFacePositions());
  const sclera = new THREE.Color("#f3eee9");
  const iris = new THREE.Color(colors.iris);
  const pupil = new THREE.Color("#16100c");
  for (const eye of [shells.right, shells.left]) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(eye.positions, 3),
    );
    g.setIndex(eye.indices);
    g.computeVertexNormals();
    const n = eye.positions.length / 3;
    const col = new Float32Array(n * 3);
    const scz = eye.center[2] - eye.radius;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const f = (eye.positions[i * 3 + 2]! - scz) / eye.radius;
      c.copy(sclera);
      if (f > 0.906) c.copy(iris);
      if (f > 0.985) c.copy(pupil);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(g, eyeMaterial);
    scene.add(mesh);
    eyeMeshes.push(mesh);
  }
};
rebuildEyes();
paintFace();

// ── document panel ───────────────────────────────────────────────────────────
const weights = new Map<AutoFilmFaceParameterName, number>();
// slider (morph target) name → its leaf in the anatomy-shaped document
const NEST: Record<
  AutoFilmFaceParameterName,
  (f: IAutoFilmFace, w: number) => void
> = {
  faceWidth: (f, w) => (f.width = w),
  faceLength: (f, w) => (f.length = w),
  cheekFullness: (f, w) => ((f.cheeks ??= {}).fullness = w),
  jawWidth: (f, w) => ((f.jaw ??= {}).width = w),
  chinLength: (f, w) => (((f.jaw ??= {}).chin ??= {}).length = w),
  chinProtrusion: (f, w) => (((f.jaw ??= {}).chin ??= {}).protrusion = w),
  eyeSize: (f, w) => ((f.eyes ??= {}).size = w),
  eyeWidth: (f, w) => ((f.eyes ??= {}).width = w),
  eyeSpacing: (f, w) => ((f.eyes ??= {}).spacing = w),
  eyeHeight: (f, w) => ((f.eyes ??= {}).height = w),
  eyeTilt: (f, w) => ((f.eyes ??= {}).tilt = w),
  browHeight: (f, w) => ((f.brows ??= {}).height = w),
  noseLength: (f, w) => ((f.nose ??= {}).length = w),
  noseWidth: (f, w) => ((f.nose ??= {}).width = w),
  noseProjection: (f, w) => ((f.nose ??= {}).projection = w),
  mouthWidth: (f, w) => ((f.mouth ??= {}).width = w),
  mouthHeight: (f, w) => ((f.mouth ??= {}).height = w),
  lipFullness: (f, w) => (((f.mouth ??= {}).lips ??= {}).fullness = w),
};
const refresh = (): void => {
  const face: IAutoFilmFace = {};
  let count = 0;
  for (const [parameter, weight] of weights.entries())
    if (weight !== 0) {
      NEST[parameter](face, weight);
      count++;
    }
  const result = validateFaceResult(face);
  status.textContent = result.success
    ? `valid IAutoFilmFace — ${count} trait(s) set`
    : `INVALID: ${result.violations[0]!.expected}`;
  docOut.textContent = JSON.stringify(
    {
      face,
      skull: skullParams,
      hair: hairParams,
      tails: tailParams,
      colors,
    },
    null,
    1,
  );
};
refresh();

// ── controls ─────────────────────────────────────────────────────────────────
const slider = (
  host: string,
  label: string,
  min: number,
  max: number,
  value: number,
  set: (n: number) => void,
): HTMLInputElement => {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label><span>${label}</span><span class="v">${value.toFixed(2)}</span></label>
    <input type="range" min="${min}" max="${max}" step="0.05" value="${value}" />`;
  const input = row.querySelector("input")!;
  const out = row.querySelector(".v")!;
  input.addEventListener("input", () => {
    const n = Number(input.value);
    set(n);
    out.textContent = n.toFixed(2);
    refresh();
  });
  document.querySelector(host)!.appendChild(row);
  return input;
};

const faceSliders = NAMES.map((name, idx) =>
  slider("#morphs", name, -2, 2, 0, (w) => {
    faceMesh.morphTargetInfluences![idx] = w;
    weights.set(name, w);
    faceGeometry.computeVertexNormals();
    rebuildEyes();
    paintFace();
  }),
);
const identitySlider = slider("#identity", "hero/1 likeness", 0, 1, 0, (w) => {
  faceMesh.morphTargetInfluences![IDENTITY] = identityLoaded ? w : 0;
  faceGeometry.computeVertexNormals();
  rebuildEyes();
  paintFace();
});
const skullSliders = (
  Object.keys(skullParams) as (keyof IForgeSkullParameters)[]
).map((k) =>
  slider("#skull", k, -1, 1, skullParams[k], (v) => {
    skullParams[k] = v;
    rebuildSkull();
    rebuildHair();
    rebuildTails();
  }),
);
const hairSliders = (
  Object.keys(hairParams) as (keyof IForgeHairParameters)[]
).map((k) =>
  slider("#hair", k, 0, 1, hairParams[k], (v) => {
    hairParams[k] = v;
    rebuildHair();
  }),
);

const tailSliders = (
  Object.keys(tailParams) as (keyof IForgeTailParameters)[]
).map((k) =>
  slider("#tails", k, 0, 1, tailParams[k], (v) => {
    tailParams[k] = v;
    rebuildTails();
  }),
);

const colorInput = (id: string, key: keyof typeof colors): void => {
  const el = document.querySelector<HTMLInputElement>(id)!;
  el.addEventListener("input", () => {
    colors[key] = el.value;
    paintFace();
    applySkullTone();
    hairMaterial.color.set(colors.hair);
    applyShellLighting();
    rebuildEyes();
    refresh();
  });
};
colorInput("#cSkin", "skin");
colorInput("#cHair", "hair");
colorInput("#cLips", "lips");
colorInput("#cIris", "iris");

// ── presets: a character is ONE pure-parameter document ─────────────────────
interface IPreset {
  face: Partial<Record<AutoFilmFaceParameterName, number>>;
  data?: { identity: string; skin: string; head: string };
  skull: IForgeSkullParameters;
  hair: IForgeHairParameters;
  tails: IForgeTailParameters;
  colors: typeof colors;
}
const PRESETS: Record<string, IPreset> = {
  neutral: {
    face: {},
    skull: { width: 0, crown: 0, depth: 0 },
    hair: { length: 0.4, volume: 0.4, bangs: 0.5, curtain: 0.5 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#e8c4ae",
      hair: "#3a3027",
      lips: "#c97a72",
      iris: "#3a2a20",
    },
  },
  // hero/1: anthropometric index fit — the 18 sliders matched to HER OWN
  // measured Farkas-style indices (13/15 within ~2%; see fit-indices.js)
  hero1: {
    face: {
      faceWidth: -0.852,
      faceLength: 0.065,
      jawWidth: -0.415,
      chinLength: -1.056,
      chinProtrusion: -0.75,
      cheekFullness: 0.288,
      eyeSize: 2,
      eyeWidth: -1.904,
      eyeSpacing: 0.288,
      eyeHeight: -0.123,
      eyeTilt: 1.237,
      browHeight: 0.18,
      noseLength: 0.203,
      noseWidth: 0.239,
      noseProjection: -1.171,
      mouthWidth: 0.929,
      lipFullness: 0.207,
      mouthHeight: -0.832,
    },
    data: {
      identity: "/models/hero1-identity.json",
      skin: "/models/hero1-face.png",
      head: "/models/hero1-head.glb",
    },
    skull: { width: 0.1, crown: 0.15, depth: 0.05 },
    hair: { length: 0.3, volume: 0.55, bangs: 1, curtain: 0.35 },
    tails: { length: 0.75, height: 0.3, spread: 0.45, width: 0.65 },
    colors: {
      skin: "#f2d3c2",
      hair: "#231a15",
      lips: "#cf7e76",
      iris: "#33231b",
    },
  },
  hero2: {
    face: {
      faceWidth: -0.812,
      faceLength: 0.153,
      jawWidth: -0.627,
      chinLength: -1.085,
      chinProtrusion: -0.743,
      cheekFullness: 0.404,
      eyeSize: 1.809,
      eyeWidth: -1.224,
      eyeSpacing: 0.249,
      eyeHeight: 0.02,
      eyeTilt: 1.041,
      browHeight: -0.045,
      noseLength: -0.276,
      noseWidth: 0.822,
      noseProjection: -1.073,
      mouthWidth: 0.344,
      lipFullness: -0.106,
      mouthHeight: -1.099,
    },
    data: {
      identity: "/models/hero2-identity.json",
      skin: "/models/hero2-face.png",
      head: "/models/hero2-head.glb",
    },
    skull: { width: 0.05, crown: 0.1, depth: 0.1 },
    hair: { length: 0.15, volume: 0.5, bangs: 0.15, curtain: 0.25 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#f0cdb9",
      hair: "#2e2018",
      lips: "#c97a72",
      iris: "#33231b",
    },
  },
  hero3: {
    face: {
      faceWidth: -1.311,
      faceLength: 0.103,
      jawWidth: -0.418,
      chinLength: -0.811,
      chinProtrusion: -2,
      cheekFullness: 0.539,
      eyeSize: 1.751,
      eyeWidth: -1.3,
      eyeSpacing: 0.263,
      eyeHeight: 0.077,
      eyeTilt: 0.997,
      browHeight: -0.124,
      noseLength: -0.05,
      noseWidth: 0.568,
      noseProjection: -1.316,
      mouthWidth: 0.725,
      lipFullness: -0.466,
      mouthHeight: -0.927,
    },
    data: {
      identity: "/models/hero3-identity.json",
      skin: "/models/hero3-face.png",
      head: "/models/hero3-head.glb",
    },
    skull: { width: 0, crown: 0.1, depth: 0.05 },
    hair: { length: 1, volume: 0.45, bangs: 0.25, curtain: 0.55 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#efcab5",
      hair: "#241a14",
      lips: "#c3736d",
      iris: "#2e211a",
    },
  },
};

const applyPreset = (p: IPreset): void => {
  NAMES.forEach((name, idx) => {
    const w = p.face[name] ?? 0;
    faceMesh.morphTargetInfluences![idx] = w;
    weights.set(name, w);
    faceSliders[idx]!.value = String(w);
    faceSliders[idx]!.closest(".row")!.querySelector(".v")!.textContent =
      w.toFixed(2);
  });
  faceGeometry.computeVertexNormals();
  (Object.keys(p.skull) as (keyof IForgeSkullParameters)[]).forEach((k, i) => {
    skullParams[k] = p.skull[k];
    skullSliders[i]!.value = String(p.skull[k]);
    skullSliders[i]!.closest(".row")!.querySelector(".v")!.textContent =
      p.skull[k].toFixed(2);
  });
  rebuildSkull();
  (Object.keys(p.hair) as (keyof IForgeHairParameters)[]).forEach((k, i) => {
    hairParams[k] = p.hair[k];
    hairSliders[i]!.value = String(p.hair[k]);
    hairSliders[i]!.closest(".row")!.querySelector(".v")!.textContent =
      p.hair[k].toFixed(2);
  });
  rebuildHair();
  (Object.keys(p.tails) as (keyof IForgeTailParameters)[]).forEach((k, i) => {
    tailParams[k] = p.tails[k];
    tailSliders[i]!.value = String(p.tails[k]);
    tailSliders[i]!.closest(".row")!.querySelector(".v")!.textContent =
      p.tails[k].toFixed(2);
  });
  rebuildTails();
  void loadIdentity(p.data?.identity ?? "").then(() => {
    setIdentity(p.data ? 1 : 0);
  });
  if (p.data) {
    (window as unknown as { __loadSkin?: (u: string) => void }).__loadSkin?.(
      p.data.skin,
    );
    loadPhotoHead(p.data.head);
  }
  rebuildEyes();
  colors.skin = p.colors.skin;
  colors.hair = p.colors.hair;
  colors.lips = p.colors.lips;
  colors.iris = p.colors.iris;
  document.querySelector<HTMLInputElement>("#cSkin")!.value = colors.skin;
  document.querySelector<HTMLInputElement>("#cHair")!.value = colors.hair;
  document.querySelector<HTMLInputElement>("#cLips")!.value = colors.lips;
  paintFace();
  applySkullTone();
  hairMaterial.color.set(colors.hair);
  applyShellLighting();
  refresh();
};
document
  .querySelector<HTMLSelectElement>("#preset")!
  .addEventListener("change", (e) =>
    applyPreset(PRESETS[(e.target as HTMLSelectElement).value]!),
  );
const setIdentity = (w: number): void => {
  faceMesh.morphTargetInfluences![IDENTITY] = identityLoaded ? w : 0;
  identitySlider.value = String(w);
  identitySlider.closest(".row")!.querySelector(".v")!.textContent =
    w.toFixed(2);
  faceGeometry.computeVertexNormals();
  rebuildEyes();
  paintFace();
};
(window as unknown as { __setIdentity: unknown }).__setIdentity = setIdentity;
// the photographed FULL head (multi-view textured shell): in photo mode it
// carries the true silhouette — the face plate's landmark-oval edge is NOT
// her face contour, which is exactly what reads as a different outline
let photoHead: THREE.Group | null = null;
let photoHeadOn = false;
const headCache = new Map<string, THREE.Group>();
const loadPhotoHead = (url: string): void => {
  const place = (g: THREE.Group): void => {
    if (photoHead) photoHead.visible = false;
    photoHead = g;
    photoHead.visible = photoHeadOn;
  };
  const hit = headCache.get(url);
  if (hit) {
    place(hit);
    return;
  }
  new GLTFLoader().load(url, (gltf) => {
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const std = m.material as THREE.MeshStandardMaterial;
        m.material = new THREE.MeshBasicMaterial({
          map: std.map,
          side: THREE.DoubleSide,
          // the face plate carries a vertex-alpha feather at its rim — keep
          // the asset's blend mode when swapping to the unlit material
          vertexColors: m.geometry.hasAttribute("color"),
          transparent: std.transparent,
        });
      }
    });
    gltf.scene.visible = false;
    scene.add(gltf.scene);
    headCache.set(url, gltf.scene);
    place(gltf.scene);
  });
};
loadPhotoHead("/models/hero1-head.glb");
(window as unknown as { __setPhotoHead: unknown }).__setPhotoHead = (
  on: boolean,
) => {
  photoHeadOn = on;
  if (photoHead) photoHead.visible = on;
  faceMesh.visible = !on;
  if (skullMesh) skullMesh.visible = !on;
  if (hairMesh) hairMesh.visible = !on;
  for (const m of tailMeshes) m.visible = !on;
  for (const m of eyeMeshes) m.visible = false;
};
(window as unknown as { __dump: unknown }).__dump = () => ({
  influences: [...faceMesh.morphTargetInfluences!],
  names: NAMES,
});
(window as unknown as { __scene: unknown }).__scene = scene;
(window as unknown as { __setPreset: unknown }).__setPreset = (
  name: string,
): void => applyPreset(PRESETS[name]!);
(window as unknown as { __setFace: unknown }).__setFace = (
  params: Partial<Record<AutoFilmFaceParameterName, number>>,
): void => {
  NAMES.forEach((name, idx) => {
    const w = params[name] ?? 0;
    faceMesh.morphTargetInfluences![idx] = w;
    weights.set(name, w);
  });
  faceGeometry.computeVertexNormals();
  refresh();
};

// ── workbench wiring ─────────────────────────────────────────────────────────
const CAMS: Record<string, [number, number, number, number, number, number]> = {
  front: [0, 0, 1.35, 0, -0.01, 0],
  q34: [0.62, 0.02, 1.2, 0, -0.01, 0],
  side: [1.3, 0.01, 0.15, 0, -0.01, 0],
};
document.querySelectorAll<HTMLButtonElement>("[data-cam]").forEach((b) =>
  b.addEventListener("click", () => {
    const c = CAMS[b.dataset.cam!]!;
    camera.position.set(c[0], c[1], c[2]);
    controls.target.set(c[3], c[4], c[5]);
    controls.update();
  }),
);
const refImg = document.querySelector<HTMLImageElement>("#ref")!;
const refSel = document.querySelector<HTMLSelectElement>("#refsel")!;
const refOp = document.querySelector<HTMLInputElement>("#refop")!;
const refApply = (): void => {
  const url = refSel.value;
  refImg.src = url;
  refImg.style.opacity = url ? refOp.value : "0";
  document.querySelector("#refv")!.textContent = url
    ? Number(refOp.value).toFixed(2)
    : "off";
};
refSel.addEventListener("change", refApply);
refOp.addEventListener("input", refApply);
document
  .querySelector<HTMLInputElement>("#photohead")!
  .addEventListener("change", (e) =>
    (
      window as unknown as { __setPhotoHead?: (on: boolean) => void }
    ).__setPhotoHead?.((e.target as HTMLInputElement).checked),
  );

// ── loop ─────────────────────────────────────────────────────────────────────
(window as unknown as { __debug: unknown }).__debug = () => ({
  meshes: scene.children.filter((c) => (c as THREE.Mesh).isMesh).length,
  eyes: eyeMeshes.map((m) => {
    const col = m.geometry.getAttribute("color") as THREE.BufferAttribute;
    let dark = 0;
    for (let i = 0; i < col.count; i++) if (col.getX(i) < 0.5) dark++;
    return { verts: col.count, darkVerts: dark };
  }),
});

const tick = (): void => {
  controls.update();
  gl.render(scene, camera);
  requestAnimationFrame(tick);
};
tick();
