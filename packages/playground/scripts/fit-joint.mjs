// JOINT fit of the coupled vertical/length axes (faceLength, chinHeight,
// noseBaseHeight, mouthHeightPosition) against ONE objective combining the
// front reliable-ratio relRMS, the profile-silhouette RMS, and the hair-free
// lower-jaw RMS. These axes share the lip/nose-base/chin midline, so fitting
// them per-view seesaws (a front gain costs a profile loss); minimizing the sum
// finds the balance. Pure-depth and width axes (already fit separately and
// orthogonal) are held at the preset.
//
// One browser session: photo targets detected once, then coordinate descent
// drives the editor live (#view) for front+jaw while node recomputes the
// profile from the same OVR. Needs Vite :5173 + network.
//
// Usage: node scripts/fit-joint.mjs <hero>   (default hero2)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero2";
const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:5173";
const rootUrl = root.replace(/\\/g, "/");

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

// ---------- PHOTO profile curve per side (from fit-profile) ----------
const extractPhotoProfile = (side) => {
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
    return (
      Math.min(r, g, b) > 168 && Math.max(r, g, b) - Math.min(r, g, b) < 22
    );
  };
  const RUN = 4;
  const run = (y, fromLeft) => {
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
  const left = [],
    right = [],
    fg = [];
  for (let y = 0; y < chi; y++) {
    left[y] = run(y, true);
    right[y] = run(y, false);
    let n = 0;
    for (let x = 0; x < cwi; x++) if (!isBg(x, y)) n++;
    fg[y] = n / cwi;
  }
  let bS = 0,
    bE = chi - 1,
    rs = -1,
    bs = 0,
    be = 0;
  for (let y = 0; y <= chi; y++) {
    const on = y < chi && fg[y] > 0.08;
    if (on && rs < 0) rs = y;
    if (!on && rs >= 0) {
      if (y - rs > be - bs) {
        bs = rs;
        be = y;
      }
      rs = -1;
    }
  }
  bS = bs;
  bE = be - 1;
  const facingLeft = side === "left";
  const fx = (y) => (facingLeft ? left[y] : right[y]);
  const fwd = (y) => (facingLeft ? -fx(y) : fx(y));
  const uT = bS + Math.round((bE - bS) * 0.22),
    uB = bS + Math.round((bE - bS) * 0.6);
  let noseRow = uT;
  for (let y = uT; y <= uB; y++)
    if (fx(y) >= 0 && fwd(y) > fwd(noseRow)) noseRow = y;
  const cT = noseRow + Math.round((bE - bS) * 0.14),
    cB = noseRow + Math.round((bE - bS) * 0.42);
  let chinRow = Math.min(cT, bE);
  for (let y = cT; y <= Math.min(cB, bE); y++)
    if (fx(y) >= 0 && fwd(y) > fwd(chinRow)) chinRow = y;
  const span = chinRow - noseRow;
  return (v) => {
    const y = Math.round(noseRow - v * span);
    if (y < 0 || y >= chi || fx(y) < 0) return null;
    return (fwd(y) - fwd(noseRow)) / span;
  };
};
const photoProfiles = [
  extractPhotoProfile("left"),
  extractPhotoProfile("right"),
].filter(Boolean);

// ---------- MODEL profile RMS from geometry (node) ----------
const base = model.mesh.positions;
const profileRms = (ovr) => {
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
  const mz = new Array(BINS).fill(-Infinity);
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i],
      y = pos[i + 1],
      z = pos[i + 2];
    if (Math.abs(x) > 0.05 || z <= 0 || y < YLO || y > YHI) continue;
    const b = Math.floor(((y - YLO) / (YHI - YLO)) * (BINS - 1));
    if (z > mz[b]) mz[b] = z;
  }
  const mY = (b) => YLO + (b / (BINS - 1)) * (YHI - YLO);
  let nB = -1;
  for (let b = 0; b < BINS; b++)
    if (mz[b] > -1e8 && (nB < 0 || mz[b] > mz[nB])) nB = b;
  let cB = -1;
  for (let b = 0; b < BINS; b++) {
    if (mz[b] <= -1e8 || mY(b) > mY(nB) - 0.12 || mY(b) < mY(nB) - 0.42)
      continue;
    if (cB < 0 || mz[b] > mz[cB]) cB = b;
  }
  const span = mY(nB) - mY(cB);
  const sample = (v) => {
    const yv = mY(nB) + v * span;
    const b = Math.round(((yv - YLO) / (YHI - YLO)) * (BINS - 1));
    if (b < 0 || b >= BINS || mz[b] <= -1e8) return null;
    return (mz[b] - mz[nB]) / span;
  };
  let s = 0,
    n = 0;
  for (const ph of photoProfiles)
    for (let v = -1.0; v <= 0.2 + 1e-9; v += 0.05) {
      const a = sample(v),
        b = ph(v);
      if (a == null || b == null) continue;
      s += (a - b) ** 2;
      n++;
    }
  return Math.sqrt(s / Math.max(1, n));
};

