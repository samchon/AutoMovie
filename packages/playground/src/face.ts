import { validateFaceResult } from "@autofilm/engine";
import {
  CANONICAL_FACE_INDICES,
  CANONICAL_FACE_POSITIONS,
  CANONICAL_FACE_UVS,
  IForgeBunParameters,
  IForgeBustParameters,
  IForgeHairParameters,
  IForgeSkullParameters,
  IForgeTailParameters,
  buildBust,
  buildEyeShells,
  buildFaceMorphs,
  buildHairBun,
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
// Soft three-point portrait rig. A single hard key over flat matte clay is
// what made the head read as a plastic mannequin: strong cast shadows
// caricature every facet. A gentler key + a warm sky/ground hemisphere fill +
// a soft opposite fill + a cool back rim wraps the form the way studio
// portrait light does, so the same geometry reads as skin, not putty.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c2027);
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x55504a, 1.05));
const key = new THREE.DirectionalLight(0xfff0dc, 0.95);
key.position.set(0.55, 0.45, 1.4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xdfeaff, 0.45);
fill.position.set(-1.1, 0.1, 0.9);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xbcd2ff, 0.5);
rim.position.set(-0.6, 0.5, -1.2);
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
      <h2>bun</h2>
      <div id="bun"></div>
      <h2>tails</h2>
      <div id="tails"></div>
      <h2>bust</h2>
      <div id="bust"></div>
      <h2>colors</h2>
      <div class="colors">
        <label>skin<input type="color" id="cSkin" value="#e8c4ae" /></label>
        <label>hair<input type="color" id="cHair" value="#3a3027" /></label>
        <label>lips<input type="color" id="cLips" value="#c97a72" /></label>
        <label>iris R<input type="color" id="cIrisR" value="#3a2a20" /></label>
        <label>iris L<input type="color" id="cIrisL" value="#3a2a20" /></label>
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

// 1-ring adjacency over the FULL triangulation (for the concavity AO below) —
// built once; the topology never changes, only the morphed positions do.
const ADJ: number[][] = Array.from({ length: 468 }, () => []);
{
  const seen = new Set<number>();
  for (let t = 0; t < CANONICAL_FACE_INDICES.length; t += 3) {
    const tri = [
      CANONICAL_FACE_INDICES[t]!,
      CANONICAL_FACE_INDICES[t + 1]!,
      CANONICAL_FACE_INDICES[t + 2]!,
    ];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++) {
        if (a === b) continue;
        const key = tri[a]! * 468 + tri[b]!;
        if (seen.has(key)) continue;
        seen.add(key);
        ADJ[tri[a]!]!.push(tri[b]!);
      }
  }
}
/**
 * Cheap geometry-driven ambient occlusion: a concave vertex (a valley — the
 * alar crease, nasolabial fold, under-nose, mentolabial groove, eye socket)
 * sits below the average of its neighbours along the outward normal, so light
 * is partly blocked there. Darkening those vertices is what turns flat clay
 * into a face that reads as having recesses. Adapts to morphs automatically.
 */
