/* eslint-disable */
// Runner for build-stickman.ts. esbuild bundles the entry (and the workspace
// TS it pulls in — @automovie/render, @automovie/engine, @automovie/interface)
// into one CommonJS module, which resolves the CJS/ESM interop a per-file
// transpiler can't, then runs its `main()`. Emits public/models/stickman.glb.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, ".stickman-gen.cjs");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "build-stickman.ts")],
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
