// Quantify the facial PROFILE silhouette from a hero side photo and from the
// model's profile render, normalize both, and report numeric shape error.
//
// The side photo's facial profile (forehead/nose/lips/chin/jaw) is the most
// diagnostic, hair-free, fully-extractable curve we have — no landmark library
// needed. We segment skin/hair from the light studio background, take the
// face-front edge per row, and compare it (normalized by the nose-tip..chin
// span) against the same curve pulled from the clay render.
//
// Usage: node scripts/measure-profile.mjs <hero> <side>   e.g. hero3 left
// Step 1 mode (--debug): only extract the PHOTO curve and draw it, so the
// segmentation can be eyeballed before any number is trusted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
const side = process.argv[3] ?? "left"; // left|right -> leftProfile|rightProfile
const outDir = path.join(root, ".shots", "_measure");
fs.mkdirSync(outDir, { recursive: true });

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
const dist = (a, b) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

// --- crop the nominal grid cell for the chosen profile view ---
const view = `${side}Profile`;
const cell = ref.views[view];
if (!cell) throw new Error(`no ${view} cell for ${hero}`);
const cw = sheet.width / ref.grid.columns;
const ch = sheet.height / ref.grid.rows;
const cx0 = Math.round(cell.column * cw);
const cy0 = Math.round(cell.row * ch);
const cwi = Math.round(cw);
const chi = Math.round(ch);
const crop = new PNG({ width: cwi, height: chi });
for (let y = 0; y < chi; y++) {
  for (let x = 0; x < cwi; x++) {
    const s = (sheet.width * (cy0 + y) + (cx0 + x)) << 2;
    const d = (cwi * y + x) << 2;
    crop.data[d] = sheet.data[s];
    crop.data[d + 1] = sheet.data[s + 1];
    crop.data[d + 2] = sheet.data[s + 2];
    crop.data[d + 3] = 255;
  }
}

// --- foreground test (chromatic, gradient-proof) ---
// The studio backdrop is bright AND neutral (R~=G~=B) even where it darkens
// toward the edges; the white shirt too. Skin is warm (R>B) and hair is dark.
// So foreground = NOT (bright-and-neutral).
const isBg = (x, y) => {
  const [r, g, b] = px(crop, x, y);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return mn > 168 && mx - mn < 22;
};
// require a run of consecutive fg pixels so stray speckle/JPEG noise is ignored
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

// --- per-row foreground extent, then the main face band ---
const left = new Array(chi).fill(-1);
const right = new Array(chi).fill(-1);
const fgFrac = new Array(chi).fill(0);
for (let y = 0; y < chi; y++) {
  left[y] = fgRunFrom(y, true);
  right[y] = fgRunFrom(y, false);
  let n = 0;
  for (let x = 0; x < cwi; x++) if (!isBg(x, y)) n++;
  fgFrac[y] = n / cwi;
}
// main face band = the longest run of rows with a substantial foreground width
let bandStart = 0,
  bandEnd = chi - 1;
{
  let runS = -1,
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
}

// --- draw both edges + band for visual verification ---
const dot = (img, x, y, c) => {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (img.width * y + x) << 2;
  img.data[i] = c[0];
  img.data[i + 1] = c[1];
  img.data[i + 2] = c[2];
};
for (let y = bandStart; y <= bandEnd; y++) {
  if (left[y] >= 0)
    for (let d = -1; d <= 1; d++) dot(crop, left[y] + d, y, [255, 40, 40]);
  if (right[y] >= 0)
    for (let d = -1; d <= 1; d++) dot(crop, right[y] + d, y, [60, 120, 255]);
}
const outPath = path.join(outDir, `profile-${hero}-${side}-debug.png`);
fs.writeFileSync(outPath, PNG.sync.write(crop));

// ===== PHOTO profile curve (face-front edge) =====
// leftProfile faces image-left -> front edge is the left edge (smaller x is
// more forward); rightProfile faces image-right -> the right edge.
const facingLeft = side === "left";
const frontX = (y) => (facingLeft ? left[y] : right[y]);
// forwardness: bigger = more protruding. left-facing: forward = smaller x.
const fwdPhoto = (y) => (facingLeft ? -frontX(y) : frontX(y));
// nose tip = most-forward row in the upper-mid band (skip hairline at top)
const upTop = bandStart + Math.round((bandEnd - bandStart) * 0.22);
const upBot = bandStart + Math.round((bandEnd - bandStart) * 0.6);
let noseRow = upTop;
for (let y = upTop; y <= upBot; y++)
  if (frontX(y) >= 0 && fwdPhoto(y) > fwdPhoto(noseRow)) noseRow = y;
// chin = most-forward row in a window below the nose (after the lips), before
// hair drapes over the front of the neck
const chinTop = noseRow + Math.round((bandEnd - bandStart) * 0.14);
const chinBot = noseRow + Math.round((bandEnd - bandStart) * 0.42);
let chinRow = Math.min(chinTop, bandEnd);
for (let y = chinTop; y <= Math.min(chinBot, bandEnd); y++)
  if (frontX(y) >= 0 && fwdPhoto(y) > fwdPhoto(chinRow)) chinRow = y;
const spanPhoto = chinRow - noseRow; // px (image y, downward)

// ===== MODEL profile curve (exact, from mesh geometry) =====
const applyPreset = (name) => {
  const pos = Float32Array.from(model.mesh.positions);
  // OVR={"tipProjection":-0.5,...} lets the fit loop sweep parameter values
  // against the live model.mesh + morphs WITHOUT regenerating head-model.json.
  const values = { ...(model.presets[name]?.values ?? {}) };
  if (process.env.OVR) Object.assign(values, JSON.parse(process.env.OVR));
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
  return pos;
};
const pos = applyPreset(hero);
const BINS = 72;
const YLO = -0.7,
  YHI = 0.75; // face band in model units (exclude neck/shoulders)
