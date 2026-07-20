// Multi-ANGLE mathematical dissection: verify the model matches the hero at a
// GIVEN viewing angle, not just the front. Front+profile 2D matching does NOT
// constrain off-midline depth, so the model can be right head-on yet wrong at
// 3/4 ("rotate a little and it's all wrong"). This tool removes the yaw
// confound: it detects the reference photo's head yaw (via a 2D yaw indicator),
// sweeps the MODEL camera yaw until the model's yaw matches, then compares the
// same proportional ratios at that MATCHED yaw, so the residual is pure SHAPE
// error at that angle.
//
// Usage: node scripts/dissect-view.mjs <hero> <view>
//   view: front | leftThreeQuarter | rightThreeQuarter | leftProfile | rightProfile
//   OVR='{"param":val}' to sweep params live (no rebuild).
// Needs Vite :5173 + network (MediaPipe CDN).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
const view = process.argv[3] ?? "leftThreeQuarter";
const BASE = process.env.BASE ?? "http://localhost:5173";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ovr = process.env.OVR ? JSON.parse(process.env.OVR) : null;

const model = JSON.parse(
  fs.readFileSync(path.join(root, "packages/playground/public/models/head-model.json"), "utf8"),
);
const ref = model.references[hero];
const cell = ref.views[view];
if (!cell) {
  console.log(JSON.stringify({ hero, view, error: "no such view cell" }));
  process.exit(0);
}
const heroNum = hero.replace("hero", "");
const sheetRel = `.models/hero/${heroNum}/input/face.png`;
const rootUrl = root.replace(/\\/g, "/");
const cw = 0; // computed in-page from natural image size
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`${BASE}/head.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__faceEditor?.setValues);
await page.addStyleTag({
  content: `#panel,#strip,#hud{display:none!important}#stage{grid-template-columns:1fr!important}#workbench{grid-template-rows:1fr!important}`,
});
await page.setViewportSize({ width: 1000, height: 1000 });
await page.evaluate(async () => {
  const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
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

// reference photo cell -> landmarks
const photo = await page.evaluate(
  async ({ url, col, row, cols, rows }) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("load " + url));
      im.src = url;
    });
    const sw = Math.round(img.naturalWidth / cols);
    const sh = Math.round(img.naturalHeight / rows);
    const sx = Math.round(col * sw);
    const sy = Math.round(row * sh);
    const cvs = document.createElement("canvas");
    cvs.width = sw; cvs.height = sh;
    cvs.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const r = window.__fl.detect(cvs);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return { lm: f ? f.map((p) => [p.x, p.y, p.z]) : null, w: sw, h: sh };
  },
  { url: `/@fs/${rootUrl}/${sheetRel}`, col: cell.column, row: cell.row, cols: ref.grid.columns, rows: ref.grid.rows },
);

// yaw indicator from 2D landmarks: (nose.x - leftEdge.x)/(rightEdge.x - nose.x).
// =1 head-on; >1 turned so right side recedes; <1 the other way. Monotonic in yaw.
const yawInd = (det) => {
  if (!det.lm) return null;
  const L = det.lm, w = det.w;
  const nx = L[1][0] * w, lx = L[234][0] * w, rx = L[454][0] * w;
  const a = nx - lx, b = rx - nx;
  if (a <= 1 || b <= 1) return null;
  return a / b;
};
const photoYaw = yawInd(photo);

// sweep model camera yaw, detect, find the yaw whose yawInd matches the photo's
const detectModelAtYaw = async (deg) =>
  page.evaluate(
    async ({ hero, ovr, deg }) => {
      window.__faceEditor.setPreset(hero);
      if (ovr) window.__faceEditor.setValues(ovr);
      window.__faceEditor.setCameraYaw(deg);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const cvs = document.querySelector("#view");
      const r = window.__fl.detect(cvs);
      const f = r.faceLandmarks && r.faceLandmarks[0];
      return { lm: f ? f.map((p) => [p.x, p.y, p.z]) : null, w: cvs.width, h: cvs.height };
    },
    { hero, ovr, deg },
  );

