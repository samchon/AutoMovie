// Capture the MakeHuman head viewer (mhhead.html) at standard angles.
// Usage: MODEL=base node mh_capture.mjs   (BASE env overrides server URL)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const MODEL = process.env.MODEL ?? "base";
const BASE = process.env.BASE ?? "http://127.0.0.1:5173";
const outDir = path.join(root, ".shots", "mh-render", MODEL);
const CHROME = process.env.CHROME ?? {
  win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "google-chrome",
}[process.platform];

const views = ["front", "frontClose", "leftThreeQuarter", "rightThreeQuarter",
  "leftProfile", "rightProfile", "eyeClose", "top", "bottom", "back"];

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto(`${BASE}/mhhead.html?model=${MODEL}`, { waitUntil: "load" });
await page.waitForFunction(() => window.__mhReady === true, { timeout: 20000 }).catch(() => {});
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

for (const v of views) {
  await page.evaluate((name) => window.setView(name), v);
  await settle();
  fs.writeFileSync(path.join(outDir, `${v}.png`), await page.locator("#view").screenshot({ type: "png" }));
}
await browser.close();
console.log(`wrote ${path.relative(root, outDir)} (${views.length} views)` + (errs.length ? `  ERRORS: ${errs.slice(0, 3).join(" | ")}` : ""));
