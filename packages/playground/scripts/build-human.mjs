// Bake a parametric Korean-beauty-leaning human GLB from MakeHuman's CC0 base
// mesh + morph targets, with real MakeHuman accessory assets for hair, brows,
// and lashes. The result is still a plain glTF playground asset, but it starts
// from a recognisable human base instead of a naked body plus ad-hoc alien eyes.
//
// MakeHuman's base mesh / targets / system assets are CC0 (public domain), so
// they drop cleanly into this MIT project.
//
// Run: node scripts/build-human.mjs  →  public/models/human.glb (+ skin matcap)
import { Document, NodeIO } from "@gltf-transform/core";
import { mkdirSync, writeFileSync } from "fs";
import { PNG } from "pngjs";

// A procedural skin diffuse — base tone + low-frequency colour variation + fine
// pore noise — so the skin isn't a flat plastic fill (the CC0 skin-texture
// servers are unreachable here, so generate one). Mapped through the base UVs.
const skinTexturePNG = (size = 512) => {
  let seed = 0x5eed1234;
  const rand = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const img = new PNG({ width: size, height: size });
  const G = 24; // coarse tone grid
  const grid = Array.from({ length: G + 1 }, () =>
    Array.from({ length: G + 1 }, () => rand()),
  );
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let y = 0; y < size; ++y)
    for (let x = 0; x < size; ++x) {
      const gx = (x / size) * G,
        gy = (y / size) * G;
      const x0 = Math.floor(gx),
        y0 = Math.floor(gy);
      const tx = gx - x0,
        ty = gy - y0;
      const low =
        lerp(
          lerp(grid[y0][x0], grid[y0][x0 + 1], tx),
          lerp(grid[y0 + 1][x0], grid[y0 + 1][x0 + 1], tx),
          ty,
        ) - 0.5; // [-0.5,0.5]
      const pore = (rand() - 0.5) * 0.06;
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
const ASSET_BASE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman-assets/master/base";

// Bake-only macro targets: first establish a young female body, then lean the
// neutral MakeHuman face/body toward an East-Asian base. Kept moderate because
// exaggerated macro targets quickly read as caricature in close-up.
const BASE_BAKES = [
  {
    f: "macrodetails/universal-female-young-averagemuscle-averageweight",
    bake: 0.78,
  },
  { f: "macrodetails/asian-female-young", bake: 0.58 },
  {
    f: "macrodetails/proportions/female-young-averagemuscle-averageweight-idealproportions",
    bake: 0.22,
  },
];

// Beauty defaults tuned toward a generalised East-Asian / Korean "미인상" (NOT
// any real person): almond eyes, light aegyo-sal, small nose, soft cheeks, and a
// slimmer lower face. The baked values stay conservative; the sliders expose
// the same targets for further tuning.
const MORPHS = [
  {
    n: "eye-size",
    f: ["eyes/l-eye-scale-incr", "eyes/r-eye-scale-incr"],
    bake: 0.18,
  },
  {
    n: "eye-height",
    f: ["eyes/l-eye-height2-incr", "eyes/r-eye-height2-incr"],
    bake: 0.06,
  },
  {
    n: "eye-epicanthus",
    f: ["eyes/l-eye-epicanthus-in", "eyes/r-eye-epicanthus-in"],
    bake: 0.24,
  },
  {
    n: "eye-outer-corner",
    f: ["eyes/l-eye-corner2-up", "eyes/r-eye-corner2-up"],
    bake: 0.14,
  },
  {
    n: "eye-fold",
    f: ["eyes/l-eye-eyefold-down", "eyes/r-eye-eyefold-down"],
    bake: 0.12,
  },
  {
    n: "aegyo-sal",
    f: ["eyes/l-eye-bag-incr", "eyes/r-eye-bag-incr"],
    bake: 0.14,
  },
  {
    n: "nose-size",
    f: ["nose/nose-scale-vert-incr", "nose/nose-scale-depth-incr"],
    bake: -0.22,
  },
  {
    n: "nose-width",
    f: ["nose/nose-width1-incr", "nose/nose-width2-incr"],
    bake: -0.26,
  },
  {
    n: "lips",
    f: ["mouth/mouth-upperlip-height-incr", "mouth/mouth-lowerlip-height-incr"],
    bake: 0.18,
  },
  { n: "mouth-width", f: ["mouth/mouth-scale-horiz-incr"], bake: -0.12 },
  {
    n: "chin",
    f: ["chin/chin-width-incr", "chin/chin-height-incr"],
    bake: -0.2,
  },
  { n: "jaw-drop", f: ["chin/chin-jaw-drop-incr"], bake: -0.12 },
  {
    n: "cheekbones",
    f: ["cheek/l-cheek-bones-incr", "cheek/r-cheek-bones-incr"],
    bake: 0.24,
  },
  {
    n: "cheek-volume",
    f: ["cheek/l-cheek-volume-incr", "cheek/r-cheek-volume-incr"],
    bake: 0.14,
  },
  { n: "head-width", f: ["head/head-scale-horiz-incr"], bake: -0.08 },
  {
    n: "body-hourglass",
    f: ["bodyshapes/bodyshapes-elvs-fem-neat-hourglass"],
    bake: 0.28,
  },
  { n: "bust", f: ["measure/measure-bust-circ-incr"], bake: 0.1 },
  { n: "underbust", f: ["measure/measure-underbust-circ-incr"], bake: -0.1 },
  { n: "hips", f: ["measure/measure-hips-circ-incr"], bake: 0.14 },
  { n: "thigh", f: ["measure/measure-thigh-circ-incr"], bake: 0.06 },
  { n: "shoulder", f: ["measure/measure-shoulder-dist-incr"], bake: -0.08 },
  { n: "neck", f: ["measure/measure-neck-circ-incr"], bake: -0.08 },
  { n: "calf", f: ["measure/measure-calf-circ-incr"] },
  { n: "buttocks", f: ["buttocks/buttocks-volume-incr"], bake: 0.1 },
];

const text = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
};
const bin = async (url) => Buffer.from(await (await fetch(url)).arrayBuffer());

