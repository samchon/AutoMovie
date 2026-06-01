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
import { PNG } from "pngjs";

// A procedural skin diffuse — base tone + low-frequency colour variation + fine
// pore noise — so the skin isn't a flat plastic fill (the CC0 skin-texture
// servers are unreachable here, so generate one). Mapped through the base UVs.
const skinTexturePNG = (size = 512) => {
  const img = new PNG({ width: size, height: size });
  const G = 24; // coarse tone grid
  const grid = Array.from({ length: G + 1 }, () =>
    Array.from({ length: G + 1 }, () => Math.random()),
  );
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < size; ++y)
    for (let x = 0; x < size; ++x) {
      const gx = (x / size) * G, gy = (y / size) * G;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = gx - x0, ty = gy - y0;
      const low =
        lerp(
          lerp(grid[y0][x0], grid[y0][x0 + 1], tx),
          lerp(grid[y0 + 1][x0], grid[y0 + 1][x0 + 1], tx),
          ty,
        ) - 0.5; // [-0.5,0.5]
      const pore = (Math.random() - 0.5) * 0.06;
      const v = 1 + low * 0.1 + pore;
      const i = (y * size + x) << 2;
      img.data[i] = Math.min(255, 232 * v + low * 14); // R (slightly warmer in dark spots)
      img.data[i + 1] = Math.min(255, 198 * v);
      img.data[i + 2] = Math.min(255, 178 * v);
      img.data[i + 3] = 255;
    }
  return PNG.sync.write(img);
};

const BASE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data";

