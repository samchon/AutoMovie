/* eslint-disable */
// Runner for capture-smoke.ts, the real (non-faked) headless-capture smoke
// (#1170). Bundles the workspace TypeScript, leaving browser/codec deps as
// package imports resolved from @automovie/playground.
const esbuild = require("esbuild");
const { randomUUID } = require("crypto");
const path = require("path");

const {
  preserveBundleCleanupFailure,
} = require("./preserveBundleCleanupFailure.cjs");

const bundlePath = path.join(
  __dirname,
  `.capture-smoke-${process.pid}-${randomUUID()}.cjs`,
);

(async () => {
  let failure;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "capture-smoke.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bundlePath,
      external: ["playwright-core", "pngjs", "three", "vite"],
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
