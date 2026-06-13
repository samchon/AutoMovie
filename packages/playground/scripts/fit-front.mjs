// Fit a hero's FRONT parameter values by minimizing the relative RMS error of
// canonical MediaPipe ratios (model clay vs hero photo). One browser session:
// the photo target is detected once, then greedy coordinate descent drives the
// editor live (setValues -> #view canvas detect) over the front-relevant axes.
// Depth axes (tipProjection, bridge*, lipProjection, foreheadSlope) are NOT
// touched, so the separately-fitted profile is preserved.
//
// Needs Vite on :5173 and network. Usage: node scripts/fit-front.mjs <hero>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
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
const sheetRel = `.models/hero/${heroNum}/input/face.png`;
const sheetPx = PNG.sync.read(fs.readFileSync(path.join(root, sheetRel)));
const cw = sheetPx.width / ref.grid.columns;
const ch = sheetPx.height / ref.grid.rows;
const cell = ref.views.front;

// Front axes that each clearly OWN one of the measured ratios. No depth axes
// (noseLength/bridge*/tip projection live in the profile fit), and no
// lower-face axes the front ratios can't constrain (jaw/chin) — including those
// only invites degenerate overfits. eyeToNose/eyeToMouth are vertical, so they
// are driven by noseBaseHeight / mouthHeightPosition, NOT by depth length.
const FIT = [
  "eyeSpacing",
  "alarWidth",
  "tipWidth",
  "mouthWidth",
  "faceLength",
  "bizygomaticWidth",
  "noseBaseHeight",
  "mouthHeightPosition",
];
const BOUND = 0.9;
// regularization: prefer the smallest deviation that fits, so the optimizer
// cannot satisfy a ratio by pushing an axis to a degenerate extreme.
const REG = 0.02;
const penalty = (vals) => {
  let s = 0,
    n = 0;
  for (const k of FIT) {
    s += (vals[k] ?? 0) * (vals[k] ?? 0);
    n++;
  }
  return REG * Math.sqrt(s / n);
};

// Only ratios that are RELIABLE on the clay render: face width (jaw/cheek
// contour), iris-centre spacing (the iris discs are clear), nose-wing & mouth
// width, and vertical positions. Eye CORNER / eye-WIDTH metrics are dropped —
// the clay eyes are crude inserted geometry and MediaPipe's corner detection on
// them is noisy (it lured the optimizer into a degenerate eyeWidth).
const ratios = (lm, w, h) => {
  const P = (i) => [lm[i][0] * w, lm[i][1] * h];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const faceWidth = d(P(234), P(454));
  const faceHeight = d(P(10), P(152));
  const irisSpacing = d(P(468), P(473)); // iris centres
  const noseWidth = d(P(129), P(358));
  const mouthWidth = d(P(61), P(291));
  const eyeY = (P(468)[1] + P(473)[1]) / 2;
  const noseTipY = P(1)[1];
  const mouthY = (P(61)[1] + P(291)[1]) / 2;
  const chinY = P(152)[1];
  return {
    facialIndex: faceHeight / faceWidth,
    irisSpacingToFace: irisSpacing / faceWidth,
    noseWidthToFace: noseWidth / faceWidth,
    mouthWidthToFace: mouthWidth / faceWidth,
    eyeToNose: (noseTipY - eyeY) / (chinY - eyeY),
    eyeToMouth: (mouthY - eyeY) / (chinY - eyeY),
  };
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
  window.__faceEditor.setView("front");
});

// detect photo target once
const photo = await page.evaluate(
  async ({ url, sx, sy, sw, sh }) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("load"));
      im.src = url;
    });
    const cvs = document.createElement("canvas");
    cvs.width = sw;
    cvs.height = sh;
    cvs.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const r = window.__fl.detect(cvs);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return f ? { lm: f.map((p) => [p.x, p.y]), w: sw, h: sh } : null;
  },
  {
    url: `/@fs/${rootUrl}/${sheetRel}`,
    sx: Math.round(cell.column * cw),
    sy: Math.round(cell.row * ch),
    sw: Math.round(cw),
    sh: Math.round(ch),
  },
);
const target = ratios(photo.lm, photo.w, photo.h);

await page.evaluate((h) => window.__faceEditor.setPreset(h), hero);

const evalModel = async (values) => {
  const det = await page.evaluate(async (vals) => {
    window.__faceEditor.setValues(vals);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const cvs = document.querySelector("#view");
    const r = window.__fl.detect(cvs);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return f
      ? { lm: f.map((p) => [p.x, p.y]), w: cvs.width, h: cvs.height }
      : null;
  }, values);
  if (!det) return { rms: 99, m: null };
  const m = ratios(det.lm, det.w, det.h);
  return { rms: relRms(m, target), m };
};

// seed from the hero preset (fitted axes only)
const seed = { ...(model.presets[hero]?.values ?? {}) };
let cur = {};
for (const k of FIT) cur[k] = seed[k] ?? 0;
let base = await evalModel(cur);
const startRms = base.rms;
const grid = [];
for (let v = -BOUND; v <= BOUND + 1e-9; v += 0.1) grid.push(+v.toFixed(2));

for (let round = 0; round < 3; round++) {
  for (const p of FIT) {
    let bestV = cur[p];
    let bestObj = (await evalModel(cur)).rms + penalty(cur);
    for (const v of grid) {
      const trial = { ...cur, [p]: v };
      const r = (await evalModel(trial)).rms + penalty(trial);
      if (r < bestObj - 1e-4) {
        bestObj = r;
        bestV = v;
      }
    }
    cur[p] = bestV;
  }
  process.stderr.write(
    `round ${round}: relRMS ${(await evalModel(cur)).rms.toFixed(4)} reg ${penalty(cur).toFixed(4)}\n`,
  );
}
const final = await evalModel(cur);
await page.close();
await browser.close();

const residuals = Object.keys(target).map((k) => ({
  metric: k,
  model: +final.m[k].toFixed(3),
  photo: +target[k].toFixed(3),
  relErr: +((final.m[k] - target[k]) / target[k]).toFixed(3),
}));
const rounded = {};
for (const k of FIT) rounded[k] = +cur[k].toFixed(2);
console.log(
  JSON.stringify(
    {
      hero,
      startRelRms: +startRms.toFixed(4),
      finalRelRms: +final.rms.toFixed(4),
      fittedValues: rounded,
      residuals,
    },
    null,
    2,
  ),
);