const maxZ = new Array(BINS).fill(-Infinity);
for (let i = 0; i < pos.length; i += 3) {
  const x = pos[i],
    y = pos[i + 1],
    z = pos[i + 2];
  // front hemisphere only (z>0): the facial midline. Without this, y-bins that
  // lack a front-surface vertex pick up the back of the skull (z<0) and produce
  // spurious deep notches.
  if (Math.abs(x) > 0.05 || z <= 0 || y < YLO || y > YHI) continue;
  const b = Math.floor(((y - YLO) / (YHI - YLO)) * (BINS - 1));
  if (z > maxZ[b]) maxZ[b] = z;
}
const mY = (b) => YLO + (b / (BINS - 1)) * (YHI - YLO);
let noseB = -1;
for (let b = 0; b < BINS; b++)
  if (maxZ[b] > -1e8 && (noseB < 0 || maxZ[b] > maxZ[noseB])) noseB = b;
// chin = frontmost midline point well below the nose (lips sit between)
let chinB = -1;
for (let b = 0; b < BINS; b++) {
  if (maxZ[b] <= -1e8) continue;
  if (mY(b) > mY(noseB) - 0.12) continue; // below the nose by a margin
  if (mY(b) < mY(noseB) - 0.42) continue;
  if (chinB < 0 || maxZ[b] > maxZ[chinB]) chinB = b;
}
const spanModel = mY(noseB) - mY(chinB); // model units (y up); >0

// ===== normalize both into a nose-anchored frame (chin at v=-1) =====
// v: 0 at nose tip, -1 at chin. u: 0 at nose tip, negative = less forward.
const photoSample = (v) => {
  // v in [-1.1, 0.25]; map to image row
  const y = Math.round(noseRow - v * spanPhoto);
  if (y < 0 || y >= chi || frontX(y) < 0) return null;
  return (fwdPhoto(y) - fwdPhoto(noseRow)) / spanPhoto;
};
const modelSample = (v) => {
  const yv = mY(noseB) + v * spanModel; // v=-1 -> chin
  const b = Math.round(((yv - YLO) / (YHI - YLO)) * (BINS - 1));
  if (b < 0 || b >= BINS || maxZ[b] <= -1e8) return null;
  return (maxZ[b] - maxZ[noseB]) / spanModel;
};
const samples = [];
for (let v = -1.0; v <= 0.2 + 1e-9; v += 0.05) {
  const a = modelSample(v);
  const b = photoSample(v);
  if (a == null || b == null) continue;
  samples.push({ v: +v.toFixed(2), model: a, photo: b, err: a - b });
}
const rms = Math.sqrt(
  samples.reduce((s, r) => s + r.err * r.err, 0) / Math.max(1, samples.length),
);
let worst = samples[0] ?? { v: 0, err: 0 };
for (const r of samples) if (Math.abs(r.err) > Math.abs(worst.err)) worst = r;

// ===== overlay plot (model green, photo red), normalized frame =====
const PW = 260,
  PH = 380;
const plot = new PNG({ width: PW, height: PH });
for (let i = 0; i < plot.data.length; i += 4) {
  plot.data[i] = 16;
  plot.data[i + 1] = 18;
  plot.data[i + 2] = 22;
  plot.data[i + 3] = 255;
}
const uLo = -1.0,
  uHi = 0.15; // forwardness range (0 = nose)
const vLo = -1.15,
  vHi = 0.25;
const sx = (u) => Math.round(((u - uLo) / (uHi - uLo)) * (PW - 20)) + 10;
const sy = (v) => Math.round(((vHi - v) / (vHi - vLo)) * (PH - 20)) + 10;
const plotDot = (x, y, c) => {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx,
        yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= PW || yy >= PH) continue;
      const i = (PW * yy + xx) << 2;
      plot.data[i] = c[0];
      plot.data[i + 1] = c[1];
      plot.data[i + 2] = c[2];
    }
};
// nose (v=0) and chin (v=-1) gridlines
for (let x = 10; x < PW - 10; x++) {
  plotDot(x, sy(0), [70, 70, 80]);
  plotDot(x, sy(-1), [70, 70, 80]);
}
for (let v = vLo; v <= vHi; v += 0.02) {
  const m = modelSample(v);
  if (m != null) plotDot(sx(m), sy(v), [80, 220, 120]);
  const p = photoSample(v);
  if (p != null) plotDot(sx(p), sy(v), [240, 70, 70]);
}
const plotPath = path.join(outDir, `profile-${hero}-${side}-compare.png`);
fs.writeFileSync(plotPath, PNG.sync.write(plot));

console.log(
  JSON.stringify(
    {
      hero,
      view,
      band: [bandStart, bandEnd],
      photoAnchors: { noseRow, chinRow, spanPhoto },
      modelAnchors: {
        noseY: +mY(noseB).toFixed(3),
        noseZ: +maxZ[noseB].toFixed(3),
        chinY: +mY(chinB).toFixed(3),
        chinZ: +maxZ[chinB].toFixed(3),
        spanModel: +spanModel.toFixed(3),
      },
      rms: +rms.toFixed(4),
      worst,
      samples,
      debug: path.relative(root, outPath),
      compare: path.relative(root, plotPath),
    },
    null,
    2,
  ),
);
