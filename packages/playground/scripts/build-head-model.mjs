import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const makeHuman = path.join(root, ".references/makehuman/makehuman");
const baseObj = path.join(makeHuman, "data/3dobjs/base.obj");
const targetRoot = path.join(makeHuman, "data/targets");
const outPath = path.join(here, "../public/models/head-model.json");

const SCALE_XY = 0.72;
const SCALE_Z = 0.84;
const MIN_HEAD_Y = 5.72;
const INCLUDE_FACE_Y = 5.62;

const readObj = () => {
  const vertices = [];
  const faces = [];
  const groups = new Map();
  let group = "";
  for (const line of fs.readFileSync(baseObj, "utf8").split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      vertices.push([Number(x), Number(y), Number(z)]);
      continue;
    }
    if (line.startsWith("g ")) {
      group = line.slice(2).trim();
      if (!groups.has(group)) groups.set(group, new Set());
      continue;
    }
    if (!line.startsWith("f ")) continue;
    const face = line
      .slice(2)
      .trim()
      .split(/\s+/)
      .map((part) => Number(part.split("/")[0]) - 1);
    if (face.length >= 3) faces.push({ indices: face, group });
    if (group) {
      const bucket = groups.get(group) ?? new Set();
      for (const index of face) bucket.add(index);
      groups.set(group, bucket);
    }
  }
  return { vertices, faces, groups };
};

// MakeHuman CC0 eyeball mesh (both eyes), with iris/sclera UVs -> brown_eye.png
const readEyeObj = () => {
  const file = path.join(makeHuman, "data/eyes/low-poly/low-poly.obj");
  const verts = [];
  const uvs = [];
  const faces = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.split(/\s+/);
      verts.push([Number(x), Number(y), Number(z)]);
    } else if (line.startsWith("vt ")) {
      const [, u, v] = line.split(/\s+/);
      uvs.push([Number(u), Number(v)]);
    } else if (line.startsWith("f ")) {
      faces.push(
        line
          .slice(2)
          .trim()
          .split(/\s+/)
          .map((p) => p.split("/").map((n) => Number(n) - 1)),
      );
    }
  }
  return { verts, uvs, faces };
};

const centroid = (vertices, indices) => {
  if (!indices?.size) return null;
  const point = [0, 0, 0];
  for (const index of indices) {
    const v = vertices[index];
    point[0] += v[0];
    point[1] += v[1];
    point[2] += v[2];
  }
  point[0] /= indices.size;
  point[1] /= indices.size;
  point[2] /= indices.size;
  return point.map((value) => Number(value.toFixed(6)));
};

const parseTarget = (relative) => {
  const file = path.join(targetRoot, relative);
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [idx, dx, dy, dz] = line.trim().split(/\s+/);
    if (idx === undefined || dz === undefined) continue;
    rows.push([
      Number(idx),
      Number(dx) * SCALE_XY,
      Number(dy) * SCALE_XY,
      Number(dz) * SCALE_Z,
    ]);
  }
  return rows;
};

const aggregateTargets = (entries, remap) => {
  const deltas = new Map();
  for (const entry of entries ?? []) {
    const weight = entry.weight ?? 1;
    for (const [sourceIndex, dx, dy, dz] of parseTarget(entry.file)) {
      const index = remap.get(sourceIndex);
      if (index === undefined) continue;
      const prev = deltas.get(index) ?? [0, 0, 0];
      prev[0] += dx * weight;
      prev[1] += dy * weight;
      prev[2] += dz * weight;
      deltas.set(index, prev);
    }
  }
  return [...deltas.entries()]
    .filter(
      ([, d]) => Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) > 0.000001,
    )
    .sort((a, b) => a[0] - b[0])
    .map(([index, d]) => [
      index,
      Number(d[0].toFixed(6)),
      Number(d[1].toFixed(6)),
      Number(d[2].toFixed(6)),
    ]);
};

const remapIndices = (indices, remap) =>
  [...(indices ?? [])]
    .map((index) => remap.get(index))
    .filter((index) => index !== undefined)
    .sort((a, b) => a - b);

const pair = (left, right) => [{ file: left }, { file: right }];

