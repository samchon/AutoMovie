// Fit a hero's PROFILE depth axes by minimizing the facial-profile silhouette
// RMS (model midline vs side photo), averaged over the left AND right side
// photos (the model midline is symmetric, so both photos test the same curve
// and the average cancels per-photo extraction noise). Pure geometry + image —
// no browser. Reuses the verified extraction from measure-profile.mjs.
//
// Usage: node scripts/fit-profile.mjs <hero>   (default hero2)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero2";

const model = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/playground/public/models/head-model.json"),
    "utf8",
  ),
);
const ref = model.references[hero];
const heroNum = hero.replace("hero", "");
const sheet = PNG.sync.read(
  fs.readFileSync(path.join(root, `.models/hero/${heroNum}/input/face.png`)),
);
const px = (img, x, y) => {
  const i = (img.width * y + x) << 2;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};

// ---------- PHOTO profile curve per side (verified logic) ----------
const extractPhoto = (side) => {
  const view = `${side}Profile`;
  const cell = ref.views[view];
  if (!cell) return null;
  const cw = sheet.width / ref.grid.columns;
  const ch = sheet.height / ref.grid.rows;
  const cx0 = Math.round(cell.column * cw),
    cy0 = Math.round(cell.row * ch);
  const cwi = Math.round(cw),
    chi = Math.round(ch);
  const crop = new PNG({ width: cwi, height: chi });
  for (let y = 0; y < chi; y++)
    for (let x = 0; x < cwi; x++) {
      const s = (sheet.width * (cy0 + y) + (cx0 + x)) << 2;
      const d = (cwi * y + x) << 2;
      crop.data[d] = sheet.data[s];
      crop.data[d + 1] = sheet.data[s + 1];
      crop.data[d + 2] = sheet.data[s + 2];
      crop.data[d + 3] = 255;
    }
  const isBg = (x, y) => {
    const [r, g, b] = px(crop, x, y);
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    return mn > 168 && mx - mn < 22;
  };
  const RUN = 4;
  const fgRunFrom = (y, fromLeft) => {
    if (fromLeft) {
      for (let x = 0; x < cwi - RUN; x++) {
        let ok = true;
        for (let k = 0; k < RUN; k++)
          if (isBg(x + k, y)) {
            ok = false;
            break;
          }
        if (ok) return x;
      }
    } else {
      for (let x = cwi - 1; x >= RUN; x--) {
        let ok = true;
        for (let k = 0; k < RUN; k++)
          if (isBg(x - k, y)) {
            ok = false;
            break;
          }
        if (ok) return x;
      }
    }
    return -1;
  };
  const left = new Array(chi).fill(-1),
    right = new Array(chi).fill(-1),
    fgFrac = new Array(chi).fill(0);
  for (let y = 0; y < chi; y++) {
    left[y] = fgRunFrom(y, true);
    right[y] = fgRunFrom(y, false);
    let n = 0;
    for (let x = 0; x < cwi; x++) if (!isBg(x, y)) n++;
    fgFrac[y] = n / cwi;
  }
  let bandStart = 0,
    bandEnd = chi - 1,
    runS = -1,
    bestS = 0,
    bestE = 0;
  for (let y = 0; y <= chi; y++) {
    const on = y < chi && fgFrac[y] > 0.08;
    if (on && runS < 0) runS = y;
    if (!on && runS >= 0) {
      if (y - runS > bestE - bestS) {
        bestS = runS;
        bestE = y;
      }
      runS = -1;
    }
  }
  bandStart = bestS;
  bandEnd = bestE - 1;
  const facingLeft = side === "left";
  const frontX = (y) => (facingLeft ? left[y] : right[y]);
  const fwd = (y) => (facingLeft ? -frontX(y) : frontX(y));
  const upTop = bandStart + Math.round((bandEnd - bandStart) * 0.22);
  const upBot = bandStart + Math.round((bandEnd - bandStart) * 0.6);
  let noseRow = upTop;
  for (let y = upTop; y <= upBot; y++)
    if (frontX(y) >= 0 && fwd(y) > fwd(noseRow)) noseRow = y;
  const chinTop = noseRow + Math.round((bandEnd - bandStart) * 0.14);
  const chinBot = noseRow + Math.round((bandEnd - bandStart) * 0.42);
  let chinRow = Math.min(chinTop, bandEnd);
  for (let y = chinTop; y <= Math.min(chinBot, bandEnd); y++)
    if (frontX(y) >= 0 && fwd(y) > fwd(chinRow)) chinRow = y;
  const spanPhoto = chinRow - noseRow;
  return (v) => {
    const y = Math.round(noseRow - v * spanPhoto);
    if (y < 0 || y >= chi || frontX(y) < 0) return null;
    return (fwd(y) - fwd(noseRow)) / spanPhoto;
  };
};