// Beauty defaults tuned toward a generalised East-Asian "미인상" (NOT any real
// person): V-line jaw, small high-bridged nose, large almond eyes + aegyo-sal,
// high cheekbones over a slim lower face, a small face and mouth.
const MORPHS = [
  { n: "eye-size", f: ["eyes/l-eye-scale-incr", "eyes/r-eye-scale-incr"], bake: 0.7 },
  { n: "eye-height", f: ["eyes/l-eye-height2-incr", "eyes/r-eye-height2-incr"], bake: 0.5 },
  { n: "aegyo-sal", f: ["eyes/l-eye-bag-incr", "eyes/r-eye-bag-incr"], bake: 0.28 },
  { n: "nose-size", f: ["nose/nose-scale-vert-incr", "nose/nose-scale-depth-incr"], bake: -0.6 },
  { n: "nose-width", f: ["nose/nose-width1-incr", "nose/nose-width2-incr"], bake: -0.6 },
  { n: "lips", f: ["mouth/mouth-upperlip-height-incr", "mouth/mouth-lowerlip-height-incr"], bake: 0.4 },
  { n: "mouth-width", f: ["mouth/mouth-scale-horiz-incr"], bake: -0.32 },
  { n: "chin", f: ["chin/chin-width-incr", "chin/chin-height-incr"], bake: -0.55 },
  { n: "jaw-drop", f: ["chin/chin-jaw-drop-incr"], bake: -0.3 },
  { n: "cheekbones", f: ["cheek/l-cheek-bones-incr", "cheek/r-cheek-bones-incr"], bake: 0.55 },
  { n: "cheek-volume", f: ["cheek/l-cheek-volume-incr", "cheek/r-cheek-volume-incr"], bake: 0.22 },
  { n: "head-width", f: ["head/head-scale-horiz-incr"], bake: -0.2 },
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

const skinTex = doc
  .createTexture("skin")
  .setImage(new Uint8Array(skinTexturePNG()))
  .setMimeType("image/png");
const skin = doc
  .createMaterial("skin")
  .setBaseColorFactor([1, 1, 1, 1])
  .setBaseColorTexture(skinTex)
  .setRoughnessFactor(0.58)
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

// eyes — the proxy eyeball becomes the white sclera; readable iris + pupil
// spheres are placed in front of each eye centre (a textured iris won't map
// cleanly to the proxy UVs, and a uniform dark ball looks like a monster).
void eyeTex;
const sphere = (cx, cy, cz, r, seg = 16) => {
  const p = [];
  const idx = [];
  for (let i = 0; i <= seg; ++i) {
    const v = (i / seg) * Math.PI;
    for (let j = 0; j <= seg; ++j) {
      const u = (j / seg) * 2 * Math.PI;
      p.push(cx + r * Math.sin(v) * Math.cos(u), cy + r * Math.cos(v), cz + r * Math.sin(v) * Math.sin(u));
    }
  }
  const row = seg + 1;
  for (let i = 0; i < seg; ++i)
    for (let j = 0; j < seg; ++j) {
      const a = i * row + j;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  return { p: new Float32Array(p), idx: Uint16Array.from(idx) };
};
const solidPrim = (geom, color) => {
  const nm = new Float32Array(geom.p.length);
  // smooth normals = direction from local centre is fine for spheres; recompute
  for (let t = 0; t < geom.idx.length; t += 3) {
    const a = geom.idx[t], b = geom.idx[t + 1], c = geom.idx[t + 2];
    const ux = geom.p[3 * b] - geom.p[3 * a], uy = geom.p[3 * b + 1] - geom.p[3 * a + 1], uz = geom.p[3 * b + 2] - geom.p[3 * a + 2];
    const vx = geom.p[3 * c] - geom.p[3 * a], vy = geom.p[3 * c + 1] - geom.p[3 * a + 1], vz = geom.p[3 * c + 2] - geom.p[3 * a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) { nm[3 * i] += nx; nm[3 * i + 1] += ny; nm[3 * i + 2] += nz; }
  }
  for (let i = 0; i < nm.length; i += 3) { const l = Math.hypot(nm[i], nm[i + 1], nm[i + 2]) || 1; nm[i] /= l; nm[i + 1] /= l; nm[i + 2] /= l; }
  return doc
    .createPrimitive()
    .setMaterial(doc.createMaterial().setBaseColorFactor(color).setRoughnessFactor(0.18).setMetallicFactor(0))
    .setAttribute("POSITION", acc("VEC3", geom.p))
    .setAttribute("NORMAL", acc("VEC3", nm))
    .setIndices(acc("SCALAR", geom.idx));
};
if (tri.eye.length) {
  // white sclera (the proxy geometry)
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setMaterial(doc.createMaterial("sclera").setBaseColorFactor([0.92, 0.9, 0.88, 1]).setRoughnessFactor(0.25))
      .setAttribute("POSITION", acc("VEC3", pos))
      .setAttribute("NORMAL", acc("VEC3", normalsOf(tri.eye)))
      .setIndices(acc("SCALAR", Uint16Array.from(tri.eye))),
  );
  // per-eye centre + radius from the proxy verts, split left/right by x
  const used = new Set(tri.eye);
  const side = { l: [], r: [] };
  for (const i of used) (pos[3 * i] >= 0 ? side.l : side.r).push(i);
  for (const s of [side.l, side.r]) {
    if (!s.length) continue;
    let cx = 0, cy = 0, cz = 0, maxZ = -Infinity;
    for (const i of s) { cx += pos[3 * i]; cy += pos[3 * i + 1]; cz += pos[3 * i + 2]; maxZ = Math.max(maxZ, pos[3 * i + 2]); }
    cx /= s.length; cy /= s.length; cz /= s.length;
    let r = 0;
    for (const i of s) r = Math.max(r, Math.hypot(pos[3 * i] - cx, pos[3 * i + 1] - cy, pos[3 * i + 2] - cz));
    const fz = cz + r * 0.62; // iris sits toward the front of the eyeball
    mesh.addPrimitive(solidPrim(sphere(cx, cy, fz, r * 0.62), [0.32, 0.2, 0.12, 1])); // iris
    mesh.addPrimitive(solidPrim(sphere(cx, cy, cz + r * 0.92, r * 0.3), [0.04, 0.03, 0.03, 1])); // pupil
    // eyebrow — a flattened dark arch above the eye (browless reads as uncanny)
    const by = cy + r * 1.35;
    const bz = cz + r * 1.0;
    const brow = sphere(cx, by, bz, r, 14);
    for (let i = 0; i < brow.p.length; i += 3) {
      brow.p[i] = cx + (brow.p[i] - cx) * 1.6;
      brow.p[i + 1] = by + (brow.p[i + 1] - by) * 0.24;
      brow.p[i + 2] = bz + (brow.p[i + 2] - bz) * 0.4;
    }
    mesh.addPrimitive(solidPrim(brow, [0.22, 0.15, 0.11, 1]));
    void maxZ;
  }
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

// hair — a stylised cap over the scalp (bald reads as a mannequin). Head centre
// + radius from the upper verts; the face opening (front-lower) is left bare and
// the back is lengthened into a short bob.
{
  const HEAD = 1.585; // head only (above the neck), in metres
  let hx = 0, hy = 0, hz = 0, hn = 0, top = -Infinity;
  for (let i = 0; i < N; ++i)
    if (pos[3 * i + 1] > HEAD) {
      hx += pos[3 * i]; hy += pos[3 * i + 1]; hz += pos[3 * i + 2]; hn++;
      top = Math.max(top, pos[3 * i + 1]);
    }
  if (hn) {
    hx /= hn; hy /= hn; hz /= hn;
    let hr = 0;
    for (let i = 0; i < N; ++i)
      if (pos[3 * i + 1] > HEAD)
        hr = Math.max(hr, Math.hypot(pos[3 * i] - hx, pos[3 * i + 1] - hy, pos[3 * i + 2] - hz));
    hr = Math.min(hr, 0.105);
    const seg = 26, P = [], rowMap = [];
    for (let i = 0; i <= seg; ++i) {
      const v = (i / seg) * Math.PI, row = [];
      for (let j = 0; j <= seg; ++j) {
        const u = (j / seg) * 2 * Math.PI;
        const sx = Math.sin(v) * Math.cos(u), sy = Math.cos(v), sz = Math.sin(v) * Math.sin(u);
        if (sz > 0.2 && sy < 0.5) { row.push(-1); continue; } // bare the face
        const rr = hr * 1.06;
        let py = hy + rr * sy;
        if (sz < 0.1) py -= Math.max(0, 0.55 - sy) * hr * 1.6; // longer at the back
        row.push(P.length / 3);
        P.push(hx + rr * sx * 1.04, py, hz + rr * sz * 1.06);
      }
      rowMap.push(row);
    }
    const idx = [];
    for (let i = 0; i < seg; ++i)
      for (let j = 0; j < seg; ++j) {
        const a = rowMap[i][j], b = rowMap[i][j + 1], c = rowMap[i + 1][j], d = rowMap[i + 1][j + 1];
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, c, b, b, c, d);
      }
    const hairPrim = solidPrim({ p: new Float32Array(P), idx: Uint16Array.from(idx) }, [0.14, 0.09, 0.07, 1]);
    hairPrim.getMaterial().setDoubleSided(true).setRoughnessFactor(0.55);
    mesh.addPrimitive(hairPrim);
    void top;
  }
}

doc.createScene().addChild(doc.createNode("human").setMesh(mesh));
await new NodeIO().write("public/models/human.glb", doc);
console.log(`done → public/models/human.glb (${morphs.length} morphs, textured eyes + lashes, skin matcap)`);
