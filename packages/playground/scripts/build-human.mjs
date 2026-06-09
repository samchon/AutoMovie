// Bake the current hero-base GLB.
//
// The previous MakeHuman-only path was useful for morph/channel experiments,
// but the visible result stayed too toy-like for the project goal. This builder
// now starts from Blender Studio's CC0 realistic female body STL as the shape
// scaffold, reduces it into a WebGL-sized mesh, then adds CC0 MakeHuman hair and
// fitted eyes/brows. It is still not the final hero asset, but it moves the
// baseline from "parametric MakeHuman draft" to a realistic sculpt reference.
//
// Sources:
// - Body female realistic by Dan Ulrich, CC0:
//   https://commons.wikimedia.org/wiki/File:Body_female_realistic_by_Dan_Ulrich_(CC0).stl
// - MakeHuman community hair01 CC0 pack:
//   https://static.makehumancommunity.org/assets/assetpacks/hair01.html
//
// Run: node scripts/build-human.mjs -> public/models/human.glb
import { Document, NodeIO } from "@gltf-transform/core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { inflateRawSync } from "zlib";

const CACHE_DIR = "/tmp/autofilm-makehuman-cache";
const BODY_STL =
  "https://upload.wikimedia.org/wikipedia/commons/6/64/Body_female_realistic_by_Dan_Ulrich_%28CC0%29.stl";
const HAIR_PACK =
  "https://files.makehumancommunity.org/asset_packs/hair01/hair01_cc0.zip";
const SKIN_PACK =
  "https://files.makehumancommunity.org/asset_packs/skins01/skins01_cc0.zip";
const HERO_SKIN =
  "skins/onlytheghosts_young_eurasian_female/young_eurasian_female_diffuse.png";
const MH_BASE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data";
const BODY_CACHE = "blender-body-female-realistic.stl";
const BODY_HEIGHT = 1.72;
const BODY_CLUSTER = 0.0025;

const HERO_HAIRS = {
  blackBob: {
    obj: "hair/toigo_inverted_bob/bob_inverted.obj",
    diffuse: "hair/toigo_inverted_bob_with_bangs/BlackHair.png",
    normal: "hair/toigo_inverted_bob/BakedHairNORMAL.png",
    fit: {
      sx: 0.138,
      sy: 0.188,
      sz: 0.113,
      y: 0.24,
      z: -0.03,
    },
  },
  bluntBangBob: {
    obj: "hair/toigo_inverted_bob_with_bangs/bob_inverted_bangs.obj",
    diffuse: "hair/toigo_inverted_bob_with_bangs/BlackHair.png",
    normal: "hair/toigo_inverted_bob_with_bangs/BakedHairNORMAL.png",
    fit: {
      sx: 0.13,
      sy: 0.18,
      sz: 0.11,
      y: 0.278,
      z: -0.025,
    },
  },
};

const HERO_HAIR = HERO_HAIRS[process.env.AUTOFILM_HERO_HAIR ?? "bluntBangBob"];
if (!HERO_HAIR) throw new Error("Unknown AUTOFILM_HERO_HAIR");

const MH_BASE_BAKES = [
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

const MH_BEAUTY_BAKES = [
  {
    f: ["eyes/l-eye-scale-incr", "eyes/r-eye-scale-incr"],
    bake: 0.18,
  },
  {
    f: ["eyes/l-eye-height2-incr", "eyes/r-eye-height2-incr"],
    bake: 0.06,
  },
  {
    f: ["eyes/l-eye-epicanthus-in", "eyes/r-eye-epicanthus-in"],
    bake: 0.24,
  },
  {
    f: ["eyes/l-eye-corner2-up", "eyes/r-eye-corner2-up"],
    bake: 0.14,
  },
  {
    f: ["eyes/l-eye-eyefold-down", "eyes/r-eye-eyefold-down"],
    bake: 0.12,
  },
  {
    f: ["eyes/l-eye-bag-incr", "eyes/r-eye-bag-incr"],
    bake: 0.14,
  },
  {
    f: ["nose/nose-scale-vert-incr", "nose/nose-scale-depth-incr"],
    bake: -0.22,
  },
  {
    f: ["nose/nose-width1-incr", "nose/nose-width2-incr"],
    bake: -0.26,
  },
  {
    f: ["mouth/mouth-upperlip-height-incr", "mouth/mouth-lowerlip-height-incr"],
    bake: 0.18,
  },
  { f: ["mouth/mouth-scale-horiz-incr"], bake: -0.12 },
  { f: ["chin/chin-width-incr", "chin/chin-height-incr"], bake: -0.2 },
  { f: ["chin/chin-jaw-drop-incr"], bake: -0.12 },
  { f: ["cheek/l-cheek-bones-incr", "cheek/r-cheek-bones-incr"], bake: 0.24 },
  { f: ["cheek/l-cheek-volume-incr", "cheek/r-cheek-volume-incr"], bake: 0.14 },
  { f: ["head/head-scale-horiz-incr"], bake: -0.08 },
];

const bin = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
};

