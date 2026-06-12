import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const shotsDir = path.join(root, ".shots");
const outDir = path.join(shotsDir, "head");
const BASE = process.env.BASE ?? "http://localhost:5173";
const CHROME =
  process.env.CHROME ??
  {
    win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    linux: "google-chrome",
  }[process.platform];

const views = [
  "front",
  "frontClose",
  "rightThreeQuarter",
  "rightThreeQuarterClose",
  "rightProfile",
  "rightProfileClose",
  "backRightThreeQuarter",
  "back",
  "backLeftThreeQuarter",
  "leftThreeQuarter",
  "leftThreeQuarterClose",
  "leftProfile",
  "leftProfileClose",
  "eyeClose",
  "top",
  "bottom",
];

const modes = [
  {
    name: "model",
    overlay: 0,
    screenshot: async (page) => page.locator("#view").screenshot({ type: "png" }),
  },
  {
    name: "overlay",
    overlay: 0.42,
    screenshot: async (page) => page.locator("#viewport").screenshot({ type: "png" }),
  },
];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});

const cleanDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
};

cleanDir(outDir);

const page = await browser.newPage({
  viewport: { width: 1280, height: 960 },
  deviceScaleFactor: 1,
});

await page.goto(`${BASE}/head.html`, { waitUntil: "load" });
await page.waitForFunction(() => window.__faceEditor?.setView && window.__faceEditor?.setOverlay);
await page.addStyleTag({
  content: `
    #panel, #strip, #hud { display: none !important; }
    #stage { grid-template-columns: 1fr !important; }
    #workbench { grid-template-rows: 1fr !important; }
  `,
});

const settle = async () => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};

await page.evaluate(() => window.__faceEditor.setPreset("neutral"));
await settle();

for (const mode of modes) {
  const modeDir = path.join(outDir, mode.name);
  cleanDir(modeDir);

  for (const view of views) {
    await page.evaluate(
      ([nextView, overlay]) => {
        window.__faceEditor.setOverlay(overlay);
        window.__faceEditor.setView(nextView);
      },
      [view, mode.overlay],
    );
    await settle();
    const buf = await mode.screenshot(page);
    fs.writeFileSync(path.join(modeDir, `${view}.png`), buf);
  }
}

await page.evaluate(() => {
  window.__faceEditor.setOverlay(0);
  window.__faceEditor.setView("front");
});
await settle();
fs.writeFileSync(path.join(shotsDir, "head-latest.png"), await page.locator("#view").screenshot({ type: "png" }));

await page.close();
await browser.close();
console.log(`wrote ${path.relative(root, outDir)} and ${path.relative(root, path.join(shotsDir, "head-latest.png"))}`);
