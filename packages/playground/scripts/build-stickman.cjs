/* eslint-disable */
// Runner for build-stickman.ts. esbuild bundles the entry (and the workspace
// TS it pulls in: @automovie/render, @automovie/engine, @automovie/interface)
// into one CommonJS module, which resolves the CJS/ESM interop a per-file
// transpiler can't, then runs its `main()`. Emits public/models/stickman.glb.
const esbuild = require("esbuild");
const { randomUUID } = require("crypto");
const path = require("path");

const {
  preserveBundleCleanupFailure,
} = require("./preserveBundleCleanupFailure.cjs");

const bundlePath = path.join(
  __dirname,
  `.stickman-gen-${process.pid}-${randomUUID()}.cjs`,
);

(async () => {
  let failure;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "build-stickman.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bundlePath,
    });
    await require(bundlePath).main();
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveBundleCleanupFailure(bundlePath, failure);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
