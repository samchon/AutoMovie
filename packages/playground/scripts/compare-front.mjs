// Compare FRONT proportions of the clay model vs the hero photo, apples-to-
// apples: run the SAME MediaPipe FaceLandmarker on (a) the hero front photo and
// (b) the model's clay front, then compute identical canonical-index ratios and
// report the gaps. The model side is driven LIVE in the editor (#view canvas),
// so OVR can sweep parameter values with no rebuild/re-render.
//
// Needs Vite on :5173 and network (MediaPipe from CDN).
//
// Usage:            node scripts/compare-front.mjs <hero>
//   sweep a value:  OVR='{"eyeSpacing":0.2}' node scripts/compare-front.mjs hero3
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
const ovr = process.env.OVR ? JSON.parse(process.env.OVR) : null;

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

// photo: detect on the front cell crop of the sheet
const photo = await page.evaluate(
  async ({ url, sx, sy, sw, sh }) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("load " + url));
      im.src = url;
    });
    const cvs = document.createElement("canvas");
    cvs.width = sw;
    cvs.height = sh;
    cvs.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const r = window.__fl.detect(cvs);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return { lm: f ? f.map((p) => [p.x, p.y]) : null, w: sw, h: sh };
  },
  {
    url: `/@fs/${rootUrl}/${sheetRel}`,
    sx: Math.round(cell.column * cw),
    sy: Math.round(cell.row * ch),
    sw: Math.round(cw),
    sh: Math.round(ch),
  },
);

// model: drive the editor live, detect on the #view canvas
const modelDet = await page.evaluate(
  async ({ hero, ovr }) => {
    window.__faceEditor.setPreset(hero);
    if (ovr) window.__faceEditor.setValues(ovr);
    window.__faceEditor.setView("front");
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const cvs = document.querySelector("#view");
    const r = window.__fl.detect(cvs);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return {
      lm: f ? f.map((p) => [p.x, p.y]) : null,
      w: cvs.width,
      h: cvs.height,
    };
  },
  { hero, ovr },
);

await page.close();
await browser.close();

const ratios = (det) => {
  if (!det.lm) return null;
  const L = det.lm;
  const P = (i) => [L[i][0] * det.w, L[i][1] * det.h];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const faceWidth = d(P(234), P(454));
  const faceHeight = d(P(10), P(152));
  const eyeWidth = (d(P(33), P(133)) + d(P(263), P(362))) / 2;
  const intercanthal = d(P(133), P(362));
  const interocular = d(P(33), P(263));
  const irisSpacing = d(P(468), P(473)); // iris centres, reliable on both
  const noseWidth = d(P(129), P(358));
  const mouthWidth = d(P(61), P(291));
  const eyeY = (P(33)[1] + P(263)[1]) / 2;
  const noseTipY = P(1)[1];
  const mouthY = (P(61)[1] + P(291)[1]) / 2;
  const chinY = P(152)[1];
  return {
    facialIndex: faceHeight / faceWidth,
    irisSpacingToFace: irisSpacing / faceWidth,
    eyeWidthToFace: eyeWidth / faceWidth,
    eyeSpacingToWidth: intercanthal / eyeWidth,
    noseWidthToFace: noseWidth / faceWidth,
    mouthWidthToFace: mouthWidth / faceWidth,
    eyeToNose: (noseTipY - eyeY) / (chinY - eyeY),
    eyeToMouth: (mouthY - eyeY) / (chinY - eyeY),
  };
};

const rp = ratios(photo);
const rm = ratios(modelDet);
const rows = [];
let rms = 0;
if (rp && rm) {
  for (const k of Object.keys(rp)) {
    const relErr = (rm[k] - rp[k]) / rp[k];
    rms += relErr * relErr;
    rows.push({
      metric: k,
      model: +rm[k].toFixed(3),
      photo: +rp[k].toFixed(3),
      relErr: +relErr.toFixed(3),
    });
  }
  rms = Math.sqrt(rms / rows.length);
  rows.sort((a, b) => Math.abs(b.relErr) - Math.abs(a.relErr));
}

console.log(
  JSON.stringify(
    {
      hero,
      ovr,
      photoDetected: !!photo.lm,
      modelDetected: !!modelDet.lm,
      relRms: +rms.toFixed(4),
      comparison: rows,
    },
    null,
    2,
  ),
);
