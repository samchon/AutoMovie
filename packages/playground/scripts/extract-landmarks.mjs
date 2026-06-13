// Extract reference face landmarks from the hero photo sheet with MediaPipe
// FaceLandmarker (478 points incl. iris) running in headless Chrome. Front XY is
// reliable (depth z is monocular — do NOT trust it; use the side photos for
// profile). Saves landmarks-<hero>.json and draws a debug overlay so the
// detection is eyeballed before any ratio is trusted.
//
// Needs the Vite dev server on :5173 (so /@fs/ can serve the sheet) and network
// (MediaPipe wasm + model load from CDN).
//
// Usage: node scripts/extract-landmarks.mjs <hero>   (default hero3)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
const outDir = path.join(root, ".shots", "_measure");
fs.mkdirSync(outDir, { recursive: true });
const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:5173";

const model = JSON.parse(
  fs.readFileSync(
    path.join(root, "packages/playground/public/models/head-model.json"),
    "utf8",
  ),
);
const ref = model.references[hero];
const heroNum = hero.replace("hero", "");
const sheetPath = `/@fs/${root.replace(/\\/g, "/")}/.models/hero/${heroNum}/input/face.png`;
const sheetPx = PNG.sync.read(
  fs.readFileSync(path.join(root, `.models/hero/${heroNum}/input/face.png`)),
);
const cw = sheetPx.width / ref.grid.columns;
const ch = sheetPx.height / ref.grid.rows;

const views = [
  "front",
  "leftThreeQuarter",
  "rightThreeQuarter",
  "leftProfile",
  "rightProfile",
].filter((v) => ref.views[v]);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`${BASE}/head.html`, { waitUntil: "load" });

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

const sheetImg = await page.evaluate(
  (url) =>
    new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        window.__sheet = im;
        res({ w: im.naturalWidth, h: im.naturalHeight });
      };
      im.onerror = () => rej(new Error("img load failed: " + url));
      im.src = url;
    }),
  sheetPath,
);

const result = {};
for (const view of views) {
  const cell = ref.views[view];
  const sx = Math.round(cell.column * cw);
  const sy = Math.round(cell.row * ch);
  const sw = Math.round(cw);
  const sh = Math.round(ch);
  const lms = await page.evaluate(
    ({ sx, sy, sw, sh }) => {
      const cvs = document.createElement("canvas");
      cvs.width = sw;
      cvs.height = sh;
      const ctx = cvs.getContext("2d");
      ctx.drawImage(window.__sheet, sx, sy, sw, sh, 0, 0, sw, sh);
      const r = window.__fl.detect(cvs);
      const f = r.faceLandmarks && r.faceLandmarks[0];
      return f
        ? f.map((p) => [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)])
        : null;
    },
    { sx, sy, sw, sh },
  );
  result[view] = {
    cell,
    crop: { w: Math.round(cw), h: Math.round(ch) },
    landmarks: lms,
    count: lms?.length ?? 0,
  };
}

await page.close();
await browser.close();

// ---- save landmarks ----
const jsonPath = path.join(outDir, `landmarks-${hero}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));

// ---- debug overlay on the FRONT crop ----
const front = result.front;
const drawDebug = () => {
  if (!front?.landmarks) return null;
  const sw = front.crop.w,
    sh = front.crop.h;
  const sx = Math.round(front.cell.column * cw),
    sy = Math.round(front.cell.row * ch);
  const out = new PNG({ width: sw, height: sh });
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const s = (sheetPx.width * (sy + y) + (sx + x)) << 2;
      const d = (sw * y + x) << 2;
      out.data[d] = sheetPx.data[s];
      out.data[d + 1] = sheetPx.data[s + 1];
      out.data[d + 2] = sheetPx.data[s + 2];
      out.data[d + 3] = 255;
    }
  const dot = (nx, ny, c, r = 1) => {
    const cx = Math.round(nx * sw),
      cy = Math.round(ny * sh);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const xx = cx + dx,
          yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
        const i = (sw * yy + xx) << 2;
        out.data[i] = c[0];
        out.data[i + 1] = c[1];
        out.data[i + 2] = c[2];
      }
  };
  for (const p of front.landmarks) dot(p[0], p[1], [60, 220, 120], 0);
  const KEY = {
    152: [255, 80, 80],
    10: [255, 80, 80],
    33: [80, 160, 255],
    263: [80, 160, 255],
    133: [255, 230, 90],
    362: [255, 230, 90],
    61: [255, 120, 240],
    291: [255, 120, 240],
    129: [120, 255, 255],
    358: [120, 255, 255],
    234: [255, 160, 60],
    454: [255, 160, 60],
  };
  for (const [i, c] of Object.entries(KEY)) {
    const p = front.landmarks[i];
    if (p) dot(p[0], p[1], c, 2);
  }
  const dbg = path.join(outDir, `landmarks-${hero}-front.png`);
  fs.writeFileSync(dbg, PNG.sync.write(out));
  return dbg;
};
const dbg = drawDebug();

// ---- front ratios from canonical indices (pixel space of the crop) ----
let ratios = null;
if (front?.landmarks) {
  const L = front.landmarks;
  const W = front.crop.w,
    H = front.crop.h;
  const P = (i) => [L[i][0] * W, L[i][1] * H];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const faceWidth = d(P(234), P(454));
  const faceHeight = d(P(10), P(152));
  const eyeWidthR = d(P(33), P(133));
  const eyeWidthL = d(P(263), P(362));
  const eyeWidth = (eyeWidthR + eyeWidthL) / 2;
  const intercanthal = d(P(133), P(362));
  const interocular = d(P(33), P(263));
  const noseWidth = d(P(129), P(358));
  const mouthWidth = d(P(61), P(291));
  const eyeY = (P(33)[1] + P(263)[1]) / 2;
  const chinY = P(152)[1];
  ratios = {
    faceWidth: +faceWidth.toFixed(1),
    faceHeight: +faceHeight.toFixed(1),
    facialIndex: +(faceHeight / faceWidth).toFixed(3),
    eyeWidthToFace: +(eyeWidth / faceWidth).toFixed(3),
    eyeSpacingToWidth: +(intercanthal / eyeWidth).toFixed(3),
    interocularToFace: +(interocular / faceWidth).toFixed(3),
    noseWidthToFace: +(noseWidth / faceWidth).toFixed(3),
    mouthWidthToFace: +(mouthWidth / faceWidth).toFixed(3),
    interocularToEyeChin: +(interocular / (chinY - eyeY)).toFixed(3),
  };
}

console.log(
  JSON.stringify(
    {
      hero,
      detected: Object.fromEntries(views.map((v) => [v, result[v].count])),
      frontRatios: ratios,
      landmarksJson: path.relative(root, jsonPath),
      debug: dbg ? path.relative(root, dbg) : null,
    },
    null,
    2,
  ),
);
