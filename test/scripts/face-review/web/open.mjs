import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const { chromium } = await import(
  pathToFileURL(path.join(root, "test/node_modules/playwright/index.mjs")).href
);
const port = Number(process.env.FACE_WEB_PORT ?? 8766);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local viewer port.");
const debugPort = Number(process.env.FACE_WEB_CDP_PORT ?? 9226);
if (!Number.isInteger(debugPort) || debugPort < 1024 || debugPort > 65535)
  throw new Error("Invalid local browser debugging port.");
const browser = await chromium.launch({
  channel: "chromium",
  headless: false,
  args: [
    `--remote-debugging-port=${debugPort}`,
    "--remote-debugging-address=127.0.0.1",
  ],
});
console.log("BROWSER_CDP", `http://127.0.0.1:${debugPort}`);
const page = await browser.newPage({
  viewport: { width: 1680, height: 1100 },
  deviceScaleFactor: 1,
});
await page.goto(`http://127.0.0.1:${port}`, { timeout: 300000 });
await page.evaluate(() => window.faceViewer.ready);
console.log(
  "RENDERER",
  await page.evaluate(() => window.faceViewer.identity().runtime.renderer),
);
await new Promise((resolve) => browser.on("disconnected", resolve));
