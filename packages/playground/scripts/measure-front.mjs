// Quantify the FRONT face contour/widths from a hero front photo and from the
// model geometry, then compare normalized ratios.
//
// Front is harder than profile: hair occludes the upper face oval. So we
// skin-segment (skin = warm & bright; hair = dark; backdrop/shirt = neutral)
// and use the reliably hair-free LOWER face — jaw and chin width and the
// chin-to-brow height — plus whatever cheek width is visible.
//
// Usage: node scripts/measure-front.mjs <hero>   (default hero3)
// Step 1: extract + draw the skin mask edges so the segmentation can be
// eyeballed before any number is trusted.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const hero = process.argv[2] ?? "hero3";
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

// --- crop the front cell ---
const cell = ref.views.front;
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

// --- pixel classes ---
const isSkin = (x, y) => {
  const [r, g, b] = px(crop, x, y);
  // warm (R>G>=B), not too dark (hair), not neutral/bright (backdrop, shirt)
  return (
    r > 95 && r < 252 && r - b > 14 && r - b < 105 && g > b - 6 && r - g > 4
  );
};

// per-row skin extent
const left = new Array(chi).fill(-1);
const right = new Array(chi).fill(-1);
const cnt = new Array(chi).fill(0);
const RUN = 4;
for (let y = 0; y < chi; y++) {
  let lo = -1,
    hi = -1,
    n = 0;
  for (let x = 0; x < cwi; x++) if (isSkin(x, y)) n++;
  // left edge = first run of skin
  for (let x = 0; x < cwi - RUN; x++) {
    let ok = true;
    for (let k = 0; k < RUN; k++)
      if (!isSkin(x + k, y)) {
        ok = false;
        break;
      }
    if (ok) {
      lo = x;
      break;
    }
  }
  for (let x = cwi - 1; x >= RUN; x--) {
    let ok = true;
    for (let k = 0; k < RUN; k++)
      if (!isSkin(x - k, y)) {
        ok = false;
        break;
      }
    if (ok) {
      hi = x;
      break;
    }
  }
  left[y] = lo;
  right[y] = hi;
  cnt[y] = n;
}
// main face band = longest run of rows with substantial skin
let bandStart = 0,
  bandEnd = chi - 1;
{
  let runS = -1,
    bestS = 0,
    bestE = 0;
  for (let y = 0; y <= chi; y++) {
    const on = y < chi && cnt[y] > cwi * 0.06;
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

// --- draw skin edges for visual verification ---
const dot = (x, y, c) => {
  if (x < 0 || y < 0 || x >= cwi || y >= chi) return;
  const i = (cwi * y + x) << 2;
  crop.data[i] = c[0];
  crop.data[i + 1] = c[1];
  crop.data[i + 2] = c[2];
};
for (let y = bandStart; y <= bandEnd; y++) {
  for (let d = -1; d <= 1; d++) {
    if (left[y] >= 0) dot(left[y] + d, y, [255, 40, 40]);
    if (right[y] >= 0) dot(right[y] + d, y, [60, 120, 255]);
  }
}
const widthAt = (frac) => {
  const y = Math.round(bandStart + (bandEnd - bandStart) * frac);
  return left[y] >= 0 && right[y] >= 0 ? right[y] - left[y] : -1;
};
const outPath = path.join(outDir, `front-${hero}-debug.png`);
fs.writeFileSync(outPath, PNG.sync.write(crop));
console.log(
  JSON.stringify(
    {
      hero,
      cropSize: [cwi, chi],
      band: [bandStart, bandEnd],
      bandHeight: bandEnd - bandStart,
      widthAt: {
        f15: widthAt(0.15),
        f4: widthAt(0.4),
        f6: widthAt(0.6),
        f8: widthAt(0.8),
        f92: widthAt(0.92),
      },
      debug: path.relative(root, outPath),
    },
    null,
    2,
  ),
);