const cachedBin = async (name, url) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  const path = join(CACHE_DIR, name);
  if (existsSync(path)) return readFileSync(path);
  const data = await bin(url);
  writeFileSync(path, data);
  return data;
};

const cachedText = async (name, url) =>
  (await cachedBin(name, url)).toString("utf8");

const zipEntry = (zip, name) => {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 66000); --i) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end directory not found");
  const entries = zip.readUInt16LE(eocd + 10);
  let off = zip.readUInt32LE(eocd + 16);
  for (let e = 0; e < entries; ++e) {
    if (zip.readUInt32LE(off) !== 0x02014b50)
      throw new Error("Bad ZIP central directory");
    const method = zip.readUInt16LE(off + 10);
    const csize = zip.readUInt32LE(off + 20);
    const nsize = zip.readUInt16LE(off + 28);
    const xsize = zip.readUInt16LE(off + 30);
    const msize = zip.readUInt16LE(off + 32);
    const local = zip.readUInt32LE(off + 42);
    const path = zip.toString("utf8", off + 46, off + 46 + nsize);
    if (path === name) {
      if (zip.readUInt32LE(local) !== 0x04034b50)
        throw new Error("Bad ZIP local file header");
      const ln = zip.readUInt16LE(local + 26);
      const lx = zip.readUInt16LE(local + 28);
      const start = local + 30 + ln + lx;
      const payload = zip.subarray(start, start + csize);
      if (method === 0) return Buffer.from(payload);
      if (method === 8) return inflateRawSync(payload);
      throw new Error(`Unsupported ZIP compression method ${method}: ${name}`);
    }
    off += 46 + nsize + xsize + msize;
  }
  throw new Error(`ZIP entry not found: ${name}`);
};

const stlBounds = (data) => {
  const tri = data.readUInt32LE(80);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let off = 84, t = 0; t < tri; ++t, off += 50) {
    for (let k = 0; k < 3; ++k) {
      const base = off + 12 + k * 12;
      const p = [
        data.readFloatLE(base),
        data.readFloatLE(base + 4),
        data.readFloatLE(base + 8),
      ];
      for (let i = 0; i < 3; ++i) {
        min[i] = Math.min(min[i], p[i]);
        max[i] = Math.max(max[i], p[i]);
      }
    }
  }
  return { tri, min, max };
};

const normalsFor = (positions, indices) => {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    const ax = positions[3 * a];
    const ay = positions[3 * a + 1];
    const az = positions[3 * a + 2];
    const bx = positions[3 * b];
    const by = positions[3 * b + 1];
    const bz = positions[3 * b + 2];
    const cx = positions[3 * c];
    const cy = positions[3 * c + 1];
    const cz = positions[3 * c + 2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      normals[3 * v] += nx;
      normals[3 * v + 1] += ny;
      normals[3 * v + 2] += nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }
  return normals;
};

