import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// ── scene + lighting ─────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c2027);
scene.add(new THREE.HemisphereLight(0xffffff, 0x47506a, 1.4));
const key = new THREE.DirectionalLight(0xfff2e2, 1.7);
key.position.set(1.8, 3, 2.6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd2ff, 0.8);
rim.position.set(-1.5, 2.4, -2.4);
scene.add(rim);
scene.add(new THREE.GridHelper(6, 12, 0x3a4660, 0x262d3a));

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
camera.position.set(0, 0.95, 3.4);
camera.lookAt(0, 0.9, 0);

let mesh: THREE.Mesh | null = null;

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
  </style>
  <div id="stage">
    <canvas id="view"></canvas>
    <div id="panel">
      <h1>motica · body editor</h1>
      <div class="sub" id="status">loading…</div>
      <div id="morphs"></div>
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

const prettify = (base: string): string =>
  base
    .replace(/^measure-/, "")
    .replace(/^bodyshapes-elvs-(fem|man)-/, "type: ")
    .replace(/-/g, " ")
    .replace(/\bcirc\b/, "circumference");

const slider = (
  label: string,
  min: number,
  max: number,
  set: (n: number) => void,
): void => {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<label><span>${label}</span><span class="v">0.00</span></label>
    <input type="range" min="${min}" max="${max}" step="0.01" value="0" />`;
  const input = row.querySelector("input")!;
  const out = row.querySelector(".v")!;
  input.addEventListener("input", () => {
    const n = Number(input.value);
    set(n);
    out.textContent = n.toFixed(2);
  });
  document.querySelector("#morphs")!.appendChild(row);
};

// ── load the baked MakeHuman GLB ─────────────────────────────────────────────
new GLTFLoader().load(
  "/models/human.glb",
  (gltf) => {
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences) {
        mesh = m;
        m.material = new THREE.MeshStandardMaterial({
          color: 0xe8b89a,
          roughness: 0.62,
          metalness: 0,
        });
      }
    });
    scene.add(gltf.scene);
    if (mesh === null) {
      status.textContent = "no morph mesh found";
      return;
    }
    const dict = mesh.morphTargetDictionary ?? {};
    const infl = mesh.morphTargetInfluences!;

    // group decr/incr pairs into one signed slider; singles get a 0..1 slider
    const groups: Record<
      string,
      { incr?: number; decr?: number; single?: number }
    > = {};
    for (const name in dict) {
      const pair = /^(.*)-(incr|decr)$/.exec(name);
      if (pair)
        (groups[pair[1]!] ??= {})[pair[2] as "incr" | "decr"] = dict[name]!;
      else (groups[name] ??= {}).single = dict[name]!;
    }
    for (const [base, g] of Object.entries(groups)) {
      if (g.incr !== undefined && g.decr !== undefined) {
        const inc = g.incr;
        const dec = g.decr;
        slider(prettify(base), -1, 1, (v) => {
          infl[inc] = Math.max(0, v);
          infl[dec] = Math.max(0, -v);
        });
      } else {
        const idx = (g.single ?? g.incr ?? g.decr)!;
        slider(prettify(base), 0, 1, (v) => (infl[idx] = v));
      }
    }
    status.textContent = `MakeHuman base · CC0 · ${Object.keys(groups).length} body morphs`;
    (window as unknown as { __motica: Record<string, unknown> }).__motica = {
      ready: true,
      morphs: Object.keys(dict).length,
    };
  },
  undefined,
  (err) => (status.textContent = "load error: " + String(err)),
);

const tick = (): void => {
  requestAnimationFrame(tick);
  gl.render(scene, camera);
};
tick();
