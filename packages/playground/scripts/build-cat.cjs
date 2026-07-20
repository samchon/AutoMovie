/* eslint-disable */
// Runner for build-cat.ts. See build-stickman.cjs. esbuild bundles the entry
// (and the workspace TS it pulls in) into one CommonJS module, then runs its
// `main()`. Emits .shots/cat/cat.glb.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const bundlePath = path.join(__dirname, ".cat-gen.cjs");

(async () => {
  await esbuild.build({
    entryPoints: [path.join(__dirname, "build-cat.ts")],
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