const skinColorsFor = (positions) => {
  const colors = new Float32Array((positions.length / 3) * 4);
  const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    const noise =
      Math.sin(x * 91.7 + y * 47.1 + z * 131.3) * 0.012 +
      Math.sin(x * 301.1 + y * 113.9 + z * 59.1) * 0.006;
    const cheek =
      bell(y, 1.54, 0.045) *
      Math.max(0, z - 0.045) *
      (bell(x, -0.055, 0.035) + bell(x, 0.055, 0.035));
    const lip = bell(y, 1.485, 0.018) * bell(x, 0, 0.055) * Math.max(0, z);
    const brow = bell(y, 1.605, 0.02) * Math.max(0, z - 0.045);
    let r = 0.89 + noise + cheek * 0.55 + lip * 1.8 - brow * 0.25;
    let g = 0.65 + noise * 0.75 + cheek * 0.18 + lip * 0.28 - brow * 0.18;
    let b = 0.54 + noise * 0.55 + cheek * 0.12 + lip * 0.18 - brow * 0.14;
    const j = (i / 3) * 4;
    colors[j] = Math.max(0, Math.min(1, r));
    colors[j + 1] = Math.max(0, Math.min(1, g));
    colors[j + 2] = Math.max(0, Math.min(1, b));
    colors[j + 3] = 1;
  }
  return colors;
};

const sculptBeautyBody = (positions) => {
  const bell = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    const y = positions[i + 1];
    let z = positions[i + 2];
    if (y > 1.36 && y < 1.69 && z > -0.015) {
      const front = Math.max(0, Math.min(1, (z + 0.015) / 0.135));
      const jaw = bell(y, 1.44, 0.08);
      const chin = bell(y, 1.405, 0.045);
      const cheek = bell(y, 1.535, 0.065);
      const temple = bell(y, 1.63, 0.06);
      const slim =
        front * (0.17 * chin + 0.105 * jaw - 0.035 * cheek + 0.025 * temple);
      x *= 1 - Math.max(-0.02, slim);
      const noseSoft =
        front *
        bell(x, 0, 0.028) *
        bell(y, 1.555, 0.065) *
        Math.max(0, z - 0.055);
      z -= noseSoft * 0.12;
      const mouthSoft = front * bell(x, 0, 0.05) * bell(y, 1.475, 0.025);
      z += mouthSoft * 0.006;
    }
    positions[i] = x;
    positions[i + 2] = z;
  }
};

const clusteredBodyFromStl = (data) => {
  const { tri, min, max } = stlBounds(data);
  const scale = BODY_HEIGHT / (max[2] - min[2]);
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const clusters = new Map();
  const sums = [];
  const counts = [];
  const indices = [];

  const vertexId = (x0, y0, z0) => {
    const x = (x0 - cx) * scale;
    const y = (z0 - min[2]) * scale;
    const z = -(y0 - cy) * scale;
    const ix = Math.round(x / BODY_CLUSTER);
    const iy = Math.round(y / BODY_CLUSTER);
    const iz = Math.round(z / BODY_CLUSTER);
    const key = `${ix},${iy},${iz}`;
    let id = clusters.get(key);
    if (id === undefined) {
      id = sums.length / 3;
      clusters.set(key, id);
      sums.push(0, 0, 0);
      counts.push(0);
    }
    sums[3 * id] += x;
    sums[3 * id + 1] += y;
    sums[3 * id + 2] += z;
    counts[id] += 1;
    return id;
  };

  for (let off = 84, t = 0; t < tri; ++t, off += 50) {
    const ids = [];
    for (let k = 0; k < 3; ++k) {
      const base = off + 12 + k * 12;
      ids.push(
        vertexId(
          data.readFloatLE(base),
          data.readFloatLE(base + 4),
          data.readFloatLE(base + 8),
        ),
      );
    }
    if (ids[0] !== ids[1] && ids[1] !== ids[2] && ids[2] !== ids[0])
      indices.push(ids[0], ids[1], ids[2]);
  }

  const positions = new Float32Array(sums.length);
  for (let i = 0; i < counts.length; ++i) {
    positions[3 * i] = sums[3 * i] / counts[i];
    positions[3 * i + 1] = sums[3 * i + 1] / counts[i];
    positions[3 * i + 2] = sums[3 * i + 2] / counts[i];
  }
  sculptBeautyBody(positions);
  const indexArray =
    positions.length / 3 > 65535
      ? Uint32Array.from(indices)
      : Uint16Array.from(indices);
  return {
    p: positions,
    n: normalsFor(positions, indexArray),
    c: skinColorsFor(positions),
    idx: indexArray,
  };
};