mkdirSync("public/models", { recursive: true });

console.log("fetching MakeHuman base mesh + CC0 assets…");
const obj = await text(`${BASE}/3dobjs/base.obj`);
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
    for (let i = 1; i < vi.length - 1; ++i)
      tri[dst].push(vi[0], vi[i], vi[i + 1]);
  }
}
const N = verts.length;
console.log(
  `  ${N} verts · body ${tri.body.length / 3} · eye ${tri.eye.length / 3} · lash ${tri.lash.length / 3}`,
);

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
const applyTarget = async (file, weight, target) => {
  let tt;
  try {
    tt = await text(`${BASE}/targets/${file}.target`);
  } catch {
    return false;
  }
  for (const line of tt.split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const p = line.trim().split(/\s+/);
    const i = +p[0];
    if (i < N) {
      target[3 * i] += +p[1] * scale * weight;
      target[3 * i + 1] += +p[2] * scale * weight;
      target[3 * i + 2] += +p[3] * scale * weight;
    }
  }
  return true;
};

for (const b of BASE_BAKES) {
  const d = new Float32Array(N * 3);
  if (await applyTarget(b.f, b.bake, d))
    for (let i = 0; i < d.length; ++i) pos[i] += d[i];
}

for (const m of MORPHS) {
  const d = new Float32Array(N * 3);
  for (const f of m.f) await applyTarget(f, 1, d);
  if (m.bake) for (let i = 0; i < d.length; ++i) pos[i] += d[i] * m.bake;
  morphs.push({ name: m.n, deltas: d });
}

const normalsFor = (positions, tris) => {
  const nm = new Float32Array(positions.length);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t],
      b = tris[t + 1],
      c = tris[t + 2];
    const ux = positions[3 * b] - positions[3 * a],
      uy = positions[3 * b + 1] - positions[3 * a + 1],
      uz = positions[3 * b + 2] - positions[3 * a + 2];
    const vx = positions[3 * c] - positions[3 * a],
      vy = positions[3 * c + 1] - positions[3 * a + 1],
      vz = positions[3 * c + 2] - positions[3 * a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      nm[3 * i] += nx;
      nm[3 * i + 1] += ny;
      nm[3 * i + 2] += nz;
    }
  }
  for (let i = 0; i < nm.length; i += 3) {
    const l = Math.hypot(nm[i], nm[i + 1], nm[i + 2]) || 1;
    nm[i] /= l;
    nm[i + 1] /= l;
    nm[i + 2] /= l;
  }
  return nm;
};
const normalsOf = (tris) => normalsFor(pos, tris);

