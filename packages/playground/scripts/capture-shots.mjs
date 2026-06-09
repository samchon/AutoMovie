/* eslint-disable */
// Regenerate the .shots/*.gif demo clips by driving headless Chrome over the
// playground viewer pages and encoding the frames to animated GIFs.
//
// Prerequisites:
//   1. The dev server must be running:  pnpm --filter @autofilm/playground dev
//      (serves the pages at http://localhost:5173)
//   2. Google Chrome must be installed. Override the binary with CHROME=/path,
//      and the server with BASE=http://host:port, if they differ.
//
// Usage:
//   node scripts/capture-shots.mjs            # all shots
//   node scripts/capture-shots.mjs shadowbox  # only shots whose out-path matches
//
// Each frame is a deterministic freeze (?t=<seconds>) so the output is stable.
// GIFs land under <repo>/.shots (gitignored scratch — derived from the AST, not
// committed source).
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

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

// page, query (without t), duration s, frame count, width, height, out, fps
const SHOTS = [
  // headliners
  [
    "stickman.html",
    "char=human&clip=shadowbox&az=28",
    30.2,
    240,
    480,
    560,
    "human/shadowbox.gif",
    8,
  ],
  [
    "knight.html",
    "clip=performance&az=38",
    28.8,
    200,
    600,
    600,
    "knight/scenario.gif",
    8,
  ],
  [
    "knight.html",
    "clip=gallopTravel&follow=1&az=42",
    4.96,
    48,
    600,
    600,
    "knight/charge.gif",
    9,
  ],
  ["spar.html", "", 29.55, 200, 640, 520, "spar/ko.gif", 8],
  // human clip library
  [
    "stickman.html",
    "char=human&clip=walk&az=80",
    1.0,
    26,
    480,
    560,
    "human/walk.gif",
    26,
  ],
  [
    "stickman.html",
    "char=human&clip=run&az=80",
    0.6,
    20,
    480,
    560,
    "human/run.gif",
    24,
  ],
  [
    "stickman.html",
    "char=human&clip=kick&az=35",
    1.0,
    26,
    480,
    560,
    "human/kick.gif",
    16,
  ],
  [
    "stickman.html",
    "char=human&clip=dance&az=20",
    1.4,
    30,
    480,
    560,
    "human/dance.gif",
    18,
  ],
  [
    "stickman.html",
    "char=human&clip=combo&az=30",
    5.2,
    42,
    480,
    560,
    "human/combo.gif",
    8,
  ],
  [
    "stickman.html",
    "char=human&clip=stroll&follow=1&az=70",
    6.0,
    48,
    560,
    560,
    "human/stroll.gif",
    8,
  ],
  [
    "stickman.html",
    "char=human&clip=sprint&follow=1&az=70",
    5.4,
    44,
    560,
    560,
    "human/sprint.gif",
    8,
  ],
  // cat clip library
  [
    "stickman.html",
    "char=cat&clip=walk&az=70",
    0.8,
    24,
    520,
    560,
    "cat/walk.gif",
    24,
  ],
  [
    "stickman.html",
    "char=cat&clip=leap&az=70",
    1.0,
    26,
    520,
    560,
    "cat/leap.gif",
    16,
  ],
  [
    "stickman.html",
    "char=cat&clip=combo&az=40",
    6.6,
    44,
    520,
    560,
    "cat/combo.gif",
    8,
  ],
  [
    "stickman.html",
    "char=cat&clip=prowl&follow=1&az=65",
    6.4,
    50,
    560,
    560,
    "cat/prowl.gif",
    8,
  ],
  [
    "stickman.html",
    "char=cat&clip=bound&follow=1&az=65",
    5.0,
    42,
    560,
    560,
    "cat/bound.gif",
    8,
  ],
];

const only = process.argv[2];
const shots = only ? SHOTS.filter((s) => s[6].includes(only)) : SHOTS;
if (shots.length === 0) {
  console.error(`no shots match "${only}"`);
  process.exit(1);
}

const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), "autofilm-shot-"));

const capture = ([page, q, dur, n, w, h, out, fps]) => {
  const dest = path.join(shotsDir, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);
  for (let i = 0; i < n; i++) {
    const t = ((dur * i) / (n - 1)).toFixed(3);
    const frame = path.join(frameDir, `f${String(i).padStart(3, "0")}.png`);
    const sep = q ? "&" : "";
    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        `--window-size=${w},${h}`,
        "--force-device-scale-factor=1",
        "--virtual-time-budget=2200",
        `--user-data-dir=${path.join(frameDir, `profile-${i}`)}`,
        `--screenshot=${frame}`,
        `${BASE}/${page}?${q}${sep}t=${t}`,
      ],
      { stdio: "ignore" },
    );
    const { data, width, height } = PNG.sync.read(fs.readFileSync(frame));
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.length);
    const palette = quantize(rgba, 256);
    gif.writeFrame(applyPalette(rgba, palette), width, height, {
      palette,
      delay,
    });
  }
  gif.finish();
  fs.writeFileSync(dest, Buffer.from(gif.bytes()));
  console.log(`wrote ${out} (${n} frames @ ${fps}fps)`);
};

for (const shot of shots) capture(shot);
fs.rmSync(frameDir, { recursive: true, force: true });
console.log("done");
