/* eslint-disable */
// Runner for render-sequence-and-see.ts. It bundles the workspace TypeScript
// sequence render seam into one CommonJS module, while leaving browser/encoder
// dependencies as package imports resolved from @automovie/playground.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, ".render-sequence-and-see.cjs");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "render-sequence-and-see.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundlePath,
    external: ["h264-mp4-encoder", "playwright-core", "pngjs"],
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