let matched = null, matchedYaw = null, sweep = [];
if (photoYaw != null) {
  // coarse sweep both signs, then refine around the best
  let best = null;
  for (let deg = -55; deg <= 55; deg += 5) {
    const det = await detectModelAtYaw(deg);
    const y = yawInd(det);
    sweep.push({ deg, yawInd: y == null ? null : +y.toFixed(3) });
    if (y == null) continue;
    const err = Math.abs(y - photoYaw);
    if (!best || err < best.err) best = { deg, err, det, y };
  }
  if (best) {
    for (let deg = best.deg - 4; deg <= best.deg + 4; deg += 1) {
      const det = await detectModelAtYaw(deg);
      const y = yawInd(det);
      if (y == null) continue;
      const err = Math.abs(y - photoYaw);
      if (err < best.err) best = { deg, err, det, y };
    }
    matched = best.det; matchedYaw = best.deg;
    // save the matched-yaw model render for visual validation of the yaw match
    await page.evaluate(async (deg) => {
      window.__faceEditor.setCameraYaw(deg);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, matchedYaw);
    const outDir = path.join(root, ".shots", "_measure");
    const shot = await page.locator("#view").screenshot({ type: "png" });
    fs.writeFileSync(path.join(outDir, `dissect-${hero}-${view}.png`), shot);
  }
}

await page.close();
await browser.close();

// proportional ratios meaningful within a fixed yaw (both sides measured the
// same way, so foreshortening cancels). Adds 3/4-sensitive depth proxies.
const ratios = (det) => {
  if (!det.lm) return null;
  const L = det.lm;
  const P = (i) => [L[i][0] * det.w, L[i][1] * det.h];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const faceWidth = d(P(234), P(454));
  const faceHeight = d(P(10), P(152));
  const eyeWidthL = d(P(33), P(133));
  const eyeWidthR = d(P(263), P(362));
  const irisSpacing = d(P(468), P(473));
  const noseWidth = d(P(129), P(358));
  const mouthWidth = d(P(61), P(291));
  const eyeY = (P(33)[1] + P(263)[1]) / 2;
  const noseTipY = P(1)[1];
  const mouthY = (P(61)[1] + P(291)[1]) / 2;
  const chinY = P(152)[1];
  // depth/turn-sensitive: nose-tip lateral offset from the eye midline, the
  // cheek (zygo) prominence on each side, jaw-angle position.
  const eyeMidX = (P(33)[0] + P(263)[0]) / 2;
  const noseProjX = (P(1)[0] - eyeMidX) / faceWidth; // nose tip sideways vs eyes
  const chinProjX = (P(152)[0] - eyeMidX) / faceWidth;
  const browY = (P(105)[1] + P(334)[1]) / 2;
  return {
    facialIndex: faceHeight / faceWidth,
    irisSpacingToFace: irisSpacing / faceWidth,
    eyeWidthAsym: eyeWidthL / eyeWidthR, // L/R eye foreshorten ratio = yaw cross-check
    noseWidthToFace: noseWidth / faceWidth,
    mouthWidthToFace: mouthWidth / faceWidth,
    eyeToNose: (noseTipY - eyeY) / (chinY - eyeY),
    eyeToMouth: (mouthY - eyeY) / (chinY - eyeY),
    browToEye: (eyeY - browY) / faceHeight,
    noseProjX,
    chinProjX,
  };
};

const rp = ratios(photo);
const rm = ratios(matched ?? { lm: null });
// noseProjX / chinProjX are near-zero lateral offsets (already normalized by
// faceWidth): compare as ABSOLUTE difference, not relErr, and keep them OUT of
// the relRms (their tiny denominators blow up relErr into meaningless values).
const LATERAL = new Set(["noseProjX", "chinProjX"]);
const rows = [];
let rms = 0, n = 0;
if (rp && rm) {
  for (const k of Object.keys(rp)) {
    if (LATERAL.has(k)) {
      const absErr = rm[k] - rp[k];
      rows.push({ metric: k, photo: +rp[k].toFixed(4), model: +rm[k].toFixed(4), absErr: +absErr.toFixed(4) });
    } else {
      const relErr = (rm[k] - rp[k]) / (Math.abs(rp[k]) > 1e-6 ? rp[k] : 1);
      rows.push({ metric: k, photo: +rp[k].toFixed(4), model: +rm[k].toFixed(4), relErr: +relErr.toFixed(4) });
      rms += relErr * relErr; n++;
    }
  }
  rows.sort((a, b) => Math.abs(b.relErr ?? b.absErr) - Math.abs(a.relErr ?? a.absErr));
}
console.log(
  JSON.stringify(
    {
      hero, view,
      photoDetected: !!photo.lm,
      modelDetected: !!(matched && matched.lm),
      photoYawInd: photoYaw == null ? null : +photoYaw.toFixed(3),
      matchedCameraYawDeg: matchedYaw,
      relRms: n ? +Math.sqrt(rms / n).toFixed(4) : null,
      comparison: rows,
    },
    null, 2,
  ),
);