const ellipseDisk = (cx, cy, cz, rx, ry, segs = 40) => {
  const p = [cx, cy, cz];
  const idx = [];
  for (let i = 0; i < segs; ++i) {
    const a = (i / segs) * Math.PI * 2;
    p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, cz);
  }
  for (let i = 1; i <= segs; ++i) idx.push(0, i, i === segs ? 1 : i + 1);
  return { p: new Float32Array(p), idx: Uint16Array.from(idx) };
};

const parseHairObj = (objText, fit) => {
  const raw = [];
  const rawUv = [];
  const p = [];
  const uv = [];
  const idx = [];
  const push = (token) => {
    const [v, vt] = token.split("/");
    const vi = parseInt(v, 10) - 1;
    const ti = vt ? parseInt(vt, 10) - 1 : -1;
    const xyz = raw[vi] ?? [0, 0, 0];
    const t = rawUv[ti] ?? [0, 0];
    const out = p.length / 3;
    p.push(xyz[0] * fit.sx, xyz[1] * fit.sy + fit.y, xyz[2] * fit.sz + fit.z);
    uv.push(t[0], 1 - t[1]);
    idx.push(out);
  };
  for (const line of objText.split("\n")) {
    if (line.startsWith("v ")) {
      const v = line.split(/\s+/);
      raw.push([+v[1], +v[2], +v[3]]);
    } else if (line.startsWith("vt ")) {
      const v = line.split(/\s+/);
      rawUv.push([+v[1], +v[2]]);
    } else if (line.startsWith("f ")) {
      const face = line.trim().split(/\s+/).slice(1);
      for (let i = 1; i < face.length - 1; ++i) {
        push(face[0]);
        push(face[i]);
        push(face[i + 1]);
      }
    }
  }
  return {
    p: new Float32Array(p),
    uv: new Float32Array(uv),
    idx: p.length / 3 > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx),
  };
};

const makeHumanHead = async () => {
  const obj = await cachedText(
    "makehuman-base.obj",
    `${MH_BASE}/3dobjs/base.obj`,
  );
  const verts = [];
  const uvRaw = [];
  const vertUv = [];
  const tri = { body: [], eye: [], lash: [] };
  let group = "";
  const groupOf = (g) =>
    g === "body"
      ? "body"
      : g === "helper-l-eye" || g === "helper-r-eye"
        ? "eye"
        : g.startsWith("helper-l-eyelashes") ||
            g.startsWith("helper-r-eyelashes")
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
        if (vt) vertUv[vIdx] = uvRaw[parseInt(vt, 10) - 1];
        return vIdx;
      });
      for (let i = 1; i < vi.length - 1; ++i)
        tri[dst].push(vi[0], vi[i], vi[i + 1]);
    }
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of verts) {
    minY = Math.min(minY, v[1]);
    maxY = Math.max(maxY, v[1]);
  }
  const scale = BODY_HEIGHT / (maxY - minY);
  const ty = -minY * scale;
  const positions = new Float32Array(verts.length * 3);
  for (let i = 0; i < verts.length; ++i) {
    positions[3 * i] = verts[i][0] * scale;
    positions[3 * i + 1] = verts[i][1] * scale + ty;
    positions[3 * i + 2] = verts[i][2] * scale;
  }
  const uv = new Float32Array(verts.length * 2);
  for (let i = 0; i < verts.length; ++i) {
    uv[2 * i] = vertUv[i]?.[0] ?? 0;
    uv[2 * i + 1] = vertUv[i]?.[1] ?? 0;
  }

  const applyTarget = async (file, weight) => {
    let target;
    try {
      target = await cachedText(
        `makehuman-target-${file.replaceAll("/", "__")}.target`,
        `${MH_BASE}/targets/${file}.target`,
      );
    } catch {
      return;
    }
    for (const line of target.split("\n")) {
      if (line.startsWith("#") || !line.trim()) continue;
      const p = line.trim().split(/\s+/);
      const i = +p[0];
      if (i >= verts.length) continue;
      positions[3 * i] += +p[1] * scale * weight;
      positions[3 * i + 1] += +p[2] * scale * weight;
      positions[3 * i + 2] += +p[3] * scale * weight;
    }
  };
  for (const b of MH_BASE_BAKES) await applyTarget(b.f, b.bake);
  for (const m of MH_BEAUTY_BAKES)
    for (const f of m.f) await applyTarget(f, m.bake);

  const headIdx = [];
  for (let i = 0; i < tri.body.length; i += 3) {
    const a = tri.body[i];
    const b = tri.body[i + 1];
    const c = tri.body[i + 2];
    const ids = [a, b, c];
    const ys = ids.map((id) => positions[3 * id + 1]);
    const xs = ids.map((id) => Math.abs(positions[3 * id]));
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const headOrNeck = minY > 1.31;
    if (headOrNeck) headIdx.push(a, b, c);
  }

  return {
    p: positions,
    uv,
    headIdx: Uint16Array.from(headIdx),
    eyeIdx: Uint16Array.from(tri.eye),
  };
};