// ---------- MODEL profile curve from geometry given OVR ----------
const base = model.mesh.positions;
// PURE DEPTH axes only. noseLength is excluded on purpose: it changes the
// nose->chin vertical SPAN, which is the normalization anchor, so letting the
// optimizer move it games the normalized RMS (it drove cute hero1 to a long
// nose) — the same degenerate trap as the front overfit. Depth axes move z
// without shifting the anchor.
const FIT = [
  "tipProjection",
  "bridgeProjection",
  "bridgeHeight",
  "dorsumCurve",
  "foreheadSlope",
];
const modelSampler = (ovr) => {
  const pos = Float32Array.from(base);
  const values = { ...(model.presets[hero]?.values ?? {}) };
  Object.assign(values, ovr);
  for (const [id, val] of Object.entries(values)) {
    const m = model.morphs[id];
    const rows = val > 0 ? m?.plus : m?.minus;
    const w = Math.abs(val);
    for (const r of rows ?? []) {
      pos[r[0] * 3] += r[1] * w;
      pos[r[0] * 3 + 1] += r[2] * w;
      pos[r[0] * 3 + 2] += r[3] * w;
    }
  }
  const BINS = 72,
    YLO = -0.7,
    YHI = 0.75;
  const maxZ = new Array(BINS).fill(-Infinity);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i],
      y = pos[i + 1],
      z = pos[i + 2];
    if (Math.abs(x) > 0.05 || z <= 0 || y < YLO || y > YHI) continue;
    const b = Math.floor(((y - YLO) / (YHI - YLO)) * (BINS - 1));
    if (z > maxZ[b]) maxZ[b] = z;
  }
  const mY = (b) => YLO + (b / (BINS - 1)) * (YHI - YLO);
  let noseB = -1;
  for (let b = 0; b < BINS; b++)
    if (maxZ[b] > -1e8 && (noseB < 0 || maxZ[b] > maxZ[noseB])) noseB = b;
  let chinB = -1;
  for (let b = 0; b < BINS; b++) {
    if (maxZ[b] <= -1e8 || mY(b) > mY(noseB) - 0.12 || mY(b) < mY(noseB) - 0.42)
      continue;
    if (chinB < 0 || maxZ[b] > maxZ[chinB]) chinB = b;
  }
  const span = mY(noseB) - mY(chinB);
  return (v) => {
    const yv = mY(noseB) + v * span;
    const b = Math.round(((yv - YLO) / (YHI - YLO)) * (BINS - 1));
    if (b < 0 || b >= BINS || maxZ[b] <= -1e8) return null;
    return (maxZ[b] - maxZ[noseB]) / span;
  };
};

const photoL = extractPhoto("left");
const photoR = extractPhoto("right");
const photos = [photoL, photoR].filter(Boolean);
const rmsOf = (ovr) => {
  const m = modelSampler(ovr);
  let s = 0,
    n = 0;
  for (const ph of photos)
    for (let v = -1.0; v <= 0.2 + 1e-9; v += 0.05) {
      const a = m(v),
        b = ph(v);
      if (a == null || b == null) continue;
      s += (a - b) * (a - b);
      n++;
    }
  return Math.sqrt(s / Math.max(1, n));
};

const REG = 0.015;
const BOUND = 1.2;
const penalty = (o) => {
  let s = 0;
  for (const k of FIT) s += (o[k] ?? 0) * (o[k] ?? 0);
  return REG * Math.sqrt(s / FIT.length);
};
const seed = {};
for (const k of FIT) seed[k] = model.presets[hero]?.values?.[k] ?? 0;
let cur = { ...seed };
const startRms = rmsOf(cur);
const grid = [];
for (let v = -BOUND; v <= BOUND + 1e-9; v += 0.1) grid.push(+v.toFixed(2));
for (let round = 0; round < 3; round++) {
  for (const p of FIT) {
    let bestV = cur[p],
      bestObj = rmsOf(cur) + penalty(cur);
    for (const v of grid) {
      const trial = { ...cur, [p]: v };
      const o = rmsOf(trial) + penalty(trial);
      if (o < bestObj - 1e-4) {
        bestObj = o;
        bestV = v;
      }
    }
    cur[p] = bestV;
  }
}
const finalRms = rmsOf(cur);
const rounded = {};
for (const k of FIT) rounded[k] = +cur[k].toFixed(2);
console.log(
  JSON.stringify(
    {
      hero,
      sides: photos.length,
      startProfileRms: +startRms.toFixed(4),
      finalProfileRms: +finalRms.toFixed(4),
      fittedDepth: rounded,
    },
    null,
    2,
  ),
);
