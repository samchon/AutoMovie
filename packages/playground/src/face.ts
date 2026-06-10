import { validateFaceResult } from "@autofilm/engine";
import {
  CANONICAL_FACE_INDICES,
  CANONICAL_FACE_POSITIONS,
  CANONICAL_FACE_UVS,
  IForgeHairParameters,
  IForgeSkullParameters,
  buildEyeShells,
  buildFaceMorphs,
  buildHairShell,
  buildSkullShell,
} from "@autofilm/forge";
import {
  AutoFilmFaceParameterName,
  IAutoFilmFaceParameter,
} from "@autofilm/interface";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

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
    select { width: 100%; background: #0e1014; color: #e6e9ef; border: 1px solid #2a2f37;
             border-radius: 4px; padding: 4px; }
    #doc { margin-top: 10px; padding: 8px; background: #0e1014; border-radius: 6px;
           color: #9aa3b2; font: 10px/1.45 ui-monospace, monospace; white-space: pre-wrap; }
  </style>
  <div id="stage">
    <canvas id="view"></canvas>
    <div id="panel">
      <h1>autofilm · face editor</h1>
      <div class="sub" id="status">pure-parameter character head</div>
      <h2>preset</h2>
      <select id="preset">
        <option value="neutral">neutral</option>
        <option value="hero1">hero/1 (fitted)</option>
      </select>
      <h2>face shape</h2>
      <div id="morphs"></div>
      <h2>identity (character data)</h2>
      <div id="identity"></div>
      <h2>skull</h2>
      <div id="skull"></div>
      <h2>hair</h2>
      <div id="hair"></div>
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
void fetch("/models/hero1-identity.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((j: { identity: number[] } | null) => {
    if (!j) return;
    identityDelta.set(j.identity);
    (
      faceGeometry.morphAttributes.position[IDENTITY] as THREE.BufferAttribute
    ).needsUpdate = true;
    identityLoaded = true;
  })
  .catch(() => undefined);
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
new THREE.TextureLoader().load("/models/hero1-face.png", (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // the bake uses the glTF top-left UV convention
  // UNLIT in photo mode: re-shading photographed pixels shifts how features
  // read (the detector-free overlay proved the data itself is pixel-exact)
  const photoMaterial = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
  });
  (window as unknown as { __setSkin: unknown }).__setSkin = (on: boolean) => {
    faceMesh.material = on ? photoMaterial : faceMaterial;
    // photo skin carries painted eyes: restore the lid covers, park the
    // sphere eyeballs; sculpt mode cuts the covers and brings them back
    faceGeometry.setIndex(on ? [...CANONICAL_FACE_INDICES] : faceIndices);
    for (const m of eyeMeshes) m.visible = !on;
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
  skullMesh = new THREE.Mesh(g, skullMaterial);
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
  roughness: 0.6,
  metalness: 0.05,
  side: THREE.DoubleSide,
});
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
  hairMesh = new THREE.Mesh(g, hairMaterial);
  scene.add(hairMesh);
};
rebuildHair();

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
const refresh = (): void => {
  const parameters: IAutoFilmFaceParameter[] = [...weights.entries()]
    .filter(([, w]) => w !== 0)
    .map(([parameter, weight]) => ({ parameter, weight }));
  const result = validateFaceResult({ parameters });
  status.textContent = result.success
    ? `valid IAutoFilmFace — ${parameters.length} parameter(s) set`
    : `INVALID: ${result.violations[0]!.expected}`;
  docOut.textContent = JSON.stringify(
    { face: { parameters }, skull: skullParams, hair: hairParams, colors },
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

const colorInput = (id: string, key: keyof typeof colors): void => {
  const el = document.querySelector<HTMLInputElement>(id)!;
  el.addEventListener("input", () => {
    colors[key] = el.value;
    paintFace();
    skullMaterial.color.set(colors.skin);
    hairMaterial.color.set(colors.hair);
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
  skull: IForgeSkullParameters;
  hair: IForgeHairParameters;
  colors: typeof colors;
}
const PRESETS: Record<string, IPreset> = {
  neutral: {
    face: {},
    skull: { width: 0, crown: 0, depth: 0 },
    hair: { length: 0.4, volume: 0.4, bangs: 0.5, curtain: 0.5 },
    colors: {
      skin: "#e8c4ae",
      hair: "#3a3027",
      lips: "#c97a72",
      iris: "#3a2a20",
    },
  },
  // hero/1: the 17-parameter least-squares fit of the photographed face
  // (profile-calibrated depth), hair/colors read off the reference sheet
  hero1: {
    face: {
      faceWidth: -0.8,
      faceLength: -1.12,
      jawWidth: -0.36,
      chinLength: 0.85,
      chinProtrusion: -1.64,
      cheekFullness: 1.58,
      eyeSize: 0.09,
      eyeSpacing: 0.13,
      eyeHeight: -0.07,
      eyeTilt: 0.18,
      browHeight: 1.01,
      noseLength: -0.32,
      noseWidth: -0.37,
      noseProjection: -1.46,
      mouthWidth: 0.16,
      lipFullness: -1.46,
      mouthHeight: -1.08,
    },
    skull: { width: 0.1, crown: 0.15, depth: 0.05 },
    hair: { length: 0.5, volume: 0.5, bangs: 0.95, curtain: 0.55 },
    colors: {
      skin: "#f2d3c2",
      hair: "#231a15",
      lips: "#cf7e76",
      iris: "#33231b",
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
  rebuildEyes();
  colors.skin = p.colors.skin;
  colors.hair = p.colors.hair;
  colors.lips = p.colors.lips;
  colors.iris = p.colors.iris;
  document.querySelector<HTMLInputElement>("#cSkin")!.value = colors.skin;
  document.querySelector<HTMLInputElement>("#cHair")!.value = colors.hair;
  document.querySelector<HTMLInputElement>("#cLips")!.value = colors.lips;
  paintFace();
  skullMaterial.color.set(colors.skin);
  hairMaterial.color.set(colors.hair);
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
