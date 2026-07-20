// Measure a model render PNG vs a reference photo with a COMPLETE metric set,
// including the blind spots my earlier reviews missed: EYE APERTURE (openness +
// absolute size) and LIP THICKNESS (upper/lower). Runs MediaPipe FaceLandmarker
// (478 pts, iris-refined) on both images via the vite-served page.
//
// Usage: node mh_dissect.mjs <modelPng> <refPng> [label]   (BASE overrides server)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const [modelPng, refPng, label = "cmp"] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const CHROME = process.env.CHROME ?? { win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", linux: "google-chrome" }[process.platform];

// stage both images where vite serves them
const cmpDir = path.join(root, "packages/playground/public/mh/_cmp");
fs.mkdirSync(cmpDir, { recursive: true });
fs.copyFileSync(modelPng, path.join(cmpDir, "model.png"));
fs.copyFileSync(refPng, path.join(cmpDir, "ref.png"));

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(`${BASE}/mhhead.html`, { waitUntil: "load" }).catch(() => {});

const result = await page.evaluate(async () => {
  const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14");
  const { FaceLandmarker, FilesetResolver } = vision;
  const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
  const fl = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" },
    runningMode: "IMAGE", numFaces: 1, outputFaceBlendshapes: false,
  });
  const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.src = src; });
  const detect = async (src) => {
    const im = await loadImg(src);
    const r = fl.detect(im);
    if (!r.faceLandmarks || !r.faceLandmarks.length) return null;
    return { lm: r.faceLandmarks[0].map((p) => [p.x, p.y]), w: im.naturalWidth, h: im.naturalHeight };
  };
  return { model: await detect("/mh/_cmp/model.png"), ref: await detect("/mh/_cmp/ref.png") };
});
await browser.close();

const ratios = (det) => {
  if (!det || !det.lm) return null;
  const L = det.lm, P = (i) => [L[i][0] * det.w, L[i][1] * det.h], d = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
  const faceWidth = d(P(234), P(454)), faceHeight = d(P(10), P(152));
  const eyeWidthL = d(P(33), P(133)), eyeWidthR = d(P(263), P(362));
  const eyeHeightL = d(P(159), P(145)), eyeHeightR = d(P(386), P(374));
  const eyeWidth = (eyeWidthL + eyeWidthR) / 2, eyeHeight = (eyeHeightL + eyeHeightR) / 2;
  const irisSpacing = d(P(468), P(473)), noseWidth = d(P(129), P(358)), mouthWidth = d(P(61), P(291));
  const upperLip = Math.abs(P(0)[1] - P(13)[1]), lowerLip = Math.abs(P(14)[1] - P(17)[1]);
  const lipThick = Math.abs(P(0)[1] - P(17)[1]);
  const eyeY = (P(33)[1] + P(263)[1]) / 2, noseTipY = P(1)[1], mouthY = (P(61)[1] + P(291)[1]) / 2, chinY = P(152)[1];
  const browY = (P(105)[1] + P(334)[1]) / 2;
  return {
    facialIndex: faceHeight / faceWidth,
    eyeWidthToFace: eyeWidth / faceWidth,        // absolute eye size (horizontal)
    eyeHeightToFace: eyeHeight / faceHeight,      // absolute eye size (vertical)
    eyeOpenness: eyeHeight / eyeWidth,            // aperture roundness/openness
    irisSpacingToFace: irisSpacing / faceWidth,
    noseWidthToFace: noseWidth / faceWidth,
    mouthWidthToFace: mouthWidth / faceWidth,
    lipThicknessToFace: lipThick / faceHeight,    // total lip thickness (BLIND SPOT)
    upperLipToFace: upperLip / faceHeight,
    lowerLipToFace: lowerLip / faceHeight,
    eyeToNose: (noseTipY - eyeY) / (chinY - eyeY),
    eyeToMouth: (mouthY - eyeY) / (chinY - eyeY),
    browToEye: (eyeY - browY) / faceHeight,
  };
};

const rm = ratios(result.model), rp = ratios(result.ref);
const out = { label, modelDetected: !!rm, refDetected: !!rp, metrics: [] };
if (rm && rp) {
  for (const k of Object.keys(rp)) {
    const relErr = rp[k] ? (rm[k] - rp[k]) / rp[k] : 0;
    out.metrics.push({ metric: k, ref: +rp[k].toFixed(4), model: +rm[k].toFixed(4), relErr: +relErr.toFixed(4) });
  }
  out.metrics.sort((a, b) => Math.abs(b.relErr) - Math.abs(a.relErr));
}
const outPath = path.join(root, ".shots", "_measure", `mhdissect-${label}.json`);
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (errs.length) console.log("ERRORS:", errs.slice(0, 3).join(" | "));
