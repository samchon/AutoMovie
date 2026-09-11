import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { portraitWebCaptureLabel } from "./logic.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const label = portraitWebCaptureLabel(
  process.argv[2] ?? `capture-${Date.now()}`,
);
const port = Number(process.env.FACE_WEB_PORT ?? 8766);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local viewer port.");
const captureRoot = path.join(root, ".shots/face-web-work");
await fs.mkdir(captureRoot, { recursive: true });
if (path.relative(captureRoot, await fs.realpath(captureRoot)) !== "")
  throw new Error("Capture root must be a real workspace directory.");
const out = path.join(captureRoot, label);
// Exclusive directory creation refuses accidental replacement of an earlier round.
await fs.mkdir(out);
const { chromium } = await import(
  pathToFileURL(path.join(root, "test/node_modules/playwright/index.mjs")).href
);
const browser = await chromium.launch({
  channel: "chromium",
  headless: process.env.FACE_WEB_HEADED !== "1",
});
try {
  const page = await browser.newPage({
    viewport: { width: 1720, height: 1250 },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(300000);
  await page.goto(`http://127.0.0.1:${port}`, {
    waitUntil: "networkidle",
    timeout: 300000,
  });
  await page.evaluate(() => window.faceViewer.ready);
  await page.evaluate(() => window.faceViewer.prepareScreenshot());
  const initial = await page.evaluate(() => window.faceViewer.identity());
  console.log("RENDERER", initial.runtime.renderer);
  if (!initial.runtime.hardware)
    throw new Error(`Hardware GPU required: ${initial.runtime.renderer}`);
  const captures = [];
  async function save(name) {
    portraitWebCaptureLabel(name);
    const identity = await page.evaluate(
      () => window.faceViewer.capture().receipt,
    );
    if (identity.basisSha256 !== initial.basisSha256)
      throw new Error(
        "Artifact changed during capture set; no complete manifest will be written.",
      );
    const filename = `${name}.png`;
    const bytes = await page.locator("canvas").screenshot({
      path: path.join(out, filename),
      animations: "disabled",
      scale: "css",
      timeout: 300000,
    });
    const after = await page.evaluate(
      () => window.faceViewer.capture().receipt,
    );
    if (JSON.stringify(identity) !== JSON.stringify(after))
      throw new Error(
        "Viewer changed during screenshot; this frame has no receipt.",
      );
    if (
      bytes.readUInt32BE(16) !== identity.image.width ||
      bytes.readUInt32BE(20) !== identity.image.height
    )
      throw new Error("Canvas screenshot dimensions disagree with receipt.");
    const receipt = {
      ...identity,
      file: filename,
      pngSha256: createHash("sha256").update(bytes).digest("hex"),
      captureScriptSha256: createHash("sha256")
        .update(await fs.readFile(fileURLToPath(import.meta.url)))
        .digest("hex"),
    };
    await fs.writeFile(
      path.join(out, `${name}.json`),
      JSON.stringify(receipt, null, 2),
    );
    captures.push(receipt);
    console.log("CAPTURED", filename);
  }
  // The independent native cube and RGB axes are captured before every subject set.
  await page.evaluate(() => {
    window.faceViewer.setCalibration(true);
    window.faceViewer.setView("front");
  });
  await save("calibration");
  await page.evaluate(() => window.faceViewer.setCalibration(false));
  const requested = (
    process.argv[3] ?? "front,left-oblique,left-profile,eyes,nose,mouth"
  ).split(",");
  const modes = (process.argv[4] ?? "colour,clay").split(",");
  for (const mode of modes) {
    await page.evaluate((mode) => window.faceViewer.setMode(mode), mode);
    for (const view of requested) {
      await page.evaluate((view) => window.faceViewer.setView(view), view);
      await save(`${view}-${mode}`);
    }
  }
  await fs.writeFile(
    path.join(out, "capture.json"),
    JSON.stringify(
      {
        artifact: initial.artifact,
        captures,
        review: "not automatically supplied",
      },
      null,
      2,
    ),
  );
  console.log("OUTPUT", out);
} finally {
  await browser.close();
}