const filterBodyWithoutHead = (geom) => {
  const idx = [];
  for (let i = 0; i < geom.idx.length; i += 3) {
    const ids = [geom.idx[i], geom.idx[i + 1], geom.idx[i + 2]];
    const maxY = Math.max(...ids.map((id) => geom.p[3 * id + 1]));
    const maxX = Math.max(...ids.map((id) => Math.abs(geom.p[3 * id])));
    if (maxY > 1.55 && maxX < 0.18) continue;
    idx.push(...ids);
  }
  const indexArray =
    geom.p.length / 3 > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx);
  return {
    p: geom.p,
    n: normalsFor(geom.p, indexArray),
    c: geom.c,
    idx: indexArray,
  };
};

mkdirSync("public/models", { recursive: true });

console.log("fetching cached CC0 realistic body + MakeHuman head assets…");
const bodyStl = await cachedBin(BODY_CACHE, BODY_STL);
const mh = await makeHumanHead();
const hairPack = await cachedBin("hair01_cc0.zip", HAIR_PACK);
const skinPack = await cachedBin("skins01_cc0.zip", SKIN_PACK);
const hairObj = zipEntry(hairPack, HERO_HAIR.obj).toString("utf8");
const hairDiffuse = zipEntry(hairPack, HERO_HAIR.diffuse);
const hairNormal = zipEntry(hairPack, HERO_HAIR.normal);
const skinDiffuse = zipEntry(skinPack, HERO_SKIN);

console.log("simplifying Blender Studio body STL…");
const bodyGeom = filterBodyWithoutHead(clusteredBodyFromStl(bodyStl));
console.log(
  `  body ${bodyGeom.p.length / 3} verts · ${bodyGeom.idx.length / 3} triangles`,
);

const doc = new Document();
const buf = doc.createBuffer();
const acc = (type, arr) =>
  doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const prim = (geom, material, withUv = false, withColor = false) => {
  const p = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute("POSITION", acc("VEC3", geom.p))
    .setAttribute("NORMAL", acc("VEC3", geom.n ?? normalsFor(geom.p, geom.idx)))
    .setIndices(acc("SCALAR", geom.idx));
  if (withUv) p.setAttribute("TEXCOORD_0", acc("VEC2", geom.uv));
  if (withColor) p.setAttribute("COLOR_0", acc("VEC4", geom.c));
  return p;
};

const mesh = doc.createMesh("hero-realistic-female");
const skinMaterial = doc
  .createMaterial("warm-skin")
  .setBaseColorFactor([1, 1, 1, 1])
  .setRoughnessFactor(0.52)
  .setMetallicFactor(0);
mesh.addPrimitive(prim(bodyGeom, skinMaterial, false, true));

const mhSkinTexture = doc
  .createTexture("natural-makeup-skin")
  .setImage(new Uint8Array(skinDiffuse))
  .setMimeType("image/png");
const mhSkin = doc
  .createMaterial("makehuman-head-skin")
  .setBaseColorFactor([1, 1, 1, 1])
  .setBaseColorTexture(mhSkinTexture)
  .setRoughnessFactor(0.58)
  .setMetallicFactor(0);