const concavityAO = (pos: number[]): Float32Array => {
  // per-vertex normal from the cut triangulation
  const nx = new Float32Array(468);
  const ny = new Float32Array(468);
  const nz = new Float32Array(468);
  for (let t = 0; t < faceIndices.length; t += 3) {
    const a = faceIndices[t]!;
    const b = faceIndices[t + 1]!;
    const c = faceIndices[t + 2]!;
    const ux = pos[b * 3]! - pos[a * 3]!;
    const uy = pos[b * 3 + 1]! - pos[a * 3 + 1]!;
    const uz = pos[b * 3 + 2]! - pos[a * 3 + 2]!;
    const vx = pos[c * 3]! - pos[a * 3]!;
    const vy = pos[c * 3 + 1]! - pos[a * 3 + 1]!;
    const vz = pos[c * 3 + 2]! - pos[a * 3 + 2]!;
    const fx = uy * vz - uz * vy;
    const fy = uz * vx - ux * vz;
    const fz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      nx[i]! += fx;
      ny[i]! += fy;
      nz[i]! += fz;
    }
  }
  const ao = new Float32Array(468);
  for (let i = 0; i < 468; i++) {
    const nb = ADJ[i]!;
    if (nb.length === 0) continue;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const j of nb) {
      mx += pos[j * 3]!;
      my += pos[j * 3 + 1]!;
      mz += pos[j * 3 + 2]!;
    }
    // Laplacian: mean-neighbour minus vertex
    const lx = mx / nb.length - pos[i * 3]!;
    const ly = my / nb.length - pos[i * 3 + 1]!;
    const lz = mz / nb.length - pos[i * 3 + 2]!;
    const nl = Math.hypot(nx[i]!, ny[i]!, nz[i]!) || 1;
    // SIGNED curvature: Laplacian along the outward normal — positive in a
    // valley (concave, occluded → darken), negative on a ridge (convex,
    // catches light → brighten). Full curvature shading, not just AO.
    const concav = (lx * nx[i]! + ly * ny[i]! + lz * nz[i]!) / nl;
    ao[i] = Math.max(-1, Math.min(1, concav / 0.0012));
  }
  return ao;
};
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
  // per-side iris colors — heterochromia (오드아이) is color data, not
  // geometry; keep them equal for ordinary eyes
  irisRight: "#3a2a20",
  irisLeft: "#3a2a20",
};
// RGBA: the alpha channel feathers the face-plate's upper/lateral boundary so
// its edge DISSOLVES into the skull behind it instead of ending as a hard
// wall ("mask on a dome"). The same proven trick the photographed head uses.
const colorAttr = new THREE.Float32BufferAttribute(
  new Float32Array(468 * 4),
  4,
);
faceGeometry.setAttribute("color", colorAttr);
// face-oval boundary ring (MediaPipe) — the plate edge to feather/weld
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
];
const paintFace = (): void => {
  const pos = morphedFacePositions();
  const lipW = regionWeight(pos, LIPS, 0.004);
  // feather band along the oval boundary, gated OFF near the chin/jaw bottom
  // (nothing behind it but neck/bust — fading there would show background)
  const ovalW = regionWeight(pos, FACE_OVAL, 0.006);
  const chinY = pos[152 * 3 + 1]!;
  const halfWFace = Math.abs(pos[454 * 3]! - pos[234 * 3]!) / 2 || 0.0766;
  // tighter brow band (was 0.004 → a thick dark caterpillar that merged
  // across the bridge into a unibrow); narrower sigma + a capped, partly
  // transparent max keeps skin showing through so it reads as hair on skin
  const browW = regionWeight(pos, BROWS, 0.0026);
  const eyeW = regionWeight(pos, EYES, 0.0022);
  // geometry-driven concavity AO: darkens every recess (alar crease,
  // nasolabial, under-nose, mentolabial, eye socket) so the flat clay reads
  // as a face with depth, instead of hand-picking each fold.
  const ao = concavityAO(pos);
  const skin = new THREE.Color(colors.skin);
  const lips = new THREE.Color(colors.lips);
  // brow = hair tinted toward a warm brown, not near-black hair·0.7
  const brow = new THREE.Color(colors.hair).lerp(
    new THREE.Color("#6b4a32"),
    0.4,
  );
  const eye = new THREE.Color("#4a3a30");
  const c = new THREE.Color();
  for (let i = 0; i < 468; i++) {
    c.copy(skin)
      .lerp(lips, lipW[i]!)
      .lerp(brow, Math.min(0.8, browW[i]!))
      .lerp(eye, 0.45 * eyeW[i]!);
    // valleys occlude (darken), ridges catch light (brighten) — clay → skin
    const k = ao[i]!;
    c.multiplyScalar(k >= 0 ? 1 - 0.32 * k : 1 - 0.12 * k);
    const y = pos[i * 3 + 1]!;
    // feather the LATERAL boundary (temples/cheeks/jaw-sides — where the flat
    // plate edge meets the skull at a steep angle and shows as a ledge), but
    // NOT the forehead-top centre (|x| small): fading there only revealed the
    // skull as a lighter patch in front view, and the default hair covers that
    // seam anyway. Also gated off near the chin (neck/bust behind it).
    const x = pos[i * 3]!;
    const lat = Math.min(1, Math.abs(x) / (0.55 * halfWFace));
    const gate = Math.max(0, Math.min(1, (y - (chinY + 0.03)) / 0.04)) * lat;
    const alpha = 1 - 0.92 * ovalW[i]! * gate;
    colorAttr.setXYZW(i, c.r, c.g, c.b, alpha);
  }
  colorAttr.needsUpdate = true;
};

const faceMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.62, // a faint sheen reads as skin; full-matte reads as clay
  metalness: 0,
  side: THREE.DoubleSide,
  transparent: true, // the RGBA alpha feathers the plate edge into the skull
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
  roughness: 0.62,
  metalness: 0,
});
const skullUnlit = new THREE.MeshBasicMaterial({ color: colors.skin });
let skullMesh: THREE.Mesh | null = null;
/**
 * Pull the skull's front-hemisphere vertices that fall inside the face-oval
 * footprint up to just behind the face surface, so the feathered face plate
 * dissolves onto skin (the cranium) rather than into a gap. IDW over the oval
 * ring; outside the rim it eases back to the bare ellipsoid.
 */
const conformSkullFront = (positions: number[], facePos: number[]): void => {
  const oval = FACE_OVAL.map((i) => [
    facePos[i * 3]!,
    facePos[i * 3 + 1]!,
    facePos[i * 3 + 2]!,
  ]);
  const inside = (x: number, y: number): boolean => {
    let hit = false;
    for (let i = 0, j = oval.length - 1; i < oval.length; j = i++) {
      const yi = oval[i]![1]!;
      const yj = oval[j]![1]!;
      const xi = oval[i]![0]!;
      const xj = oval[j]![0]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        hit = !hit;
    }
    return hit;
  };
  for (let v = 0; v < positions.length; v += 3) {
    const x = positions[v]!;
    const y = positions[v + 1]!;
    if (positions[v + 2]! <= 0 || !inside(x, y)) continue;
    let wSum = 0;
    let zSum = 0;
    for (const [ox, oy, oz] of oval) {
      const w = 1 / (((ox! - x) ** 2 + (oy! - y) ** 2) ** 2 + 1e-12);
      wSum += w;
      zSum += w * oz!;
    }
    positions[v + 2] = Math.max(positions[v + 2]!, zSum / wSum - 0.004);
  }
};
const rebuildSkull = (facePos: number[] = CANONICAL_FACE_POSITIONS): void => {
  if (skullMesh) {
    scene.remove(skullMesh);
    skullMesh.geometry.dispose();
  }
  const skull = buildSkullShell(skullParams);
  conformSkullFront(skull.positions, facePos);
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

const hairParams: Required<IForgeHairParameters> = {
  length: 0.4,
  volume: 0.4,
  bangs: 0.5,
  curtain: 0.5,
  updo: 0,
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
  if (bunMesh) bunMesh.material = skinModeOn ? hairUnlit : hairMaterial;
  for (const m of tailMeshes)
    m.material = skinModeOn ? hairUnlit : hairMaterial;
  if (bustMesh) bustMesh.material = skinModeOn ? skullUnlit : skullMaterial;
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
const bunParams: IForgeBunParameters = { size: 0, height: 0.5 };
let bunMesh: THREE.Mesh | null = null;
const rebuildBun = (): void => {
  if (bunMesh) {
    scene.remove(bunMesh);
    bunMesh.geometry.dispose();
    bunMesh = null;
  }
  const part = buildHairBun(bunParams, skullParams);
  if (part.positions.length === 0) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(part.positions, 3),
  );
  g.setIndex(part.indices);
  g.computeVertexNormals();
  paintHairStrands(g);
  // brighten the lobe a touch so it separates from the shell back-on
  {
    const c = g.getAttribute("color");
    for (let i = 0; i < c.count * 3; i++) c.array[i] = c.array[i] * 2.0 + 0.12;
  }
  bunMesh = new THREE.Mesh(g, skinModeOn ? hairUnlit : hairMaterial);
  scene.add(bunMesh);
};
rebuildBun();
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
    // both materials read vertex colors — an unpainted geometry renders BLACK
    paintHairStrands(g);
    const mesh = new THREE.Mesh(g, skinModeOn ? hairUnlit : hairMaterial);
    scene.add(mesh);
    tailMeshes.push(mesh);
  }
};
rebuildTails();

