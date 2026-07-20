/* eslint-disable */
// Runner for build-knight.ts. See build-stickman.cjs. Emits .shots/knight/knight.glb.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, ".knight-gen.cjs");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "build-knight.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundlePath,
  });
  try {
    await require(bundlePath).main();
  } finally {
    fs.rmSync(bundlePath, { force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
