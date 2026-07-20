// Compare the hair-robust LOWER-face contour (jaw + chin) of the clay model vs
// the hero photo, apples-to-apples via MediaPipe face-oval landmarks. The jaw
// arc is detected reliably on BOTH a haired photo and the clay (unlike the
// crude clay eyes / hair-biased forehead). Landmarks are chin-anchored and
// bizygomatic-scaled, so the residual is pure jaw/chin SHAPE error.
//
// Needs Vite on :5173 + network. Model is driven live (OVR sweeps with no
// rebuild). Usage: node scripts/compare-jaw.mjs <hero>
//   sweep:  OVR='{"jawWidth":-0.5}' node scripts/compare-jaw.mjs hero3
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
const sheetRel = `.models/hero/${heroNum}/input/face.png`;
const sheetPx = PNG.sync.read(fs.readFileSync(path.join(root, sheetRel)));
const cw = sheetPx.width / ref.grid.columns;
const ch = sheetPx.height / ref.grid.rows;
const cell = ref.views.front;

// lower face-oval arc: right zygion -> jaw -> chin(152) -> jaw -> left zygion
const JAW = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365,
  397, 288, 361, 323, 454,
];

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

const photo = await page.evaluate(
  async ({ url, sx, sy, sw, sh }) => {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error("load"));
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
    url: `/@fs/${rootUrl}/${sheetRel}`,
    sx: Math.round(cell.column * cw),
    sy: Math.round(cell.row * ch),
    sw: Math.round(cw),
    sh: Math.round(ch),
  },
);

const modelDet = await page.evaluate(
  async ({ hero, ovr }) => {
    window.__faceEditor.setPreset(hero);
    if (ovr) window.__faceEditor.setValues(ovr);
    window.__faceEditor.setView("front");
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const c = document.querySelector("#view");
    const r = window.__fl.detect(c);
    const f = r.faceLandmarks && r.faceLandmarks[0];
    return f ? { lm: f.map((p) => [p.x, p.y]), w: c.width, h: c.height } : null;
  },
  { hero, ovr },
);

await page.close();
await browser.close();

// normalize a detection: chin(152) at origin, scale by bizygomatic(234-454)
const normArc = (det) => {
  const P = (i) => [det.lm[i][0] * det.w, det.lm[i][1] * det.h];
  const chin = P(152);
  const biz = Math.hypot(P(234)[0] - P(454)[0], P(234)[1] - P(454)[1]);
  return JAW.map((i) => {
    const p = P(i);
    return [(p[0] - chin[0]) / biz, (p[1] - chin[1]) / biz];
  });
};
const ap = normArc(photo);
const am = normArc(modelDet);
let sum = 0;
const perPoint = JAW.map((idx, k) => {
  const e = Math.hypot(am[k][0] - ap[k][0], am[k][1] - ap[k][1]);
  sum += e * e;
  return {
    idx,
    err: +e.toFixed(4),
    dx: +(am[k][0] - ap[k][0]).toFixed(4),
    dy: +(am[k][1] - ap[k][1]).toFixed(4),
  };
});
const rms = Math.sqrt(sum / JAW.length);
// Hair-free chin + lower-jaw subset only. The upper-arc points (zygion 234/454
// and the temple-side points) sit under hair in the photo, so MediaPipe places
// them inconsistently vs the bald clay, a vertical artifact, not a jaw-shape
// error. This subset is the trustworthy jawline signal.
const CHIN_SUBSET = [
  172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397,
];
let lsum = 0;
for (const idx of CHIN_SUBSET) {
  const k = JAW.indexOf(idx);
  lsum += (am[k][0] - ap[k][0]) ** 2 + (am[k][1] - ap[k][1]) ** 2;
}
const lowerJawRms = Math.sqrt(lsum / CHIN_SUBSET.length);

// overlay plot: photo arc (red) vs model arc (green), normalized frame
const PW = 360,
  PH = 320;
const plot = new PNG({ width: PW, height: PH });
for (let i = 0; i < plot.data.length; i += 4) {
  plot.data[i] = 16;
  plot.data[i + 1] = 18;
  plot.data[i + 2] = 22;
  plot.data[i + 3] = 255;
}
const sx = (x) => Math.round(PW / 2 + x * (PW * 0.42));
const sy = (y) => Math.round(PH * 0.2 + y * (PH * 0.42)); // chin at y=0 near top-ish; arc goes up (negative y)
const put = (x, y, c) => {
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
for (let k = 0; k < JAW.length; k++) {
  put(sx(ap[k][0]), sy(ap[k][1]), [240, 70, 70]);
  put(sx(am[k][0]), sy(am[k][1]), [80, 220, 120]);
}
const plotPath = path.join(outDir, `jaw-${hero}-compare.png`);
fs.writeFileSync(plotPath, PNG.sync.write(plot));

console.log(
  JSON.stringify(
    {
      hero,
      ovr,
      photoDetected: !!photo?.lm,
      modelDetected: !!modelDet?.lm,
      jawShapeRms: +rms.toFixed(4),
      lowerJawRms: +lowerJawRms.toFixed(4),
      worst: perPoint
        .slice()
        .sort((a, b) => b.err - a.err)
        .slice(0, 5),
      compare: path.relative(root, plotPath),
    },
    null,
    2,
  ),
);
