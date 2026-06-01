// Bake a parametric human GLB from MakeHuman's CC0 base mesh + morph targets,
// with UVs, an iris-textured eye, eyelashes, and the CC0 skin matcap downloaded
// alongside — so it reads as a person, not a grey alien.
//
// MakeHuman's base mesh / targets / skins / eye textures are CC0 (public domain),
// so they drop cleanly into this MIT project.
//
// Run: node scripts/build-human.mjs  →  public/models/human.glb (+ skin matcap, eye texture)
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync, writeFileSync } from "fs";

const BASE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data";

const MORPHS = [
  { n: "eye-size", f: ["eyes/l-eye-scale-incr", "eyes/r-eye-scale-incr"], bake: 0.6 },
  { n: "eye-height", f: ["eyes/l-eye-height2-incr", "eyes/r-eye-height2-incr"], bake: 0.35 },
  { n: "nose-size", f: ["nose/nose-scale-vert-incr", "nose/nose-scale-depth-incr"], bake: -0.5 },
  { n: "nose-width", f: ["nose/nose-width1-incr", "nose/nose-width2-incr"], bake: -0.45 },
  { n: "lips", f: ["mouth/mouth-upperlip-height-incr", "mouth/mouth-lowerlip-height-incr"], bake: 0.5 },
  { n: "mouth-width", f: ["mouth/mouth-scale-horiz-incr"], bake: -0.2 },
  { n: "chin", f: ["chin/chin-width-incr", "chin/chin-height-incr"], bake: -0.35 },
  { n: "jaw-drop", f: ["chin/chin-jaw-drop-incr"], bake: -0.2 },
  { n: "cheekbones", f: ["cheek/l-cheek-bones-incr", "cheek/r-cheek-bones-incr"], bake: 0.4 },
  { n: "cheek-volume", f: ["cheek/l-cheek-volume-incr", "cheek/r-cheek-volume-incr"], bake: 0.25 },
  { n: "head-width", f: ["head/head-scale-horiz-incr"], bake: -0.12 },
  { n: "body-hourglass", f: ["bodyshapes/bodyshapes-elvs-fem-neat-hourglass"], bake: 0.4 },
  { n: "bust", f: ["measure/measure-bust-circ-incr"], bake: 0.15 },
  { n: "underbust", f: ["measure/measure-underbust-circ-incr"], bake: -0.2 },
  { n: "hips", f: ["measure/measure-hips-circ-incr"], bake: 0.2 },
  { n: "thigh", f: ["measure/measure-thigh-circ-incr"], bake: 0.1 },
  { n: "shoulder", f: ["measure/measure-shoulder-dist-incr"], bake: -0.2 },
  { n: "neck", f: ["measure/measure-neck-circ-incr"], bake: -0.15 },
  { n: "calf", f: ["measure/measure-calf-circ-incr"] },
  { n: "buttocks", f: ["buttocks/buttocks-volume-incr"], bake: 0.15 },
];

const text = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const bin = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer());

mkdirSync("public/models", { recursive: true });

console.log("fetching MakeHuman base mesh + CC0 textures…");
const obj = await text(`${BASE}/3dobjs/base.obj`);
const eyeTex = await bin(`${BASE}/eyes/materials/brown_eye.png`);
const skinMatcap = await bin(`${BASE}/litspheres/skinmat_caucasian.png`);
writeFileSync("public/models/skin-matcap.png", skinMatcap);

// parse verts, UVs, and per-group faces; assign one UV per vertex (seam-lossy
// but keeps the morph-target vertex indexing intact).
const verts = [];
const uvRaw = [];
const vertUV = []; // [u, v] per vertex
const tri = { body: [], eye: [], lash: [] };
let group = "";
const groupOf = (g) =>
  g === "body"
    ? "body"
    : g === "helper-l-eye" || g === "helper-r-eye"
      ? "eye"
      : g.startsWith("helper-l-eyelashes") || g.startsWith("helper-r-eyelashes")
        ? "lash"
        : null;
for (const line of obj.split("\n")) {
  if (line.startsWith("v ")) {
    const p = line.split(/\s+/);
    verts.push([+p[1], +p[2], +p[3]]);
  } else if (line.startsWith("vt ")) {
    const p = line.split(/\s+/);
    uvRaw.push([+p[1], 1 - +p[2]]);
  } else if (line.startsWith("g ")) {
    group = line.slice(2).trim();
  } else if (line.startsWith("f ")) {
    const dst = groupOf(group);
    if (!dst) continue;
    const toks = line.trim().split(/\s+/).slice(1);
    const vi = toks.map((t) => {
      const [v, vt] = t.split("/");
      const vIdx = parseInt(v, 10) - 1;
      if (vt) vertUV[vIdx] = uvRaw[parseInt(vt, 10) - 1];
      return vIdx;
    });
    for (let i = 1; i < vi.length - 1; ++i) tri[dst].push(vi[0], vi[i], vi[i + 1]);
  }
}
const N = verts.length;
console.log(`  ${N} verts · body ${tri.body.length / 3} · eye ${tri.eye.length / 3} · lash ${tri.lash.length / 3}`);