mesh.addPrimitive(
  doc
    .createPrimitive()
    .setMaterial(mhSkin)
    .setAttribute("POSITION", acc("VEC3", mh.p))
    .setAttribute("NORMAL", acc("VEC3", normalsFor(mh.p, mh.headIdx)))
    .setAttribute("TEXCOORD_0", acc("VEC2", mh.uv))
    .setIndices(acc("SCALAR", mh.headIdx)),
);

const sclera = doc
  .createMaterial("sclera")
  .setBaseColorFactor([0.96, 0.94, 0.91, 1])
  .setRoughnessFactor(0.32)
  .setMetallicFactor(0);
const iris = doc
  .createMaterial("iris-brown")
  .setBaseColorFactor([0.2, 0.115, 0.065, 1])
  .setRoughnessFactor(0.35)
  .setMetallicFactor(0)
  .setDoubleSided(true);
const pupil = doc
  .createMaterial("pupil")
  .setBaseColorFactor([0.01, 0.008, 0.006, 1])
  .setRoughnessFactor(0.28)
  .setMetallicFactor(0)
  .setDoubleSided(true);
const catchlight = doc
  .createMaterial("catchlight")
  .setBaseColorFactor([1, 0.96, 0.86, 1])
  .setRoughnessFactor(0.2)
  .setMetallicFactor(0)
  .setDoubleSided(true);

mesh.addPrimitive(
  doc
    .createPrimitive()
    .setMaterial(sclera)
    .setAttribute("POSITION", acc("VEC3", mh.p))
    .setAttribute("NORMAL", acc("VEC3", normalsFor(mh.p, mh.eyeIdx)))
    .setIndices(acc("SCALAR", mh.eyeIdx)),
);
const eyeUsed = new Set(mh.eyeIdx);
const eyeSides = { left: [], right: [] };
for (const i of eyeUsed)
  (mh.p[3 * i] >= 0 ? eyeSides.left : eyeSides.right).push(i);
for (const s of [eyeSides.left, eyeSides.right]) {
  if (!s.length) continue;
  let cx = 0;
  let cy = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const i of s) {
    const x = mh.p[3 * i];
    const y = mh.p[3 * i + 1];
    const z = mh.p[3 * i + 2];
    cx += x;
    cy += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  cx /= s.length;
  cy /= s.length;
  const rx = (maxX - minX) * 0.2;
  const ry = (maxY - minY) * 0.22;
  const fz = maxZ + 0.0015;
  mesh.addPrimitive(prim(ellipseDisk(cx, cy + ry * 0.04, fz, rx, ry), iris));
  mesh.addPrimitive(
    prim(
      ellipseDisk(cx, cy + ry * 0.04, fz + 0.0003, rx * 0.42, ry * 0.42),
      pupil,
    ),
  );
  mesh.addPrimitive(
    prim(
      ellipseDisk(
        cx + rx * 0.28,
        cy + ry * 0.34,
        fz + 0.0006,
        rx * 0.16,
        ry * 0.16,
      ),
      catchlight,
    ),
  );
}

const hairTexture = doc
  .createTexture("black-hair")
  .setImage(new Uint8Array(hairDiffuse))
  .setMimeType("image/png");
const hairNormalTexture = doc
  .createTexture("hair-normal")
  .setImage(new Uint8Array(hairNormal))
  .setMimeType("image/png");
const hairMaterial = doc
  .createMaterial("black-bob")
  .setBaseColorFactor([1, 1, 1, 1])
  .setBaseColorTexture(hairTexture)
  .setNormalTexture(hairNormalTexture)
  .setNormalScale(0.18)
  .setRoughnessFactor(0.62)
  .setMetallicFactor(0)
  .setAlphaMode("BLEND")
  .setDoubleSided(true);
mesh.addPrimitive(
  prim(parseHairObj(hairObj, HERO_HAIR.fit), hairMaterial, true),
);

doc.createScene().addChild(doc.createNode("human").setMesh(mesh));
await new NodeIO().write("public/models/human.glb", doc);
console.log("done -> public/models/human.glb");
