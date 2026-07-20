// Pose-matched 3/4 aligned overlay. A fixed 3/4 model camera does not match the
// photo's head yaw, so a plain overlay shows the yaw gap, not shape. Here we
// estimate the photo's head yaw from MediaPipe's facial transformation matrix,
// point the model camera at that same yaw, then iris-align and blend, so what
// remains is a REAL shape difference at 3/4 (cheekbone/jaw/nose projection).
//
// Needs Vite :5173 + network. Usage: node scripts/overlay-pose.mjs <hero> <view>
//   view: rightThreeQuarter | leftThreeQuarter (default rightThreeQuarter)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
const view = process.argv[3] ?? "rightThreeQuarter";
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
await page.waitForFunction(() => window.__faceEditor?.setCameraYaw);
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
    outputFacialTransformationMatrixes: true,
  });
});

const photo = await page.evaluate(
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
    const m =
      r.facialTransformationMatrixes && r.facialTransformationMatrixes[0];
    return f
      ? {
          lm: f.map((p) => [p.x * sw, p.y * sh]),
          matrix: m ? Array.from(m.data) : null,
        }
      : null;
  },
  {
    url: `/@fs/${rootUrl}/.models/hero/${heroNum}/input/face.png`,
    sx: cx0,
    sy: cy0,
    sw: cwi,
    sh: chi,
  },
);
if (!photo || !photo.matrix) {
  await browser.close();
  console.log(JSON.stringify({ hero, view, error: "no photo pose" }));
  process.exit(0);
}
// column-major 4x4; forward axis = col2 (m[8],m[9],m[10]); yaw about Y
const m = photo.matrix;
const yawDeg = (Math.atan2(m[8], m[10]) * 180) / Math.PI;

// render the model at the matched yaw (try both signs, keep the closer match)
const renderAt = async (deg) => {
  await page.evaluate((d) => {
    window.__faceEditor.setCameraYaw(d);
  }, deg);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const shot = await page.locator("#view").screenshot({ type: "png" });
  const det = await page.evaluate(() => {
    const c = document.querySelector("#view");
    const r = window.__fl.detect(c);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    const mm =
      r.facialTransformationMatrixes && r.facialTransformationMatrixes[0];
    return f
      ? {
          lm: f.map((p) => [p.x * c.width, p.y * c.height]),
          w: c.width,
          h: c.height,
          yaw: mm
            ? (Math.atan2(mm.data[8], mm.data[10]) * 180) / Math.PI
            : null,
        }
      : null;
  });
  return { shot, det };
};
await page.evaluate((h) => window.__faceEditor.setPreset(h), hero);
let best = null;
for (const deg of [yawDeg, -yawDeg]) {
  const r = await renderAt(deg);
  if (r.det && r.det.yaw != null) {
    const err = Math.abs(r.det.yaw - yawDeg);
    if (!best || err < best.err) best = { ...r, deg, err };
  }
}
await page.close();
await browser.close();
if (!best) {
  console.log(
    JSON.stringify({
      hero,
      view,
      photoYaw: +yawDeg.toFixed(1),
      error: "model not detected at yaw",
    }),
  );
  process.exit(0);
}

const mImg = PNG.sync.read(best.shot);
const pA = photo.lm[468],
  pB = photo.lm[473];
const mA = best.det.lm[468],
  mB = best.det.lm[473];
const s =
  Math.hypot(mB[0] - mA[0], mB[1] - mA[1]) /
  Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
const dth =
  Math.atan2(mB[1] - mA[1], mB[0] - mA[0]) -
  Math.atan2(pB[1] - pA[1], pB[0] - pA[0]);
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
const outPath = path.join(outDir, `overlay-pose-${hero}-${view}.png`);
fs.writeFileSync(outPath, PNG.sync.write(mImg));
console.log(
  JSON.stringify(
    {
      hero,
      view,
      photoYaw: +yawDeg.toFixed(1),
      modelYawUsed: +best.deg.toFixed(1),
      modelYawDetected: +best.det.yaw.toFixed(1),
      out: path.relative(root, outPath),
    },
    null,
    2,
  ),
);