const bustParams: IForgeBustParameters = { neck: 0.35, shoulders: 0.45 };
let bustMesh: THREE.Mesh | null = null;
const rebuildBust = (): void => {
  if (bustMesh) {
    scene.remove(bustMesh);
    bustMesh.geometry.dispose();
  }
  const part = buildBust(bustParams);
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(part.positions, 3),
  );
  g.setIndex(part.indices);
  g.computeVertexNormals();
  bustMesh = new THREE.Mesh(g, skinModeOn ? skullUnlit : skullMaterial);
  scene.add(bustMesh);
};
rebuildBust();

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
  // dimmer than paper-white so the eye doesn't read as a dead ping-pong ball
  const sclera = new THREE.Color("#e7ddd0");
  const pupil = new THREE.Color("#120c08");
  for (const [side, eye] of [shells.right, shells.left].entries()) {
    const iris = new THREE.Color(
      side === 0 ? colors.irisRight : colors.irisLeft,
    );
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
    // catchlight: a single bright reflection of the key light. Both eyes
    // reflect the same source, so the spot sits at the same eye-local
    // direction on both — up/forward, biased toward the key. Without it the
    // iris reads as a flat dead disc; with it the eye looks wet and alive.
    const cd = [0.3, 0.46, 0.84]; // normalized up-right-forward
    for (let i = 0; i < n; i++) {
      const f = (eye.positions[i * 3 + 2]! - scz) / eye.radius;
      // iris cap (f>0.84, slightly larger than the old 0.906 so it fills the
      // aperture instead of leaving a wall-eyed ring of bare sclera), rimmed
      // by a darker limbus, pupil at the front pole
      c.copy(sclera);
      if (f > 0.84) c.copy(iris).multiplyScalar(0.62); // limbus
      if (f > 0.9) c.copy(iris);
      if (f > 0.985) c.copy(pupil);
      const dx = eye.positions[i * 3]! - eye.center[0];
      const dy = eye.positions[i * 3 + 1]! - eye.center[1];
      const dz = eye.positions[i * 3 + 2]! - eye.center[2];
      const dl = Math.hypot(dx, dy, dz) || 1;
      if ((dx * cd[0]! + dy * cd[1]! + dz * cd[2]!) / dl > 0.95)
        c.setRGB(0.96, 0.96, 0.92); // catchlight overrides iris/pupil here
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
  cheekFullnessR: (f, w) => (((f.cheeks ??= {}).right ??= {}).fullness = w),
  cheekFullnessL: (f, w) => (((f.cheeks ??= {}).left ??= {}).fullness = w),
  jawWidth: (f, w) => ((f.jaw ??= {}).width = w),
  chinLength: (f, w) => (((f.jaw ??= {}).chin ??= {}).length = w),
  chinProtrusion: (f, w) => (((f.jaw ??= {}).chin ??= {}).protrusion = w),
  eyeSizeR: (f, w) => (((f.eyes ??= {}).right ??= {}).size = w),
  eyeSizeL: (f, w) => (((f.eyes ??= {}).left ??= {}).size = w),
  eyeWidthR: (f, w) => (((f.eyes ??= {}).right ??= {}).width = w),
  eyeWidthL: (f, w) => (((f.eyes ??= {}).left ??= {}).width = w),
  eyeSpacingR: (f, w) => (((f.eyes ??= {}).right ??= {}).offset = w),
  eyeSpacingL: (f, w) => (((f.eyes ??= {}).left ??= {}).offset = w),
  eyeHeightR: (f, w) => (((f.eyes ??= {}).right ??= {}).height = w),
  eyeHeightL: (f, w) => (((f.eyes ??= {}).left ??= {}).height = w),
  eyeTiltR: (f, w) => (((f.eyes ??= {}).right ??= {}).tilt = w),
  eyeTiltL: (f, w) => (((f.eyes ??= {}).left ??= {}).tilt = w),
  browHeightR: (f, w) => (((f.brows ??= {}).right ??= {}).height = w),
  browHeightL: (f, w) => (((f.brows ??= {}).left ??= {}).height = w),
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
  // SIDE RULE folding: a lone side applies to BOTH sides, so when the
  // sliders produce identical left/right objects the document keeps only
  // one — the shorthand an LLM would naturally write. Equal eye offsets
  // fold into the pair-level spacing first.
  for (const set of [face.eyes, face.brows, face.cheeks]) {
    if (!set?.left || !set.right) continue;
    const L = set.left as Record<string, number | undefined>;
    const R = set.right as Record<string, number | undefined>;
    if (
      "offset" in L &&
      L.offset !== undefined &&
      L.offset === (R as { offset?: number }).offset
    ) {
      (set as { spacing?: number }).spacing =
        ((set as { spacing?: number }).spacing ?? 0) + L.offset;
      delete L.offset;
      delete (R as { offset?: number }).offset;
    }
    const keys = new Set([...Object.keys(L), ...Object.keys(R)]);
    const equal = [...keys].every((k) => L[k] === (R as typeof L)[k]);
    if (equal) delete set.right; // lone left = symmetric shorthand
    if (Object.keys(L).length === 0) delete set.left;
    if (set.right && Object.keys(set.right).length === 0) delete set.right;
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
      bun: bunParams,
      bust: bustParams,
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
    rebuildSkull(morphedFacePositions());
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

const bunSliders = (
  Object.keys(bunParams) as (keyof IForgeBunParameters)[]
).map((k) =>
  slider("#bun", k, 0, 1, bunParams[k], (v) => {
    bunParams[k] = v;
    rebuildBun();
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

const bustSliders = (
  Object.keys(bustParams) as (keyof IForgeBustParameters)[]
).map((k) =>
  slider("#bust", k, 0, 1, bustParams[k], (v) => {
    bustParams[k] = v;
    rebuildBust();
  }),
);
void bustSliders;

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
colorInput("#cIrisR", "irisRight");
colorInput("#cIrisL", "irisLeft");

// ── presets: a character is ONE pure-parameter document ─────────────────────
interface IPreset {
  face: Partial<Record<AutoFilmFaceParameterName, number>>;
  data?: { identity: string; skin: string; head: string };
  skull: IForgeSkullParameters;
  hair: Required<IForgeHairParameters>;
  bun: IForgeBunParameters;
  tails: IForgeTailParameters;
  colors: typeof colors;
}
const PRESETS: Record<string, IPreset> = {
  neutral: {
    face: {},
    skull: { width: 0, crown: 0, depth: 0 },
    hair: { length: 0.4, volume: 0.4, bangs: 0.5, curtain: 0.5, updo: 0 },
    bun: { size: 0, height: 0.5 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#e8c4ae",
      hair: "#3a3027",
      lips: "#c97a72",
      irisRight: "#3a2a20",
      irisLeft: "#3a2a20",
    },
  },
  // hero/1: anthropometric index fit — the 18 sliders matched to HER OWN
  // measured Farkas-style indices (13/15 within ~2%; see fit-indices.js)
  hero1: {
    face: {
      faceWidth: -0.61,
      faceLength: 0.146,
      jawWidth: -0.416,
      chinLength: -0.933,
      chinProtrusion: -0.849,
      cheekFullnessR: 0.051,
      cheekFullnessL: 0.051,
      eyeSizeR: 1.579,
      eyeSizeL: 1.579,
      eyeWidthR: -2,
      eyeWidthL: -2,
      eyeSpacingR: 0.375,
      eyeSpacingL: 0.375,
      eyeHeightR: 0.29,
      eyeHeightL: 0.29,
      eyeTiltR: 1.317,
      eyeTiltL: 1.317,
      browHeightR: -0.344,
      browHeightL: -0.344,
      noseLength: -0.03,
      noseWidth: 0.241,
      noseProjection: -1.081,
      mouthWidth: 0.971,
      lipFullness: 0.187,
      mouthHeight: -0.997,
    },
    data: {
      identity: "/models/hero1-identity.json",
      skin: "/models/hero1-face.png",
      head: "/models/hero1-head.glb",
    },
    skull: { width: 0.1, crown: 0.15, depth: 0.05 },
    hair: { length: 0.3, volume: 0.55, bangs: 1, curtain: 0.35, updo: 0 },
    bun: { size: 0, height: 0.5 },
    tails: { length: 0.75, height: 0.3, spread: 0.45, width: 0.65 },
    colors: {
      skin: "#f2d3c2",
      hair: "#231a15",
      lips: "#cf7e76",
      irisRight: "#33231b",
      irisLeft: "#33231b",
    },
  },
  hero2: {
    face: {
      faceWidth: -0.766,
      faceLength: 0.134,
      jawWidth: -0.595,
      chinLength: -1.002,
      chinProtrusion: -0.757,
      cheekFullnessR: 0.298,
      cheekFullnessL: 0.298,
      eyeSizeR: 1.34,
      eyeSizeL: 1.34,
      eyeWidthR: -1.384,
      eyeWidthL: -1.384,
      eyeSpacingR: 0.484,
      eyeSpacingL: 0.484,
      eyeHeightR: 0.458,
      eyeHeightL: 0.458,
      eyeTiltR: 1.098,
      eyeTiltL: 1.098,
      browHeightR: -0.54,
      browHeightL: -0.54,
      noseLength: -0.385,
      noseWidth: 0.731,
      noseProjection: -1.038,
      mouthWidth: 0.309,
      lipFullness: -0.087,
      mouthHeight: -1.204,
    },
    data: {
      identity: "/models/hero2-identity.json",
      skin: "/models/hero2-face.png",
      head: "/models/hero2-head.glb",
    },
    skull: { width: 0.05, crown: 0.1, depth: 0.1 },
    hair: { length: 0.35, volume: 0.6, bangs: 0.2, curtain: 0.3, updo: 1 },
    bun: { size: 0.9, height: 0.3 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#f0cdb9",
      hair: "#2e2018",
      lips: "#c97a72",
      irisRight: "#33231b",
      irisLeft: "#33231b",
    },
  },
  hero3: {
    face: {
      faceWidth: -1.29,
      faceLength: 0.067,
      jawWidth: -0.391,
      chinLength: -0.74,
      chinProtrusion: -2,
      cheekFullnessR: 0.428,
      cheekFullnessL: 0.428,
      eyeSizeR: 1.269,
      eyeSizeL: 1.269,
      eyeWidthR: -1.409,
      eyeWidthL: -1.409,
      eyeSpacingR: 0.456,
      eyeSpacingL: 0.456,
      eyeHeightR: 0.518,
      eyeHeightL: 0.518,
      eyeTiltR: 1.023,
      eyeTiltL: 1.023,
      browHeightR: -0.603,
      browHeightL: -0.603,
      noseLength: -0.153,
      noseWidth: 0.5,
      noseProjection: -1.282,
      mouthWidth: 0.694,
      lipFullness: -0.449,
      mouthHeight: -1.033,
    },
    data: {
      identity: "/models/hero3-identity.json",
      skin: "/models/hero3-face.png",
      head: "/models/hero3-head.glb",
    },
    skull: { width: 0, crown: 0.1, depth: 0.05 },
    hair: { length: 1, volume: 0.45, bangs: 0.25, curtain: 0.55, updo: 0 },
    bun: { size: 0, height: 0.5 },
    tails: { length: 0, height: 0.4, spread: 0.4, width: 0.5 },
    colors: {
      skin: "#efcab5",
      hair: "#241a14",
      lips: "#c3736d",
      irisRight: "#2e211a",
      irisLeft: "#2e211a",
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
  rebuildSkull(morphedFacePositions());
  (Object.keys(p.hair) as (keyof IForgeHairParameters)[]).forEach((k, i) => {
    hairParams[k] = p.hair[k];
    hairSliders[i]!.value = String(p.hair[k]);
    hairSliders[i]!.closest(".row")!.querySelector(".v")!.textContent =
      p.hair[k].toFixed(2);
  });
  rebuildHair();
  (Object.keys(p.bun) as (keyof IForgeBunParameters)[]).forEach((k, i) => {
    bunParams[k] = p.bun[k];
    bunSliders[i]!.value = String(p.bun[k]);
    bunSliders[i]!.closest(".row")!.querySelector(".v")!.textContent =
      p.bun[k].toFixed(2);
  });
  rebuildBun();
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
  colors.irisRight = p.colors.irisRight;
  colors.irisLeft = p.colors.irisLeft;
  document.querySelector<HTMLInputElement>("#cSkin")!.value = colors.skin;
  document.querySelector<HTMLInputElement>("#cHair")!.value = colors.hair;
  document.querySelector<HTMLInputElement>("#cLips")!.value = colors.lips;
  document.querySelector<HTMLInputElement>("#cIrisR")!.value = colors.irisRight;
  document.querySelector<HTMLInputElement>("#cIrisL")!.value = colors.irisLeft;
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
  if (bunMesh) bunMesh.visible = !on;
  if (bustMesh) bustMesh.visible = !on;
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
