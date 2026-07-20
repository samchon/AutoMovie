// Aspect-CORRECT, landmark-ALIGNED overlay for honest visual verification.
//
// The head.html overlay stretches a portrait photo cell to the wide viewport
// (background-size), so its proportions are wrong. Never trust it for shape.
// This tool instead detects MediaPipe landmarks on BOTH the native (undistorted)
// photo cell and the model's clay #view, computes a similarity transform
// (uniform scale + rotation + translation: preserves aspect) from two robust
// anchors (the iris centres), warps the photo onto the model frame so the eyes
// coincide, and alpha-blends. Whatever then fails to line up (face length, jaw,
// nose, mouth, chin) is a REAL shape difference, not a display artifact.
//
// Needs Vite :5173 + network. Usage: node scripts/overlay-aligned.mjs <hero>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
// view: front | leftThreeQuarter | rightThreeQuarter (3/4 alignment is
// approximate: if the photo yaw differs from the model camera yaw, the
// iris-similarity overlay shows that yaw gap, not a shape error).
const view = process.argv[3] ?? "front";
const CHROME =
  process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:5173";
const rootUrl = root.replace(/\\/g, "/");
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
const cw = sheet.width / ref.grid.columns;
const ch = sheet.height / ref.grid.rows;
const cell = ref.views[view] ?? ref.views.front;
const cx0 = Math.round(cell.column * cw),
  cy0 = Math.round(cell.row * ch);
const cwi = Math.round(cw),
  chi = Math.round(ch);
// crop the native (undistorted) photo cell
const cellPng = new PNG({ width: cwi, height: chi });
for (let y = 0; y < chi; y++)
  for (let x = 0; x < cwi; x++) {
    const s = (sheet.width * (cy0 + y) + (cx0 + x)) << 2;
    const d = (cwi * y + x) << 2;
    cellPng.data[d] = sheet.data[s];
    cellPng.data[d + 1] = sheet.data[s + 1];
    cellPng.data[d + 2] = sheet.data[s + 2];
    cellPng.data[d + 3] = 255;
  }

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
await page.goto(`${BASE}/head.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__faceEditor?.setValues);
await page.addStyleTag({
  content: `#panel,#strip,#hud,#reference{display:none!important}#stage{grid-template-columns:1fr!important}#workbench{grid-template-rows:1fr!important}`,
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
const photoLm = await page.evaluate(
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
    return f ? f.map((p) => [p.x * sw, p.y * sh]) : null;
  },
  {
    url: `/@fs/${rootUrl}/.models/hero/${heroNum}/input/face.png`,
    sx: cx0,
    sy: cy0,
    sw: cwi,
    sh: chi,
  },
);
await page.evaluate(
  ([h, v]) => {
    window.__faceEditor.setPreset(h);
    window.__faceEditor.setView(v);
  },
  [hero, view],
);
await page.evaluate(
  () =>
    new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
);
const modelShot = await page.locator("#view").screenshot({ type: "png" });
const modelLm = await page.evaluate(async () => {
  const c = document.querySelector("#view");
  const r = window.__fl.detect(c);
  const f = r.faceLandmarks && r.faceLandmarks[0];
  return f
    ? {
        lm: f.map((p) => [p.x * c.width, p.y * c.height]),
        w: c.width,
        h: c.height,
      }
    : null;
});
await page.close();
await browser.close();

if (!photoLm || !modelLm) {
  console.log(
    JSON.stringify({
      hero,
      error: "detection failed",
      photo: !!photoLm,
      model: !!modelLm,
    }),
  );
  process.exit(0);
}
const mImg = PNG.sync.read(modelShot);

// similarity transform photo->model from the two iris centres (468, 473)
const pA = photoLm[468],
  pB = photoLm[473];
const mA = modelLm.lm[468],
  mB = modelLm.lm[473];
const pd = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
const md = Math.hypot(mB[0] - mA[0], mB[1] - mA[1]);
const s = md / pd;
const pth = Math.atan2(pB[1] - pA[1], pB[0] - pA[0]);
const mth = Math.atan2(mB[1] - mA[1], mB[0] - mA[0]);
const dth = mth - pth;
// inverse map model px -> photo px: P = pA + (1/s) R(-dth) (M - mA)
const cosI = Math.cos(-dth) / s,
  sinI = Math.sin(-dth) / s;
const ALPHA = 0.5;
for (let my = 0; my < mImg.height; my++)
  for (let mx = 0; mx < mImg.width; mx++) {
    const dx = mx - mA[0],
      dy = my - mA[1];
    const px = pA[0] + (cosI * dx - sinI * dy);
    const py = pA[1] + (sinI * dx + cosI * dy);
    const sxp = Math.round(px),
      syp = Math.round(py);
    if (sxp < 0 || syp < 0 || sxp >= cwi || syp >= chi) continue;
    const si = (cwi * syp + sxp) << 2;
    const di = (mImg.width * my + mx) << 2;
    mImg.data[di] = Math.round(
      mImg.data[di] * (1 - ALPHA) + cellPng.data[si] * ALPHA,
    );
    mImg.data[di + 1] = Math.round(
      mImg.data[di + 1] * (1 - ALPHA) + cellPng.data[si + 1] * ALPHA,
    );
    mImg.data[di + 2] = Math.round(
      mImg.data[di + 2] * (1 - ALPHA) + cellPng.data[si + 2] * ALPHA,
    );
  }
const suffix = view === "front" ? "" : `-${view}`;
const outPath = path.join(outDir, `overlay-aligned-${hero}${suffix}.png`);
fs.writeFileSync(outPath, PNG.sync.write(mImg));
console.log(
  JSON.stringify(
    {
      hero,
      anchorsIris: {
        photo: [pA, pB].map((p) => p.map((v) => +v.toFixed(1))),
        model: [mA, mB].map((p) => p.map((v) => +v.toFixed(1))),
      },
      scalePhotoToModel: +s.toFixed(3),
      out: path.relative(root, outPath),
    },
    null,
    2,
  ),
);