const target = {
  headWidth: {
    plus: [{ file: "head/head-scale-horiz-incr.target" }],
    minus: [{ file: "head/head-scale-horiz-decr.target" }],
  },
  headHeight: {
    plus: [{ file: "head/head-scale-vert-incr.target" }],
    minus: [{ file: "head/head-scale-vert-decr.target" }],
  },
  headDepth: {
    plus: [{ file: "head/head-scale-depth-incr.target" }],
    minus: [{ file: "head/head-scale-depth-decr.target" }],
  },
  cephalicIndex: {
    plus: [
      { file: "head/head-scale-horiz-incr.target", weight: 0.55 },
      { file: "head/head-scale-depth-decr.target", weight: 0.45 },
    ],
    minus: [
      { file: "head/head-scale-horiz-decr.target", weight: 0.55 },
      { file: "head/head-scale-depth-incr.target", weight: 0.45 },
    ],
  },
  occiputDepth: {
    plus: [{ file: "head/head-back-scale-depth-incr.target" }],
    minus: [{ file: "head/head-back-scale-depth-decr.target" }],
  },
  templeWidth: {
    plus: [{ file: "forehead/forehead-temple-incr.target" }],
    minus: [{ file: "forehead/forehead-temple-decr.target" }],
  },
  foreheadHeight: {
    plus: [{ file: "forehead/forehead-scale-vert-incr.target" }],
    minus: [{ file: "forehead/forehead-scale-vert-decr.target" }],
  },
  foreheadSlope: {
    plus: [{ file: "forehead/forehead-trans-forward.target" }],
    minus: [{ file: "forehead/forehead-trans-backward.target" }],
  },
  foreheadBulge: {
    plus: [{ file: "forehead/forehead-nubian-incr.target" }],
    minus: [{ file: "forehead/forehead-nubian-decr.target" }],
  },
  faceLength: {
    plus: [
      { file: "head/head-scale-vert-incr.target", weight: 0.55 },
      { file: "chin/chin-height-incr.target", weight: 0.45 },
    ],
    minus: [
      { file: "head/head-scale-vert-decr.target", weight: 0.55 },
      { file: "chin/chin-height-decr.target", weight: 0.45 },
    ],
  },
  bizygomaticWidth: {
    plus: pair("l-cheek-bones-incr.target", "r-cheek-bones-incr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
    minus: pair("l-cheek-bones-decr.target", "r-cheek-bones-decr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
  },
  cheekboneHeight: {
    plus: pair("l-cheek-trans-up.target", "r-cheek-trans-up.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
    minus: pair("l-cheek-trans-down.target", "r-cheek-trans-down.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
  },
  cheekboneProjection: {
    plus: pair("l-cheek-bones-incr.target", "r-cheek-bones-incr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
    minus: pair("l-cheek-bones-decr.target", "r-cheek-bones-decr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
  },
  cheekFullness: {
    plus: pair("l-cheek-volume-incr.target", "r-cheek-volume-incr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
    minus: pair("l-cheek-volume-decr.target", "r-cheek-volume-decr.target").map(
      (item) => ({ file: `cheek/${item.file}` }),
    ),
  },
  jawWidth: {
    plus: [{ file: "chin/chin-bones-incr.target" }],
    minus: [{ file: "chin/chin-bones-decr.target" }],
  },
  jawAngle: {
    plus: [{ file: "chin/chin-jaw-drop-decr.target" }],
    minus: [{ file: "chin/chin-jaw-drop-incr.target" }],
  },
  jawTaper: {
    plus: [{ file: "chin/chin-width-decr.target" }],
    minus: [{ file: "chin/chin-width-incr.target" }],
  },
  chinWidth: {
    plus: [{ file: "chin/chin-width-incr.target" }],
    minus: [{ file: "chin/chin-width-decr.target" }],
  },
  chinHeight: {
    plus: [{ file: "chin/chin-height-incr.target" }],
    minus: [{ file: "chin/chin-height-decr.target" }],
  },
  chinProjection: {
    plus: [
      { file: "chin/chin-prognathism-incr.target" },
      { file: "chin/chin-prominent-incr.target", weight: 0.5 },
    ],
    minus: [
      { file: "chin/chin-prognathism-decr.target" },
      { file: "chin/chin-prominent-decr.target", weight: 0.5 },
    ],
  },
  chinRoundness: {
    plus: [{ file: "chin/chin-triangle.target", weight: -0.35 }],
    minus: [{ file: "chin/chin-triangle.target" }],
  },
  eyeScale: {
    plus: pair("l-eye-scale-incr.target", "r-eye-scale-incr.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
    minus: pair("l-eye-scale-decr.target", "r-eye-scale-decr.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
  },
  eyeWidth: {
    plus: pair("l-eye-scale-incr.target", "r-eye-scale-incr.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.65 }),
    ),
    minus: pair("l-eye-scale-decr.target", "r-eye-scale-decr.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.65 }),
    ),
  },
  eyeHeight: {
    plus: ["height1", "height2", "height3"].flatMap((band) =>
      pair(`l-eye-${band}-incr.target`, `r-eye-${band}-incr.target`).map(
        (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
      ),
    ),
    minus: ["height1", "height2", "height3"].flatMap((band) =>
      pair(`l-eye-${band}-decr.target`, `r-eye-${band}-decr.target`).map(
        (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
      ),
    ),
  },
  eyeSpacing: {
    plus: pair("l-eye-trans-out.target", "r-eye-trans-out.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 5.5 }),
    ),
    minus: pair("l-eye-trans-in.target", "r-eye-trans-in.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 5.5 }),
    ),
  },
  eyeHeightPosition: {
    plus: pair("l-eye-trans-up.target", "r-eye-trans-up.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
    minus: pair("l-eye-trans-down.target", "r-eye-trans-down.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
  },
  eyeDepth: {
    plus: pair("l-eye-push1-in.target", "r-eye-push1-in.target")
      .concat(pair("l-eye-push2-in.target", "r-eye-push2-in.target"))
      .map((item) => ({ file: `eyes/${item.file}`, weight: 0.55 })),
    minus: pair("l-eye-push1-out.target", "r-eye-push1-out.target")
      .concat(pair("l-eye-push2-out.target", "r-eye-push2-out.target"))
      .map((item) => ({ file: `eyes/${item.file}`, weight: 0.55 })),
  },
  eyeTilt: {
    plus: [
      { file: "eyes/l-eye-corner2-up.target" },
      { file: "eyes/r-eye-corner2-up.target" },
      { file: "eyes/l-eye-corner1-down.target", weight: 0.4 },
      { file: "eyes/r-eye-corner1-down.target", weight: 0.4 },
    ],
    minus: [
      { file: "eyes/l-eye-corner2-down.target" },
      { file: "eyes/r-eye-corner2-down.target" },
      { file: "eyes/l-eye-corner1-up.target", weight: 0.4 },
      { file: "eyes/r-eye-corner1-up.target", weight: 0.4 },
    ],
  },
  outerCanthus: {
    plus: pair("l-eye-corner2-up.target", "r-eye-corner2-up.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
    ),
    minus: pair("l-eye-corner2-down.target", "r-eye-corner2-down.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
    ),
  },
  innerCanthus: {
    plus: pair("l-eye-corner1-up.target", "r-eye-corner1-up.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
    ),
    minus: pair("l-eye-corner1-down.target", "r-eye-corner1-down.target").map(
      (item) => ({ file: `eyes/${item.file}`, weight: 0.45 }),
    ),
  },
  eyelidFold: {
    plus: pair("l-eye-eyefold-up.target", "r-eye-eyefold-up.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
    minus: pair("l-eye-eyefold-down.target", "r-eye-eyefold-down.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
  },
  epicanthus: {
    plus: pair("l-eye-epicanthus-in.target", "r-eye-epicanthus-in.target").map(
      (item) => ({ file: `eyes/${item.file}` }),
    ),
    minus: pair(
      "l-eye-epicanthus-out.target",
      "r-eye-epicanthus-out.target",
    ).map((item) => ({ file: `eyes/${item.file}` })),
  },
  browHeight: {
    plus: [{ file: "eyebrows/eyebrows-trans-up.target" }],
    minus: [{ file: "eyebrows/eyebrows-trans-down.target" }],
  },
  browArc: {
    plus: [{ file: "eyebrows/eyebrows-angle-up.target" }],
    minus: [{ file: "eyebrows/eyebrows-angle-down.target" }],
  },
  browTilt: {
    plus: [{ file: "eyebrows/eyebrows-angle-up.target", weight: 0.45 }],
    minus: [{ file: "eyebrows/eyebrows-angle-down.target", weight: 0.45 }],
  },
  noseLength: {
    plus: [{ file: "nose/nose-scale-vert-incr.target" }],
    minus: [{ file: "nose/nose-scale-vert-decr.target" }],
  },
  bridgeHeight: {
    plus: [
      { file: "nose/nose-greek-incr.target" },
      { file: "nose/nose-hump-incr.target", weight: 0.25 },
    ],
    minus: [
      { file: "nose/nose-greek-decr.target" },
      { file: "nose/nose-hump-decr.target", weight: 0.25 },
    ],
  },
  bridgeWidth: {
    plus: [{ file: "nose/nose-width1-incr.target" }],
    minus: [{ file: "nose/nose-width1-decr.target" }],
  },
  bridgeProjection: {
    plus: [
      { file: "nose/nose-trans-forward.target" },
      { file: "nose/nose-scale-depth-incr.target", weight: 0.4 },
    ],
    minus: [
      { file: "nose/nose-trans-backward.target" },
      { file: "nose/nose-scale-depth-decr.target", weight: 0.4 },
    ],
  },
  dorsumCurve: {
    plus: [{ file: "nose/nose-curve-convex.target" }],
    minus: [{ file: "nose/nose-curve-concave.target" }],
  },
  tipProjection: {
    plus: [{ file: "nose/nose-scale-depth-incr.target" }],
    minus: [{ file: "nose/nose-scale-depth-decr.target" }],
  },
  tipRotation: {
    plus: [{ file: "nose/nose-point-up.target" }],
    minus: [{ file: "nose/nose-point-down.target" }],
  },
  tipWidth: {
    plus: [{ file: "nose/nose-point-width-incr.target" }],
    minus: [{ file: "nose/nose-point-width-decr.target" }],
  },
  alarWidth: {
    plus: [
      { file: "nose/nose-nostrils-width-incr.target" },
      { file: "nose/nose-width3-incr.target", weight: 0.5 },
    ],
    minus: [
      { file: "nose/nose-nostrils-width-decr.target" },
      { file: "nose/nose-width3-decr.target", weight: 0.5 },
    ],
  },
  nostrilFlare: {
    plus: [{ file: "nose/nose-flaring-incr.target" }],
    minus: [{ file: "nose/nose-flaring-decr.target" }],
  },
  noseBaseHeight: {
    plus: [{ file: "nose/nose-base-up.target" }],
    minus: [{ file: "nose/nose-base-down.target" }],
  },
  columellaShow: {
    plus: [{ file: "nose/nose-septumangle-incr.target" }],
    minus: [{ file: "nose/nose-septumangle-decr.target" }],
  },
  mouthWidth: {
    plus: [{ file: "mouth/mouth-scale-horiz-incr.target" }],
    minus: [{ file: "mouth/mouth-scale-horiz-decr.target" }],
  },
  mouthHeightPosition: {
    plus: [{ file: "mouth/mouth-trans-up.target" }],
    minus: [{ file: "mouth/mouth-trans-down.target" }],
  },
  philtrumLength: {
    plus: [
      { file: "mouth/mouth-trans-down.target", weight: 0.45 },
      { file: "mouth/mouth-philtrum-volume-incr.target", weight: 0.45 },
    ],
    minus: [
      { file: "mouth/mouth-trans-up.target", weight: 0.45 },
      { file: "mouth/mouth-philtrum-volume-decr.target", weight: 0.45 },
    ],
  },
  upperLipHeight: {
    plus: [{ file: "mouth/mouth-upperlip-height-incr.target" }],
    minus: [{ file: "mouth/mouth-upperlip-height-decr.target" }],
  },
  lowerLipHeight: {
    plus: [{ file: "mouth/mouth-lowerlip-height-incr.target" }],
    minus: [{ file: "mouth/mouth-lowerlip-height-decr.target" }],
  },
  upperLipFullness: {
    plus: [{ file: "mouth/mouth-upperlip-volume-incr.target" }],
    minus: [{ file: "mouth/mouth-upperlip-volume-decr.target" }],
  },
  lowerLipFullness: {
    plus: [{ file: "mouth/mouth-lowerlip-volume-incr.target" }],
    minus: [{ file: "mouth/mouth-lowerlip-volume-decr.target" }],
  },
  lipProjection: {
    plus: [{ file: "mouth/mouth-scale-depth-incr.target" }],
    minus: [{ file: "mouth/mouth-scale-depth-decr.target" }],
  },
  cupidBow: {
    plus: [{ file: "mouth/mouth-cupidsbow-incr.target" }],
    minus: [{ file: "mouth/mouth-cupidsbow-decr.target" }],
  },
  mouthCornerTilt: {
    plus: [{ file: "mouth/mouth-angles-up.target" }],
    minus: [{ file: "mouth/mouth-angles-down.target" }],
  },
  earScale: {
    plus: pair("l-ear-scale-incr.target", "r-ear-scale-incr.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
    minus: pair("l-ear-scale-decr.target", "r-ear-scale-decr.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
  },
  earHeightPosition: {
    plus: pair("l-ear-trans-up.target", "r-ear-trans-up.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
    minus: pair("l-ear-trans-down.target", "r-ear-trans-down.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
  },
  earRotation: {
    plus: pair("l-ear-rot-backward.target", "r-ear-rot-backward.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
    minus: pair("l-ear-rot-forward.target", "r-ear-rot-forward.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
  },
  earProtrusion: {
    plus: pair("l-ear-wing-incr.target", "r-ear-wing-incr.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
    minus: pair("l-ear-wing-decr.target", "r-ear-wing-decr.target").map(
      (item) => ({ file: `ears/${item.file}` }),
    ),
  },
  leftRightEyeSize: {
    plus: [{ file: "asym/asym-eye-1-l.target" }],
    minus: [{ file: "asym/asym-eye-1-r.target" }],
  },
  noseCenterOffset: {
    plus: [{ file: "asym/asym-nose-1-l.target" }],
    minus: [{ file: "asym/asym-nose-1-r.target" }],
  },
  mouthCenterOffset: {
    plus: [{ file: "asym/asym-mouth-1-l.target" }],
    minus: [{ file: "asym/asym-mouth-1-r.target" }],
  },
};

const parameterGroups = [
  { id: "cranium", label: "Cranium" },
  { id: "faceFrame", label: "Face frame" },
  { id: "eyes", label: "Eyes and brows" },
  { id: "nose", label: "Nose" },
  { id: "mouth", label: "Mouth and lips" },
  { id: "ears", label: "Ears" },
  { id: "asymmetry", label: "Asymmetry" },
];

const param = (id, group, label, positive, negative, metrics = []) => ({
  id,
  group,
  label,
  min: group === "asymmetry" ? -1 : -2,
  max: group === "asymmetry" ? 1 : 2,
  default: 0,
  positive,
  negative,
  metrics,
});

const parameters = [
  param(
    "headWidth",
    "cranium",
    "head width",
    "broader skull and temples",
    "narrower skull and temples",
    ["cephalicWidth", "bizygomaticWidth"],
  ),
  param(
    "headHeight",
    "cranium",
    "head height",
    "taller skull vault",
    "shorter skull vault",
    ["headHeight"],
  ),
  param(
    "headDepth",
    "cranium",
    "head depth",
    "deeper head in profile",
    "shallower head in profile",
    ["profileDepth"],
  ),
  param(
    "cephalicIndex",
    "cranium",
    "cephalic index",
    "shorter and broader head",
    "longer and narrower head",
    ["headWidthDepthRatio"],
  ),
  param(
    "occiputDepth",
    "cranium",
    "occiput depth",
    "fuller back of head",
    "flatter back of head",
    ["occiputProjection"],
  ),
  param(
    "templeWidth",
    "cranium",
    "temple width",
    "fuller temples",
    "recessed temples",
    ["templeToZygoma"],
  ),
  param(
    "foreheadHeight",
    "cranium",
    "forehead height",
    "higher hairline and brow-to-top span",
    "lower forehead",
    ["upperThird"],
  ),
  param(
    "foreheadSlope",
    "cranium",
    "forehead slope",
    "more vertical forehead",
    "more backward-sloping forehead",
    ["profileForeheadAngle"],
  ),
  param(
    "foreheadBulge",
    "cranium",
    "forehead bulge",
    "rounder forehead plane",
    "flatter forehead plane",
    ["foreheadProjection"],
  ),
  param(
    "faceLength",
    "faceFrame",
    "face length",
    "longer facial mask",
    "shorter facial mask",
    ["facialIndex", "middleThird", "lowerThird"],
  ),
  param(
    "bizygomaticWidth",
    "faceFrame",
    "cheekbone width",
    "wider zygomatic arch",
    "narrower zygomatic arch",
    ["bizygomaticWidth"],
  ),
  param(
    "cheekboneHeight",
    "faceFrame",
    "cheekbone height",
    "higher malar apex",
    "lower malar apex",
    ["malarHeight"],
  ),
  param(
    "cheekboneProjection",
    "faceFrame",
    "cheekbone projection",
    "stronger 3/4 malar break",
    "flatter malar plane",
    ["malarProjection"],
  ),
  param(
    "cheekFullness",
    "faceFrame",
    "cheek fullness",
    "rounder youthful cheeks",
    "leaner cheeks",
    ["midCheekVolume"],
  ),
  param(
    "jawWidth",
    "faceFrame",
    "jaw width",
    "broader bigonial width",
    "narrower bigonial width",
    ["jawToZygoma"],
  ),
  param(
    "jawAngle",
    "faceFrame",
    "jaw angle",
    "softer obtuse gonial turn",
    "sharper square gonial turn",
    ["gonialSoftness"],
  ),
  param(
    "jawTaper",
    "faceFrame",
    "jaw taper",
    "strong V-line taper",
    "straighter jaw sides",
    ["chinToJaw"],
  ),
  param(
    "chinWidth",
    "faceFrame",
    "chin width",
    "wider chin point",
    "narrower chin point",
    ["chinToZygoma"],
  ),
  param(
    "chinHeight",
    "faceFrame",
    "chin height",
    "longer chin",
    "shorter chin",
    ["chinHeightToFace"],
  ),
  param(
    "chinProjection",
    "faceFrame",
    "chin projection",
    "forward pogonion",
    "recessed pogonion",
    ["chinProjection"],
  ),
  param(
    "chinRoundness",
    "faceFrame",
    "chin roundness",
    "rounder chin transition",
    "pointed chin transition",
    ["chinCurvature"],
  ),
  // Procedural profile-depth controls (no MakeHuman target — applied as smooth
  // z-only deformations in head.html's applyProfileSculpt). These give the fine
  // profile DOF the coarse MakeHuman depth morphs lack, WITHOUT touching x/y so
  // the converged front view is preserved.
  param(
    "chinSetbackZ",
    "faceFrame",
    "chin set-back (profile)",
    "chin tucked back in profile",
    "chin pushed forward in profile",
  ),
  param(
    "midfaceProjectZ",
    "faceFrame",
    "mid-face projection (profile)",
    "fuller forward mid-face in profile",
    "flatter mid-face in profile",
  ),
  param(
    "eyeScale",
    "eyes",
    "eye scale",
    "larger eye complex",
    "smaller eye complex",
    ["eyeWidthToFace", "eyeHeightToFace"],
  ),
  param("eyeWidth", "eyes", "eye width", "longer fissure", "shorter fissure", [
    "eyeWidthToFace",
  ]),
  param(
    "eyeHeight",
    "eyes",
    "eye height",
    "rounder open aperture",
    "narrower almond aperture",
    ["eyeAperture"],
  ),
  param(
    "eyeSpacing",
    "eyes",
    "eye spacing",
    "wider intercanthal spacing",
    "closer-set eyes",
    ["eyeSpacingToWidth"],
  ),
  param(
    "eyeHeightPosition",
    "eyes",
    "eye vertical position",
    "higher eyes",
    "lower eyes",
    ["eyeLineToFace"],
  ),
  param(
    "eyeDepth",
    "eyes",
    "eye depth",
    "deeper orbital seating",
    "more forward eyes",
    ["orbitalDepth"],
  ),
  param(
    "eyeTilt",
    "eyes",
    "eye tilt",
    "outer canthus higher",
    "outer canthus lower",
    ["eyeTiltDeg"],
  ),
  param(
    "outerCanthus",
    "eyes",
    "outer canthus length",
    "extended outer corner",
    "short outer corner",
    ["outerCanthusSpan"],
  ),
  param(
    "innerCanthus",
    "eyes",
    "inner canthus shape",
    "sharper inner corner",
    "rounder inner corner",
    ["innerCanthusAngle"],
  ),
  param(
    "eyelidFold",
    "eyes",
    "eyelid fold",
    "higher visible double fold",
    "lower or hidden fold",
    ["foldToAperture"],
  ),
  param(
    "epicanthus",
    "eyes",
    "epicanthus",
    "stronger medial fold",
    "more exposed inner canthus",
    ["innerCanthusVisibility"],
  ),
  param("browHeight", "eyes", "brow height", "higher brow", "lower brow", [
    "browEyeDistance",
  ]),
  param(
    "browArc",
    "eyes",
    "brow arc",
    "higher arched brow",
    "straighter brow",
    ["browArc"],
  ),
  param(
    "browTilt",
    "eyes",
    "brow tilt",
    "lifted outer brow",
    "lower outer brow",
    ["browTiltDeg"],
  ),
  param(
    "noseLength",
    "nose",
    "nose length",
    "longer nasion-to-subnasale",
    "shorter nose",
    ["noseLengthToFace"],
  ),
  param(
    "bridgeHeight",
    "nose",
    "bridge height",
    "higher dorsum",
    "lower dorsum",
    ["bridgeProjection"],
  ),
  param(
    "bridgeWidth",
    "nose",
    "bridge width",
    "wider bridge",
    "narrower bridge",
    ["bridgeWidth"],
  ),
  param(
    "bridgeProjection",
    "nose",
    "bridge projection",
    "forward nasal root",
    "flatter nasal root",
    ["radixProjection"],
  ),
  param(
    "dorsumCurve",
    "nose",
    "dorsum curve",
    "convex dorsum",
    "concave dorsum",
    ["dorsumCurve"],
  ),
  param(
    "tipProjection",
    "nose",
    "tip projection",
    "more projecting tip",
    "less projecting tip",
    ["tipProjection"],
  ),
  param(
    "tipRotation",
    "nose",
    "tip rotation",
    "upturned tip",
    "downturned tip",
    ["nasolabialAngle"],
  ),
  param("tipWidth", "nose", "tip width", "broader tip", "narrower tip", [
    "tipWidth",
  ]),
  param(
    "alarWidth",
    "nose",
    "alar width",
    "wider nostril base",
    "narrower nostril base",
    ["noseWidthToFace"],
  ),
  param(
    "nostrilFlare",
    "nose",
    "nostril flare",
    "flared alae",
    "pinched alae",
    ["nostrilOval"],
  ),
  param(
    "noseBaseHeight",
    "nose",
    "nose base height",
    "higher subnasale",
    "lower subnasale",
    ["noseToMouth"],
  ),
  param(
    "columellaShow",
    "nose",
    "columella show",
    "more columella visible",
    "hidden columella",
    ["columellaShow"],
  ),
  param(
    "mouthWidth",
    "mouth",
    "mouth width",
    "wider cheilion span",
    "narrower mouth",
    ["mouthWidthToFace"],
  ),
  param(
    "mouthHeightPosition",
    "mouth",
    "mouth vertical position",
    "higher mouth",
    "lower mouth",
    ["philtrumLength"],
  ),
  param(
    "philtrumLength",
    "mouth",
    "philtrum length",
    "longer philtrum",
    "shorter philtrum",
    ["philtrumToFace"],
  ),
  param(
    "upperLipHeight",
    "mouth",
    "upper lip height",
    "taller upper vermilion",
    "thinner upper vermilion",
    ["upperLipHeight"],
  ),
  param(
    "lowerLipHeight",
    "mouth",
    "lower lip height",
    "taller lower vermilion",
    "thinner lower vermilion",
    ["lowerLipHeight"],
  ),
  param(
    "upperLipFullness",
    "mouth",
    "upper lip fullness",
    "fuller upper lip projection",
    "flatter upper lip",
    ["upperLipProjection"],
  ),
  param(
    "lowerLipFullness",
    "mouth",
    "lower lip fullness",
    "fuller lower lip projection",
    "flatter lower lip",
    ["lowerLipProjection"],
  ),
  param(
    "lipProjection",
    "mouth",
    "lip projection",
    "forward lips",
    "receded lips",
    ["lipProjection"],
  ),
  param(
    "cupidBow",
    "mouth",
    "cupid bow",
    "deeper cupid bow",
    "flatter upper lip bow",
    ["cupidBowDepth"],
  ),
  param(
    "mouthCornerTilt",
    "mouth",
    "mouth corner tilt",
    "upturned corners",
    "downturned corners",
    ["cheilionTilt"],
  ),
  param("earScale", "ears", "ear scale", "larger ears", "smaller ears", [
    "earHeightToFace",
  ]),
  param(
    "earHeightPosition",
    "ears",
    "ear vertical position",
    "higher ears",
    "lower ears",
    ["earBrowNoseAlignment"],
  ),
  param(
    "earRotation",
    "ears",
    "ear rotation",
    "tilted-back ear",
    "tilted-forward ear",
    ["earRotation"],
  ),
  param(
    "earProtrusion",
    "ears",
    "ear protrusion",
    "ears stand farther out",
    "ears tucked closer",
    ["earProtrusion"],
  ),
  param(
    "leftRightEyeSize",
    "asymmetry",
    "left/right eye size",
    "viewer-left eye larger",
    "viewer-right eye larger",
    ["eyeAsymmetry"],
  ),
  param(
    "noseCenterOffset",
    "asymmetry",
    "nose center offset",
    "nose shifts viewer-left",
    "nose shifts viewer-right",
    ["noseMouthCentering"],
  ),
  param(
    "mouthCenterOffset",
    "asymmetry",
    "mouth center offset",
    "mouth shifts viewer-left",
    "mouth shifts viewer-right",
    ["noseMouthCentering"],
  ),
];

const references = {
  hero1: {
    name: "hero1 cute",
    sheetPath: "D:/github/samchon/motica/.models/hero/1/input/face.png",
    confidence: "medium",
    grid: { columns: 5, rows: 3 },
    views: {
      front: { column: 0, row: 0 },
      rightThreeQuarter: { column: 1, row: 0 },
      rightProfile: { column: 2, row: 0 },
      top: { column: 3, row: 0 },
      bottom: { column: 4, row: 0 },
      leftThreeQuarter: { column: 0, row: 1 },
      leftProfile: { column: 1, row: 1 },
      back: { column: 2, row: 1 },
      backRightThreeQuarter: { column: 3, row: 1 },
      backLeftThreeQuarter: { column: 4, row: 1 },
      frontClose: { column: 0, row: 2 },
      rightThreeQuarterClose: { column: 1, row: 2 },
      rightProfileClose: { column: 2, row: 2 },
      leftProfileClose: { column: 3, row: 2 },
      eyeClose: { column: 4, row: 2 },
    },
  },
  hero2: {
    name: "hero2 refined beauty",
    sheetPath: "D:/github/samchon/motica/.models/hero/2/input/face.png",
    confidence: "medium",
    grid: { columns: 5, rows: 3 },
    views: {
      front: { column: 0, row: 0 },
      rightThreeQuarter: { column: 1, row: 0 },
      rightProfile: { column: 2, row: 0 },
      top: { column: 3, row: 0 },
      bottom: { column: 4, row: 0 },
      leftThreeQuarter: { column: 0, row: 1 },
      leftProfile: { column: 1, row: 1 },
      back: { column: 2, row: 1 },
      backRightThreeQuarter: { column: 3, row: 1 },
      backLeftThreeQuarter: { column: 4, row: 1 },
      frontClose: { column: 0, row: 2 },
      rightThreeQuarterClose: { column: 1, row: 2 },
      rightProfileClose: { column: 2, row: 2 },
      leftProfileClose: { column: 3, row: 2 },
      eyeClose: { column: 4, row: 2 },
    },
  },
  hero3: {
    name: "hero3 neutral beauty",
    sheetPath: "D:/github/samchon/motica/.models/hero/3/input/face.png",
    confidence: "low",
    grid: { columns: 5, rows: 2 },
    views: {
      front: { column: 0, row: 0 },
      leftThreeQuarter: { column: 1, row: 0 },
      leftProfile: { column: 2, row: 0 },
      rightThreeQuarter: { column: 3, row: 0 },
      frontAlt: { column: 4, row: 0 },
      rightProfile: { column: 0, row: 1 },
      backRightThreeQuarter: { column: 1, row: 1 },
      back: { column: 2, row: 1 },
      backLeftThreeQuarter: { column: 3, row: 1 },
      leftProfileAlt: { column: 4, row: 1 },
    },
    missingViews: ["top", "bottom", "closeups"],
  },
};

const presets = {
  neutral: {
    label: "Neutral MakeHuman base",
    description: "MakeHuman CC0 head subset with all identity axes at zero.",
    values: {},
  },
  hero1: {
    label: "Hero 1 cute",
    description: "Initial numeric pass on MakeHuman axes; not a completed fit.",
    values: {
      headWidth: 0.18,
      headDepth: 0.08,
      foreheadHeight: 0.35,
      foreheadBulge: 0.22,
      faceLength: -0.25,
      cheekFullness: 0.5,
      jawWidth: -0.52,
      jawAngle: 0.62,
      jawTaper: 0.42,
      chinWidth: -0.42,
      chinHeight: -0.62,
      chinProjection: -0.12,
      chinSetbackZ: 2.2,
      midfaceProjectZ: 1.5,
      chinRoundness: 0.5,
      eyeScale: 0.65,
      eyeWidth: -0.15,
      eyeHeight: 1.15,
      eyeSpacing: -0.1,
      eyeTilt: 0.04,
      eyelidFold: 0.2,
      epicanthus: -1.3,
      browHeight: -0.35,
      browArc: 0.0,
      noseLength: -0.25,
      bridgeHeight: 0.4,
      bridgeWidth: -0.08,
      bridgeProjection: 0.3,
      tipProjection: -0.5,
      tipRotation: 0.3,
      tipWidth: -0.6,
      alarWidth: -1.35,
      nostrilFlare: -0.4,
      mouthWidth: -0.5,
      mouthHeightPosition: 0.85,
      philtrumLength: -0.22,
      upperLipHeight: 0.1,
      lowerLipHeight: 0.1,
      upperLipFullness: 0.1,
      lowerLipFullness: 0.04,
      lipProjection: 0.05,
      mouthCornerTilt: 0.16,
      earScale: -0.1,
    },
    targetMetrics: {
      facialIndex: 1.28,
      jawToZygoma: 0.68,
      chinToZygoma: 0.34,
      eyeWidthToFace: 0.245,
      eyeAperture: 0.37,
      eyeSpacingToWidth: 0.95,
      browEyeDistance: 0.78,
      noseWidthToFace: 0.235,
      noseLengthToFace: 0.295,
      mouthWidthToFace: 0.36,
      lowerUpperLip: 1.24,
      chinHeightToFace: 0.15,
      profileDepthToFace: 0.72,
      tipProjectionToFace: 0.17,
    },
  },
  hero2: {
    label: "Hero 2 refined beauty",
    description: "Initial numeric pass on MakeHuman axes; not a completed fit.",
    values: {
      headWidth: -0.08,
      headHeight: 0.08,
      cephalicIndex: -0.1,
      templeWidth: -0.12,
      foreheadHeight: 0.12,
      foreheadSlope: -0.1,
      faceLength: -0.55,
      cheekboneHeight: 0.2,
      cheekboneProjection: 0.25,
      cheekFullness: 0.38,
      jawWidth: -0.55,
      jawAngle: 0.42,
      jawTaper: 0.62,
      chinWidth: -0.48,
      chinHeight: -0.5,
      chinProjection: 0.08,
      chinSetbackZ: 2.0,
      midfaceProjectZ: -0.7,
      eyeScale: 0.45,
      eyeWidth: -0.5,
      eyeHeight: 0.4,
      eyeDepth: 0.18,
      eyeSpacing: -0.05,
      eyeTilt: 0.3,
      outerCanthus: -0.1,
      epicanthus: -1.3,
      eyelidFold: 0.22,
      browHeight: -0.05,
      browArc: 0.3,
      browTilt: 0.2,
      noseLength: 0.0,
      bridgeHeight: 0.0,
      bridgeWidth: -0.24,
      bridgeHeight: 0.3,
      bridgeProjection: 0.3,
      tipProjection: -0.45,
      tipRotation: 0.3,
      tipWidth: -0.1,
      alarWidth: -1.3,
      noseBaseHeight: -0.25,
      nostrilFlare: -0.35,
      columellaShow: 0.12,
      mouthWidth: -0.7,
      mouthHeightPosition: 0.6,
      upperLipHeight: 0.12,
      lowerLipHeight: 0.14,
      upperLipFullness: 0.16,
      lowerLipFullness: 0.1,
      lipProjection: -0.5,
      cupidBow: 0.48,
      earRotation: 0.1,
    },
    targetMetrics: {
      facialIndex: 1.42,
      jawToZygoma: 0.61,
      chinToZygoma: 0.31,
      eyeWidthToFace: 0.225,
      eyeAperture: 0.29,
      eyeSpacingToWidth: 1.1,
      browEyeDistance: 0.96,
      noseWidthToFace: 0.21,
      noseLengthToFace: 0.335,
      mouthWidthToFace: 0.34,
      lowerUpperLip: 1.14,
      chinHeightToFace: 0.19,
      profileDepthToFace: 0.75,
      tipProjectionToFace: 0.2,
    },
  },
  hero3: {
    label: "Hero 3 neutral beauty",
    description:
      "Underconstrained initial pass on MakeHuman axes; not a completed fit.",
    values: {
      foreheadHeight: 0.12,
      faceLength: 0.12,
      cheekboneProjection: 0.08,
      cheekFullness: 0.42,
      jawWidth: -0.18,
      jawAngle: 0.34,
      jawTaper: 0.2,
      chinWidth: -0.18,
      chinSetbackZ: 1.8,
      midfaceProjectZ: -0.15,
      chinRoundness: 0.22,
      eyeScale: 0.3,
      eyeWidth: -0.35,
      eyeHeight: 1.2,
      eyeSpacing: -0.08,
      eyeTilt: 0.08,
      eyelidFold: 0.1,
      epicanthus: -1.1,
      browHeight: 0.05,
      browArc: -0.3,
      noseLength: 0.9,
      bridgeWidth: -0.04,
      bridgeHeight: 0.45,
      bridgeProjection: 0.35,
      tipProjection: -0.55,
      tipRotation: 0.3,
      tipWidth: -0.4,
      alarWidth: -1.3,
      nostrilFlare: -0.4,
      mouthWidth: -0.3,
      upperLipHeight: 0.1,
      lowerLipHeight: -0.15,
      upperLipFullness: 0.12,
      lowerLipFullness: -0.02,
      lipProjection: 0.05,
      earScale: 0.04,
    },
    targetMetrics: {
      facialIndex: 1.34,
      jawToZygoma: 0.67,
      chinToZygoma: 0.35,
      eyeWidthToFace: 0.215,
      eyeAperture: 0.31,
      eyeSpacingToWidth: 1.18,
      browEyeDistance: 0.86,
      noseWidthToFace: 0.225,
      noseLengthToFace: 0.315,
      mouthWidthToFace: 0.335,
      lowerUpperLip: 1.18,
      chinHeightToFace: 0.18,
      profileDepthToFace: 0.72,
      tipProjectionToFace: 0.18,
    },
  },
};

const measurementMetrics = [
  { id: "facialIndex", label: "face height / bizygomatic", view: "front" },
  { id: "jawToZygoma", label: "bigonial / bizygomatic", view: "front" },
  { id: "chinToZygoma", label: "chin width / bizygomatic", view: "front" },
  { id: "eyeWidthToFace", label: "eye fissure / face width", view: "front" },
  { id: "eyeAperture", label: "eye height / eye width", view: "frontClose" },
  { id: "eyeSpacingToWidth", label: "intercanthal / eye width", view: "front" },
  { id: "browEyeDistance", label: "brow-eye / eye height", view: "frontClose" },
  { id: "noseWidthToFace", label: "alar width / face width", view: "front" },
  { id: "noseLengthToFace", label: "nose length / face height", view: "front" },
  { id: "mouthWidthToFace", label: "mouth width / face width", view: "front" },
  { id: "lowerUpperLip", label: "lower lip / upper lip", view: "frontClose" },
  { id: "chinHeightToFace", label: "chin height / face height", view: "front" },
  {
    id: "profileDepthToFace",
    label: "profile depth / face height",
    view: "rightProfile",
  },
  {
    id: "tipProjectionToFace",
    label: "nose tip projection / face height",
    view: "rightProfile",
  },
];

const build = () => {
  const { vertices, faces, groups } = readObj();
  const selected = new Set();
  // Only the MakeHuman `body` skin group is the head. Every other group above
  // the head cut (helper-hair, helper-*-teeth, helper-*-eye, helper-eyelashes,
  // helper-tongue, helper-tights, and the joint-* cubes) is proxy/helper
  // geometry that would weld into the clay mesh as ribbons, bars, and floating
  // boxes — it must never enter the rendered head.
  // Trim the wide, low trapezius/shoulder flaps (the ragged shelves below the
  // neck) so the bust ends in a clean neck + narrow shoulder line instead of
  // jagged wings. Keep head + neck + inner shoulder; drop low & wide verts.
  const SHOULDER_TRIM_Y = 6.3;
  const SHOULDER_TRIM_X = 0.85;
  for (const face of faces) {
    if (face.group !== "body") continue;
    if (face.indices.some((index) => vertices[index][1] >= MIN_HEAD_Y)) {
      for (const index of face.indices) {
        const vx0 = vertices[index][0];
        const vy0 = vertices[index][1];
        if (
          vy0 >= INCLUDE_FACE_Y &&
          !(vy0 < SHOULDER_TRIM_Y && Math.abs(vx0) > SHOULDER_TRIM_X)
        )
          selected.add(index);
      }
    }
  }
  const source = [...selected].sort((a, b) => a - b);
  const remap = new Map(source.map((index, i) => [index, i]));
  const bounds = source.reduce(
    (acc, index) => {
      const v = vertices[index];
      for (let i = 0; i < 3; i++) {
        acc.min[i] = Math.min(acc.min[i], v[i]);
        acc.max[i] = Math.max(acc.max[i], v[i]);
      }
      return acc;
    },
    {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    },
  );
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const positions = source.flatMap((index) => {
    const v = vertices[index];
    return [
      Number(((v[0] - center[0]) * SCALE_XY).toFixed(6)),
      Number(((v[1] - center[1]) * SCALE_XY).toFixed(6)),
      Number(((v[2] - center[2]) * SCALE_Z).toFixed(6)),
    ];
  });
  const toModel = (point) =>
    point
      ? [
          Number(((point[0] - center[0]) * SCALE_XY).toFixed(6)),
          Number(((point[1] - center[1]) * SCALE_XY).toFixed(6)),
          Number(((point[2] - center[2]) * SCALE_Z).toFixed(6)),
        ]
      : null;
  const landmarks = {
    eyeLeft: toModel(centroid(vertices, groups.get("joint-l-eye"))),
    eyeRight: toModel(centroid(vertices, groups.get("joint-r-eye"))),
    eyeTargetLeft: toModel(
      centroid(vertices, groups.get("joint-l-eye-target")),
    ),
    eyeTargetRight: toModel(
      centroid(vertices, groups.get("joint-r-eye-target")),
    ),
    upperLidLeft: toModel(centroid(vertices, groups.get("joint-l-upperlid"))),
    upperLidRight: toModel(centroid(vertices, groups.get("joint-r-upperlid"))),
    lowerLidLeft: toModel(centroid(vertices, groups.get("joint-l-lowerlid"))),
    lowerLidRight: toModel(centroid(vertices, groups.get("joint-r-lowerlid"))),
  };
  const featureGroups = {
    eyeLeft: remapIndices(groups.get("joint-l-eye"), remap),
    eyeRight: remapIndices(groups.get("joint-r-eye"), remap),
    eyeTargetLeft: remapIndices(groups.get("joint-l-eye-target"), remap),
    eyeTargetRight: remapIndices(groups.get("joint-r-eye-target"), remap),
    upperLidLeft: remapIndices(groups.get("joint-l-upperlid"), remap),
    upperLidRight: remapIndices(groups.get("joint-r-upperlid"), remap),
    lowerLidLeft: remapIndices(groups.get("joint-l-lowerlid"), remap),
    lowerLidRight: remapIndices(groups.get("joint-r-lowerlid"), remap),
  };
  const indices = [];
  for (const face of faces) {
    if (face.group !== "body") continue;
    if (!face.indices.every((index) => remap.has(index))) continue;
    for (let i = 1; i < face.indices.length - 1; i++) {
      indices.push(
        remap.get(face.indices[0]),
        remap.get(face.indices[i]),
        remap.get(face.indices[i + 1]),
      );
    }
  }
  // Cap the open neck boundary. The head subset is cut at the neck, leaving a
  // hollow tube whose lit front rim reads as an odd flat trapezoid and whose
  // interior renders as a black hole from below. Find the boundary edges (used
  // by exactly one triangle), walk them into loops, and fan-triangulate the
  // lowest loop (the neck cut) from its own rim vertices, so the cap morphs with
  // the mesh and seats the rim with no gaps.
  {
    const ekey = (a, b) => (a < b ? a * 1e7 + b : b * 1e7 + a);
    const edgeCount = new Map();
    for (let i = 0; i < indices.length; i += 3) {
      const t = [indices[i], indices[i + 1], indices[i + 2]];
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]])
        edgeCount.set(ekey(a, b), (edgeCount.get(ekey(a, b)) || 0) + 1);
    }
    const adj = new Map(); // directed boundary edge a->b in triangle winding
    for (let i = 0; i < indices.length; i += 3) {
      const t = [indices[i], indices[i + 1], indices[i + 2]];
      for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]])
        if (edgeCount.get(ekey(a, b)) === 1) adj.set(a, b);
    }
    const visited = new Set();
    const loops = [];
    for (const start of adj.keys()) {
      if (visited.has(start)) continue;
      const loop = [];
      let cur = start;
      while (cur !== undefined && !visited.has(cur)) {
        visited.add(cur);
        loop.push(cur);
        cur = adj.get(cur);
      }
      if (loop.length >= 3) loops.push(loop);
    }
    const loopY = (loop) =>
      loop.reduce((s, v) => s + positions[v * 3 + 1], 0) / loop.length;
    let neck = null;
    for (const loop of loops) if (!neck || loopY(loop) < loopY(neck)) neck = loop;
    if (neck) {
      // Newell normal to orient the fan so the cap faces down/out (-Y).
      let ny = 0;
      for (let i = 0; i < neck.length; i++) {
        const a = neck[i], b = neck[(i + 1) % neck.length];
        ny += (positions[a * 3 + 2] - positions[b * 3 + 2]) *
          (positions[a * 3] + positions[b * 3]);
      }
      for (let i = 1; i < neck.length - 1; i++) {
        if (ny > 0) indices.push(neck[0], neck[i + 1], neck[i]);
        else indices.push(neck[0], neck[i], neck[i + 1]);
      }
    }
  }
  const morphs = {};
  for (const item of parameters) {
    morphs[item.id] = {
      plus: aggregateTargets(target[item.id]?.plus, remap),
      minus: aggregateTargets(target[item.id]?.minus, remap),
    };
  }
  // Hair shell from MakeHuman's CC0 helper-hair proxy (a long-hair volume guide
  // baked into base.obj), transformed into the same normalized head space so it
  // sits on the scalp and drapes down the back/sides.
  // Emit the FULL hair proxy (uncarved). head.html carves the front face window
  // per preset at runtime, so each hero can keep or drop forehead hair (bangs).
  const hairFaces = faces.filter((f) => f.group === "helper-hair");
  const hairSet = new Set();
  for (const f of hairFaces) for (const idx of f.indices) hairSet.add(idx);
  const hairSrc = [...hairSet].sort((a, b) => a - b);
  const hairRemap = new Map(hairSrc.map((idx, i) => [idx, i]));
  const hairPositions = hairSrc.flatMap((idx) => toModel(vertices[idx]));
  const hairIndices = [];
  for (const f of hairFaces) {
    if (!f.indices.every((idx) => hairRemap.has(idx))) continue;
    for (let i = 1; i < f.indices.length - 1; i++)
      hairIndices.push(
        hairRemap.get(f.indices[0]),
        hairRemap.get(f.indices[i]),
        hairRemap.get(f.indices[i + 1]),
      );
  }
  // The proxy ribbons are a handful of large flat triangles, so they render as
  // hard-edged cardboard panels (very visible at 3/4). Subdivide once (4x tris,
  // shared-edge midpoints) then Laplacian-smooth so the panels round into a
  // softer hair mass. The backing is lofted from the smoothed result too.
  const subdivideMesh = (pos, idx) => {
    const P = pos.slice();
    const mid = new Map();
    const ekey = (a, b) => (a < b ? a * 1e7 + b : b * 1e7 + a);
    const getMid = (a, b) => {
      const k = ekey(a, b);
      if (mid.has(k)) return mid.get(k);
      const i = P.length / 3;
      P.push(
        (pos[a * 3] + pos[b * 3]) / 2,
        (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2,
        (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2,
      );
      mid.set(k, i);
      return i;
    };
    const NI = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ab = getMid(a, b), bc = getMid(b, c), ca = getMid(c, a);
      NI.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    return { positions: P, indices: NI };
  };
  // Taubin smoothing: alternate a positive (smooth) and slightly larger negative
  // (inflate) pass so the surface rounds WITHOUT the volume loss that collapses
  // thin ribbons into slivers under plain Laplacian smoothing.
  const taubinSmooth = (pos, idx, passes, lambda, mu) => {
    const n = pos.length / 3;
    const nbr = Array.from({ length: n }, () => new Set());
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      nbr[a].add(b); nbr[a].add(c); nbr[b].add(a);
      nbr[b].add(c); nbr[c].add(a); nbr[c].add(b);
    }
    let p = pos.slice();
    const step = (w) => {
      const q = p.slice();
      for (let i = 0; i < n; i++) {
        const ns = [...nbr[i]];
        if (!ns.length) continue;
        let mx = 0, my = 0, mz = 0;
        for (const j of ns) { mx += p[j * 3]; my += p[j * 3 + 1]; mz += p[j * 3 + 2]; }
        q[i * 3] = p[i * 3] + (mx / ns.length - p[i * 3]) * w;
        q[i * 3 + 1] = p[i * 3 + 1] + (my / ns.length - p[i * 3 + 1]) * w;
        q[i * 3 + 2] = p[i * 3 + 2] + (mz / ns.length - p[i * 3 + 2]) * w;
      }
      p = q;
    };
    for (let it = 0; it < passes; it++) { step(lambda); step(mu); }
    return p;
  };
  const hairSub = subdivideMesh(hairPositions, hairIndices);
  const hairSmoothPos = taubinSmooth(hairSub.positions, hairSub.indices, 2, 0.5, -0.53);
  const hair = { positions: hairSmoothPos, indices: hairSub.indices };
  // Continuous dark backing shell behind the coarse hair ribbons. The proxy is a
  // handful of vertical ribbons separated by thin seams; from behind, those seams
  // reveal skin/background as bright vertical lines. We loft a smooth silhouette
  // surface just inside the ribbon envelope so the seams read as solid dark hair.
  // The front face sector is forced open (no backing over the face), so the hair
  // still frames the face and the runtime front-carve is never occluded.
  const buildHairBacking = (pos) => {
    const n = pos.length / 3;
    let cx = 0, cz = 0, minY = 1e9, maxY = -1e9;
    for (let i = 0; i < pos.length; i += 3) {
      cx += pos[i];
      cz += pos[i + 2];
      if (pos[i + 1] < minY) minY = pos[i + 1];
      if (pos[i + 1] > maxY) maxY = pos[i + 1];
    }
    cx /= n;
    cz /= n;
    const NB = 18;
    const NA = 36;
    const TAU = Math.PI * 2;
    const FRONT_OPEN = (55 * Math.PI) / 180; // half-angle of the open face sector
    const bandH = (maxY - minY) / NB;
    const rad = Array.from({ length: NB }, () => new Float64Array(NA).fill(-1));
    for (let i = 0; i < pos.length; i += 3) {
      const dx = pos[i] - cx;
      const dz = pos[i + 2] - cz;
      const r = Math.hypot(dx, dz);
      let theta = Math.atan2(dx, dz); // 0 == +z (face front)
      if (theta < 0) theta += TAU;
      const bin = Math.min(NA - 1, Math.floor((theta / TAU) * NA));
      const bf = (pos[i + 1] - minY) / bandH - 0.5;
      for (const bb of [Math.floor(bf), Math.floor(bf) + 1]) {
        if (bb < 0 || bb >= NB) continue;
        if (r > rad[bb][bin]) rad[bb][bin] = r;
      }
    }
    const blocked = (a) => {
      const th = ((a + 0.5) / NA) * TAU;
      const d = Math.min(th, TAU - th); // angular distance to front-center
      return d < FRONT_OPEN;
    };
    // Within each band, fill the back+side mantle: any non-front empty bin gets a
    // radius linearly interpolated from the nearest filled bins on either side.
    for (let b = 0; b < NB; b++) {
      const row = rad[b];
      const filled = [];
      for (let a = 0; a < NA; a++) if (!blocked(a) && row[a] > 0) filled.push(a);
      if (filled.length < 2) {
        for (let a = 0; a < NA; a++) if (blocked(a)) row[a] = -1;
        continue;
      }
      for (let a = 0; a < NA; a++) {
        if (blocked(a)) {
          row[a] = -1;
          continue;
        }
        if (row[a] > 0) continue;
        let lo = null;
        let hi = null;
        for (const f of filled) {
          if (f < a) lo = f;
          if (f > a && hi === null) hi = f;
        }
        if (lo !== null && hi !== null) {
          const t = (a - lo) / (hi - lo);
          row[a] = rad[b][lo] * (1 - t) + rad[b][hi] * t;
        } else {
          row[a] = rad[b][lo ?? hi];
        }
      }
    }
    const backPositions = [];
    const backIndices = [];
    const vid = Array.from({ length: NB }, () => new Int32Array(NA).fill(-1));
    for (let b = 0; b < NB; b++)
      for (let a = 0; a < NA; a++) {
        if (rad[b][a] <= 0) continue;
        const r = rad[b][a] * 0.92; // inset just inside the ribbon surface
        const th = ((a + 0.5) / NA) * TAU;
        const y = minY + (b + 0.5) * bandH;
        vid[b][a] = backPositions.length / 3;
        backPositions.push(cx + r * Math.sin(th), y, cz + r * Math.cos(th));
      }
    for (let b = 0; b < NB - 1; b++)
      for (let a = 0; a < NA; a++) {
        const a2 = (a + 1) % NA;
        const v00 = vid[b][a];
        const v01 = vid[b][a2];
        const v10 = vid[b + 1][a];
        const v11 = vid[b + 1][a2];
        if (v00 < 0 || v01 < 0 || v10 < 0 || v11 < 0) continue;
        backIndices.push(v00, v10, v11, v00, v11, v01);
      }
    return { positions: backPositions, indices: backIndices };
  };
  const hairBacking = buildHairBacking(hairSmoothPos);
  // Real MakeHuman eyeball mesh, transformed into head space (non-indexed so
  // each corner carries its own UV into brown_eye.png).
  const eyeObj = readEyeObj();
  const eyePos = [];
  const eyeUv = [];
  for (const f of eyeObj.faces) {
    for (let i = 1; i < f.length - 1; i++) {
      for (const corner of [f[0], f[i], f[i + 1]]) {
        const p = toModel(eyeObj.verts[corner[0]]);
        eyePos.push(p[0], p[1], p[2]);
        const uv = eyeObj.uvs[corner[1]];
        eyeUv.push(uv[0], uv[1]);
      }
    }
  }
  const eyeballs = { positions: eyePos, uvs: eyeUv };
  const model = {
    schema: "autofilm.parametric-head.makehuman.v1",
    source: {
      intent:
        "Universal parametric head editor. Hero identities are presets only; no preset owns topology or base geometry.",
      base: ".references/makehuman/makehuman/data/3dobjs/base.obj",
      targets: ".references/makehuman/makehuman/data/targets",
      license: "MakeHuman CC0",
      unit: "normalized MakeHuman head subset",
      neutral: "MakeHuman body head/neck subset; all morph weights zero",
      measurementRule:
        "Every fitted value must be checked against same-view reference ratios before it can be called matched.",
    },
    mesh: {
      sourceVertexCount: vertices.length,
      sourceHeadVertexCount: source.length,
      positions,
      indices,
      sourceVertexIndices: source,
    },
    landmarks,
    featureGroups,
    references,
    parameterGroups,
    parameters,
    morphs,
    hair,
    hairBacking,
    eyeballs,
    presets,
    measurementMetrics,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(model)}\n`);
  console.log(
    `wrote ${path.relative(root, outPath)} (${source.length} vertices, ${indices.length / 3} triangles)`,
  );
};

build();
