/* eslint-disable */
// Regenerate the .shots/*.mp4 demo clips. Drives the playground viewer pages in
// ONE persistent headless-Chromium session (Playwright): the page is loaded
// once per clip, then `window.__afSeek(t)` steps it to each frame deterministi-
// cally and the canvas is screenshotted — no per-frame browser relaunch. Frames
// are encoded straight to H.264 MP4 in-process (wasm), so no ffmpeg needed.
//
// Prerequisites:
//   1. Dev server running:  pnpm --filter @autofilm/playground dev   (:5173)
//   2. Google Chrome installed (Playwright drives it via executablePath).
// Overrides: CHROME=/path/to/chrome, BASE=http://host:port.
//
// Usage:
//   node scripts/capture-shots.mjs            # all shots
//   node scripts/capture-shots.mjs shadowbox  # only outputs matching the arg
import HMEmod from "h264-mp4-encoder";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { PNG } from "pngjs";

const HME = HMEmod.default ?? HMEmod;
const here = path.dirname(fileURLToPath(import.meta.url));
const shotsDir = path.resolve(here, "../../../.shots");
const BASE = process.env.BASE ?? "http://localhost:5173";
const CHROME =
  process.env.CHROME ??
  {
    win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "google-chrome",
  }[process.platform];

// [page, query (no t/cap), durationSeconds, frames, width, height, out, fps]
const SHOTS = [
  [
    "stickman.html",
    "char=human&clip=shadowbox&az=28",
    30.2,
    480,
    600,
    720,
    "human/shadowbox.mp4",
    30,
  ],
  [
    "knight.html",
    "clip=performance&az=38",
    28.8,
    460,
    720,
    720,
    "knight/scenario.mp4",
    30,
  ],
  [
    "knight.html",
    "clip=gallopTravel&follow=1&az=42",
    4.96,
    150,
    720,
    720,
    "knight/charge.mp4",
    30,
  ],
  ["spar.html", "", 29.55, 470, 760, 620, "spar/ko.mp4", 30],
  ["archery.html", "az=62", 3.8, 115, 720, 600, "knight/archery.mp4", 30],
  [
    "stickman.html",
    "char=human&clip=walk&az=80",
    1.0,
    30,
    560,
    660,
    "human/walk.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=human&clip=run&az=80",
    0.6,
    36,
    560,
    660,
    "human/run.mp4",
    60,
  ],
  [
    "stickman.html",
    "char=human&clip=kick&az=35",
    1.0,
    40,
    560,
    660,
    "human/kick.mp4",
    40,
  ],
  [
    "stickman.html",
    "char=human&clip=combo&az=30",
    5.2,
    160,
    560,
    660,
    "human/combo.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=human&clip=stroll&follow=1&az=70",
    6.0,
    180,
    640,
    640,
    "human/stroll.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=human&clip=sprint&follow=1&az=70",
    5.4,
    162,
    640,
    640,
    "human/sprint.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=cat&clip=walk&az=70",
    0.8,
    32,
    600,
    620,
    "cat/walk.mp4",
    40,
  ],
  [
    "stickman.html",
    "char=cat&clip=leap&az=70",
    1.0,
    40,
    600,
    620,
    "cat/leap.mp4",
    40,
  ],
  [
    "stickman.html",
    "char=cat&clip=combo&az=40",
    6.6,
    198,
    600,
    620,
    "cat/combo.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=cat&clip=prowl&follow=1&az=65",
    6.4,
    192,
    640,
    640,
    "cat/prowl.mp4",
    30,
  ],
  [
    "stickman.html",
    "char=cat&clip=bound&follow=1&az=65",
    5.0,
    150,
    640,
    640,
    "cat/bound.mp4",
    30,
  ],
];

const only = process.argv[2];
const shots = only ? SHOTS.filter((s) => s[6].includes(only)) : SHOTS;
if (shots.length === 0) {
  console.error(`no shots match "${only}"`);
  process.exit(1);
}

const even = (n) => n - (n % 2);

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});

const capture = async ([page, q, dur, n, w, h, out, fps]) => {
  const W = even(w);
  const H = even(h);
  const dest = path.join(shotsDir, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const pg = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  const sep = q ? "&" : "";
  await pg.goto(`${BASE}/${page}?${q}${sep}cap=1`, { waitUntil: "load" });
  await pg.waitForFunction(() => typeof window.__afSeek === "function");
  // frame only the 3D — hide any UI overlay (clip-selector bar) that would
  // otherwise overlap the canvas in the element screenshot
  await pg.addStyleTag({ content: "#clips{display:none!important}" });
  const view = pg.locator("#view");

  const enc = await HME.createH264MP4Encoder();
  enc.width = W;
  enc.height = H;
  enc.frameRate = fps;
  enc.quantizationParameter = 20; // lower = higher quality
  enc.initialize();

  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = (dur * i) / (n - 1);
    await pg.evaluate((tt) => window.__afSeek(tt), t);
    const buf = await view.screenshot({ type: "png" });
    const png = PNG.sync.read(buf);
    enc.addFrameRgba(new Uint8Array(png.data));
  }
  enc.finalize();
  fs.writeFileSync(dest, Buffer.from(enc.FS.readFile(enc.outputFilename)));
  enc.delete();
  await pg.close();
  console.log(
    `wrote ${out} (${n} frames @ ${fps}fps, ${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
};

for (const shot of shots) await capture(shot);
await browser.close();
console.log("done");