// ---------- front + jaw from MediaPipe landmarks (node helpers) ----------
const JAWSUB = [
  172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397,
];
const frontRatios = (lm, w, h) => {
  const P = (i) => [lm[i][0] * w, lm[i][1] * h];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const fw = d(P(234), P(454));
  // WIDTHS only. eyeToNose/eyeToMouth depend on the clay eye line (iris Y),
  // which is unreliable on the crude clay eyes. Chasing them drove an
  // unnatural high mouth. The vertical lip/nose-base position is constrained
  // instead by the reliable PROFILE midline term of the joint objective.
  return {
    noseWidthToFace: d(P(129), P(358)) / fw,
    mouthWidthToFace: d(P(61), P(291)) / fw,
  };
};
const jawArc = (lm, w, h) => {
  const P = (i) => [lm[i][0] * w, lm[i][1] * h];
  const chin = P(152);
  const biz = Math.hypot(P(234)[0] - P(454)[0], P(234)[1] - P(454)[1]);
  return JAWSUB.map((i) => [
    (P(i)[0] - chin[0]) / biz,
    (P(i)[1] - chin[1]) / biz,
  ]);
};
const relRms = (m, t) => {
  let s = 0,
    n = 0;
  for (const k of Object.keys(t)) {
    const e = (m[k] - t[k]) / t[k];
    s += e * e;
    n++;
  }
  return Math.sqrt(s / n);
};
const arcRms = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++)
    s += (a[i][0] - b[i][0]) ** 2 + (a[i][1] - b[i][1]) ** 2;
  return Math.sqrt(s / a.length);
};

// ---------- browser ----------
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`${BASE}/head.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__faceEditor?.setValues);
await page.addStyleTag({
  content: `#panel,#strip,#hud{display:none!important}#stage{grid-template-columns:1fr!important}#workbench{grid-template-rows:1fr!important}`,
});
await page.setViewportSize({ width: 1000, height: 1000 });
await page.evaluate(async () => {
  const vision =
    await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
  const { FaceLandmarker, FilesetResolver } = vision;
  const fileset = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );
  window.__fl = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    },
    runningMode: "IMAGE",
    numFaces: 1,
  });
});
const cw = sheet.width / ref.grid.columns,
  ch = sheet.height / ref.grid.rows;
const cell = ref.views.front;
const photoDet = await page.evaluate(
  async ({ url, sx, sy, sw, sh }) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const r = window.__fl.detect(c);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return f ? { lm: f.map((p) => [p.x, p.y]), w: sw, h: sh } : null;
  },
  {
    url: `/@fs/${rootUrl}/.models/hero/${heroNum}/input/face.png`,
    sx: Math.round(cell.column * cw),
    sy: Math.round(cell.row * ch),
    sw: Math.round(cw),
    sh: Math.round(ch),
  },
);
const frontTarget = frontRatios(photoDet.lm, photoDet.w, photoDet.h);
const jawTarget = jawArc(photoDet.lm, photoDet.w, photoDet.h);
await page.evaluate((h) => window.__faceEditor.setPreset(h), hero);

const browserEval = async (ovr) => {
  const det = await page.evaluate(async (vals) => {
    window.__faceEditor.setValues(vals);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const c = document.querySelector("#view");
    const r = window.__fl.detect(c);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return f ? { lm: f.map((p) => [p.x, p.y]), w: c.width, h: c.height } : null;
  }, ovr);
  if (!det) return { front: 9, jaw: 9 };
  return {
    front: relRms(frontRatios(det.lm, det.w, det.h), frontTarget),
    jaw: arcRms(jawArc(det.lm, det.w, det.h), jawTarget),
  };
};

// ---------- joint coordinate descent over coupled axes ----------
const FIT = [
  "faceLength",
  "chinHeight",
  "noseBaseHeight",
  "mouthHeightPosition",
];
const WF = 1,
  WP = 1.5,
  WJ = 1,
  REG = 0.02,
  BOUND = 0.9;
const penalty = (o) => {
  let s = 0;
  for (const k of FIT) s += (o[k] ?? 0) ** 2;
  return REG * Math.sqrt(s / FIT.length);
};
const obj = async (ovr) => {
  const b = await browserEval(ovr);
  const p = profileRms(ovr);
  return {
    total: WF * b.front + WP * p + WJ * b.jaw + penalty(ovr),
    front: b.front,
    profile: p,
    jaw: b.jaw,
  };
};
const seed = {};
for (const k of FIT) seed[k] = model.presets[hero]?.values?.[k] ?? 0;
let cur = { ...seed };
const start = await obj(cur);
const grid = [];
for (let v = -BOUND; v <= BOUND + 1e-9; v += 0.1) grid.push(+v.toFixed(2));
for (let round = 0; round < 2; round++) {
  for (const p of FIT) {
    let bestV = cur[p],
      bestO = (await obj(cur)).total;
    for (const v of grid) {
      const t = { ...cur, [p]: v };
      const o = (await obj(t)).total;
      if (o < bestO - 1e-4) {
        bestO = o;
        bestV = v;
      }
    }
    cur[p] = bestV;
  }
  process.stderr.write(`round ${round} done\n`);
}
const final = await obj(cur);
await page.close();
await browser.close();
const rounded = {};
for (const k of FIT) rounded[k] = +cur[k].toFixed(2);
console.log(
  JSON.stringify(
    {
      hero,
      start: {
        front: +start.front.toFixed(4),
        profile: +start.profile.toFixed(4),
        jaw: +start.jaw.toFixed(4),
      },
      final: {
        front: +final.front.toFixed(4),
        profile: +final.profile.toFixed(4),
        jaw: +final.jaw.toFixed(4),
      },
      fitted: rounded,
    },
    null,
    2,
  ),
);
