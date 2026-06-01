// Build a parametric human GLB from MakeHuman's CC0 base mesh + morph targets.
//
// MakeHuman's base mesh, targets, and skins are released CC0 (public domain) —
// "build a character generator of your own, no restriction on its license" — so
// they drop cleanly into this MIT project. This bakes the base mesh plus a
// curated set of measurement / body-shape targets into a single glTF whose morph
// targets the web editor drives with sliders (real anatomy, not primitives).
//
// Run: node scripts/build-human.mjs  →  public/models/human.glb
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync } from "fs";

const BASE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data";

// Curated CC0 morphs (measurement decr/incr pairs + body-shape + breast/glutes).
const TARGETS = [
  "measure/measure-bust-circ-incr.target",
  "measure/measure-bust-circ-decr.target",
  "measure/measure-underbust-circ-incr.target",
  "measure/measure-underbust-circ-decr.target",
  "measure/measure-hips-circ-incr.target",
  "measure/measure-hips-circ-decr.target",
  "measure/measure-thigh-circ-incr.target",
  "measure/measure-thigh-circ-decr.target",
  "measure/measure-calf-circ-incr.target",
  "measure/measure-calf-circ-decr.target",
  "measure/measure-shoulder-dist-incr.target",
  "measure/measure-shoulder-dist-decr.target",
  "measure/measure-neck-circ-incr.target",
  "measure/measure-neck-circ-decr.target",
  "measure/measure-lowerarm-length-incr.target",
  "measure/measure-lowerarm-length-decr.target",
  "measure/measure-lowerleg-height-incr.target",
  "measure/measure-lowerleg-height-decr.target",
  "breast/breast-volume-vert-up.target",
  "breast/breast-dist-incr.target",
  "buttocks/buttocks-volume-incr.target",
  "buttocks/buttocks-volume-decr.target",
  "bodyshapes/bodyshapes-elvs-fem-neat-hourglass.target",
  "bodyshapes/bodyshapes-elvs-fem-apple.target",
  "bodyshapes/bodyshapes-elvs-fem-triangle.target",
];

const text = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};

console.log("fetching MakeHuman base mesh (CC0)…");
const obj = await text(`${BASE}/3dobjs/base.obj`);
const verts = [];
const tris = [];
for (const line of obj.split("\n")) {
  if (line.startsWith("v ")) {
    const p = line.split(/\s+/);
    verts.push([+p[1], +p[2], +p[3]]);
  } else if (line.startsWith("f ")) {
    const idx = line
      .trim()
      .split(/\s+/)
      .slice(1)
      .map((t) => parseInt(t.split("/")[0], 10) - 1);
    for (let i = 1; i < idx.length - 1; ++i)
      tris.push(idx[0], idx[i], idx[i + 1]);
  }
}
const N = verts.length;
console.log(`  ${N} vertices, ${tris.length / 3} triangles`);

// scale to ~1.75 m tall, feet on the floor
let minY = Infinity,
  maxY = -Infinity;
for (const v of verts) {
  minY = Math.min(minY, v[1]);
  maxY = Math.max(maxY, v[1]);
}
const scale = 1.75 / (maxY - minY);
const ty = -minY * scale;
const positions = new Float32Array(N * 3);
for (let i = 0; i < N; ++i) {
  positions[3 * i] = verts[i][0] * scale;
  positions[3 * i + 1] = verts[i][1] * scale + ty;
  positions[3 * i + 2] = verts[i][2] * scale;
}

// vertex normals
const normals = new Float32Array(N * 3);
for (let t = 0; t < tris.length; t += 3) {
  const a = tris[t],
    b = tris[t + 1],
    c = tris[t + 2];
  const ax = positions[3 * a],
    ay = positions[3 * a + 1],
    az = positions[3 * a + 2];
  const ux = positions[3 * b] - ax,
    uy = positions[3 * b + 1] - ay,
    uz = positions[3 * b + 2] - az;
  const vx = positions[3 * c] - ax,
    vy = positions[3 * c + 1] - ay,
    vz = positions[3 * c + 2] - az;
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  for (const i of [a, b, c]) {
    normals[3 * i] += nx;
    normals[3 * i + 1] += ny;
    normals[3 * i + 2] += nz;
  }
}
for (let i = 0; i < N; ++i) {
  const l =
    Math.hypot(normals[3 * i], normals[3 * i + 1], normals[3 * i + 2]) || 1;
  normals[3 * i] /= l;
  normals[3 * i + 1] /= l;
  normals[3 * i + 2] /= l;
}

// morph targets
const morphs = [];
for (const tp of TARGETS) {
  const tt = await text(`${BASE}/targets/${tp}`);
  const d = new Float32Array(N * 3);
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
  morphs.push({
    name: tp.split("/").pop().replace(".target", ""),
    deltas: d,
  });
  console.log(`  morph: ${morphs[morphs.length - 1].name}`);
}

// assemble glTF with morph targets
const doc = new Document();
const buf = doc.createBuffer();
const acc = (type, arr) =>
  doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const prim = doc
  .createPrimitive()
  .setAttribute("POSITION", acc("VEC3", positions))
  .setAttribute("NORMAL", acc("VEC3", normals))
  .setIndices(acc("SCALAR", Uint16Array.from(tris)));
for (const m of morphs)
  prim.addTarget(
    doc.createPrimitiveTarget(m.name).setAttribute("POSITION", acc("VEC3", m.deltas)),
  );
const mesh = doc.createMesh("human");
mesh.addPrimitive(prim);
mesh.setExtras({ targetNames: morphs.map((m) => m.name) });
const node = doc.createNode("human").setMesh(mesh);
doc.createScene().addChild(node);

mkdirSync("public/models", { recursive: true });
await new NodeIO().write("public/models/human.glb", doc);
console.log(`done → public/models/human.glb (${morphs.length} morphs)`);