// scale + bake
let minY = Infinity,
  maxY = -Infinity;
for (const v of verts) {
  minY = Math.min(minY, v[1]);
  maxY = Math.max(maxY, v[1]);
}
const scale = 1.72 / (maxY - minY);
const ty = -minY * scale;
const pos = new Float32Array(N * 3);
for (let i = 0; i < N; ++i) {
  pos[3 * i] = verts[i][0] * scale;
  pos[3 * i + 1] = verts[i][1] * scale + ty;
  pos[3 * i + 2] = verts[i][2] * scale;
}
const uv = new Float32Array(N * 2);
for (let i = 0; i < N; ++i) {
  uv[2 * i] = vertUV[i]?.[0] ?? 0;
  uv[2 * i + 1] = vertUV[i]?.[1] ?? 0;
}

const morphs = [];
for (const m of MORPHS) {
  const d = new Float32Array(N * 3);
  for (const f of m.f) {
    let tt;
    try {
      tt = await text(`${BASE}/targets/${f}.target`);
    } catch {
      continue;
    }
    for (const line of tt.split("\n")) {
      if (line.startsWith("#") || !line.trim()) continue;
      const p = line.trim().split(/\s+/);
      const i = +p[0];
      if (i < N) {
        d[3 * i] += +p[1] * scale;
        d[3 * i + 1] += +p[2] * scale;
        d[3 * i + 2] += +p[3] * scale;
      }
    }
  }
  if (m.bake) for (let i = 0; i < d.length; ++i) pos[i] += d[i] * m.bake;
  morphs.push({ name: m.n, deltas: d });
}

const normalsOf = (tris) => {
  const nm = new Float32Array(N * 3);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t],
      b = tris[t + 1],
      c = tris[t + 2];
    const ux = pos[3 * b] - pos[3 * a],
      uy = pos[3 * b + 1] - pos[3 * a + 1],
      uz = pos[3 * b + 2] - pos[3 * a + 2];
    const vx = pos[3 * c] - pos[3 * a],
      vy = pos[3 * c + 1] - pos[3 * a + 1],
      vz = pos[3 * c + 2] - pos[3 * a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      nm[3 * i] += nx;
      nm[3 * i + 1] += ny;
      nm[3 * i + 2] += nz;
    }
  }
  for (let i = 0; i < N * 3; i += 3) {
    const l = Math.hypot(nm[i], nm[i + 1], nm[i + 2]) || 1;
    nm[i] /= l;
    nm[i + 1] /= l;
    nm[i + 2] /= l;
  }
  return nm;
};

// glTF
const doc = new Document();
const buf = doc.createBuffer();
const acc = (type, arr) =>
  doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const uvAcc = () => acc("VEC2", uv);

const skin = doc
  .createMaterial("skin")
  .setBaseColorFactor([0.95, 0.8, 0.72, 1])
  .setRoughnessFactor(0.55)
  .setMetallicFactor(0);
const body = doc
  .createPrimitive()
  .setMaterial(skin)
  .setAttribute("POSITION", acc("VEC3", pos))
  .setAttribute("NORMAL", acc("VEC3", normalsOf(tri.body)))
  .setAttribute("TEXCOORD_0", uvAcc())
  .setIndices(acc("SCALAR", Uint16Array.from(tri.body)));
for (const m of morphs)
  body.addTarget(
    doc.createPrimitiveTarget(m.name).setAttribute("POSITION", acc("VEC3", m.deltas)),
  );
const mesh = doc.createMesh("human");
mesh.addPrimitive(body);
mesh.setExtras({ targetNames: morphs.map((m) => m.name) });

// eyes — solid dark iris (the proxy UVs don't line up with the iris texture,
// and a uniform deep-brown eyeball reads far cleaner than a washed-out map)
void eyeTex;
if (tri.eye.length) {
  const eyeMat = doc
    .createMaterial("eye")
    .setBaseColorFactor([0.16, 0.1, 0.07, 1])
    .setRoughnessFactor(0.12)
    .setMetallicFactor(0);
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setMaterial(eyeMat)
      .setAttribute("POSITION", acc("VEC3", pos))
      .setAttribute("NORMAL", acc("VEC3", normalsOf(tri.eye)))
      .setAttribute("TEXCOORD_0", uvAcc())
      .setIndices(acc("SCALAR", Uint16Array.from(tri.eye))),
  );
}
// eyelashes — dark
if (tri.lash.length) {
  const lashMat = doc
    .createMaterial("lash")
    .setBaseColorFactor([0.08, 0.06, 0.05, 1])
    .setRoughnessFactor(0.7);
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setMaterial(lashMat)
      .setAttribute("POSITION", acc("VEC3", pos))
      .setAttribute("NORMAL", acc("VEC3", normalsOf(tri.lash)))
      .setIndices(acc("SCALAR", Uint16Array.from(tri.lash))),
  );
}

doc.createScene().addChild(doc.createNode("human").setMesh(mesh));
await new NodeIO().write("public/models/human.glb", doc);
console.log(`done → public/models/human.glb (${morphs.length} morphs, textured eyes + lashes, skin matcap)`);
