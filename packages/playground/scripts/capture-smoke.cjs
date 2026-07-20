/* eslint-disable */
// Runner for capture-smoke.ts, the real (non-faked) headless-capture smoke
// (#1170). Bundles the workspace TypeScript, leaving browser/codec deps as
// package imports resolved from @automovie/playground.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, ".capture-smoke.cjs");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "capture-smoke.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundlePath,
    external: ["playwright-core", "pngjs", "three", "vite"],
  });
  try {
    await require(bundlePath).main();
  } finally {
    fs.rmSync(bundlePath, { force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