const parseObjAsset = (objText) => {
  const p = [];
  const idx = [];
  for (const line of objText.split("\n")) {
    if (line.startsWith("v ")) {
      const v = line.split(/\s+/);
      p.push(+v[1] * scale, +v[2] * scale + ty, +v[3] * scale);
    } else if (line.startsWith("f ")) {
      const face = line
        .trim()
        .split(/\s+/)
        .slice(1)
        .map((t) => parseInt(t.split("/")[0], 10) - 1);
      for (let i = 1; i < face.length - 1; ++i)
        idx.push(face[0], face[i], face[i + 1]);
    }
  }
  return {
    p: new Float32Array(p),
    idx: p.length / 3 > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx),
  };
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
    doc
      .createPrimitiveTarget(m.name)
      .setAttribute("POSITION", acc("VEC3", m.deltas)),
  );
const mesh = doc.createMesh("human");
mesh.addPrimitive(body);
mesh.setExtras({ targetNames: morphs.map((m) => m.name) });

// eyes — the proxy eyeball becomes the white sclera; iris/pupil/catchlight are
// small flat ellipses on the cornea. Using protruding spheres here is the main
// reason previous close-ups read as alien.
const ellipseDisk = (cx, cy, cz, rx, ry, seg = 40) => {
  const p = [cx, cy, cz];
  const idx = [];
  for (let i = 0; i < seg; ++i) {
    const a = (i / seg) * Math.PI * 2;
    p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cz);
  }
  for (let i = 1; i <= seg; ++i) idx.push(0, i, i === seg ? 1 : i + 1);
  return { p: new Float32Array(p), idx: Uint16Array.from(idx) };
};
const solidPrim = (geom, color) => {
  return doc
    .createPrimitive()
    .setMaterial(
      doc
        .createMaterial()
        .setBaseColorFactor(color)
        .setRoughnessFactor(0.35)
        .setMetallicFactor(0),
    )
    .setAttribute("POSITION", acc("VEC3", geom.p))
    .setAttribute("NORMAL", acc("VEC3", normalsFor(geom.p, geom.idx)))
    .setIndices(acc("SCALAR", geom.idx));
};
const addObjPrimitive = async (name, path, color, roughness = 0.55) => {
  const geom = parseObjAsset(await text(`${ASSET_BASE}/${path}`));
  const prim = solidPrim(geom, color);
  prim
    .getMaterial()
    .setName(name)
    .setDoubleSided(true)
    .setRoughnessFactor(roughness);
  mesh.addPrimitive(prim);
};
if (tri.eye.length) {
  // white sclera (the proxy geometry)
  mesh.addPrimitive(
    doc
      .createPrimitive()
      .setMaterial(
        doc
          .createMaterial("sclera")
          .setBaseColorFactor([0.96, 0.94, 0.91, 1])
          .setRoughnessFactor(0.32),
      )
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
    let cx = 0,
      cy = 0,
      cz = 0,
      minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;
    for (const i of s) {
      const x = pos[3 * i],
        y = pos[3 * i + 1],
        z = pos[3 * i + 2];
      cx += x;
      cy += y;
      cz += z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
    cx /= s.length;
    cy /= s.length;
    cz /= s.length;
    const rx = (maxX - minX) * 0.2;
    const ry = (maxY - minY) * 0.22;
    const fz = maxZ + 0.0015;
    mesh.addPrimitive(
      solidPrim(
        ellipseDisk(cx, cy + ry * 0.04, fz, rx, ry),
        [0.2, 0.115, 0.065, 1],
      ),
    );
    mesh.addPrimitive(
      solidPrim(
        ellipseDisk(cx, cy + ry * 0.04, fz + 0.0003, rx * 0.42, ry * 0.42),
        [0.025, 0.018, 0.015, 1],
      ),
    );
    mesh.addPrimitive(
      solidPrim(
        ellipseDisk(
          cx + rx * 0.28,
          cy + ry * 0.34,
          fz + 0.0006,
          rx * 0.16,
          ry * 0.16,
        ),
        [1, 0.96, 0.86, 1],
      ),
    );
    void cz;
  }
}
await addObjPrimitive(
  "eyebrow011",
  "eyebrows/eyebrow011/eyebrow011.obj",
  [0.13, 0.08, 0.055, 1],
  0.72,
);
await addObjPrimitive(
  "eyelashes03",
  "eyelashes/eyelashes03/eyelashes03.obj",
  [0.035, 0.028, 0.024, 1],
  0.7,
);
await addObjPrimitive(
  "bob02",
  "hair/bob02/bob02.obj",
  [0.12, 0.075, 0.048, 1],
  0.58,
);

doc.createScene().addChild(doc.createNode("human").setMesh(mesh));
await new NodeIO().write("public/models/human.glb", doc);
console.log(
  `done → public/models/human.glb (${morphs.length} morphs, Korean-beauty bake, MakeHuman CC0 hair/brows/lashes)`,
);
