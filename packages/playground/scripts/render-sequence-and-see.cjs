/* eslint-disable */
// Runner for render-sequence-and-see.ts. It bundles the workspace TypeScript
// sequence render seam into one CommonJS module, while leaving browser/encoder
// dependencies as package imports resolved from @automovie/playground.
const esbuild = require("esbuild");
const { randomUUID } = require("crypto");
const path = require("path");

const {
  preserveBundleCleanupFailure,
} = require("./preserveBundleCleanupFailure.cjs");

const bundlePath = path.join(
  __dirname,
  `.render-sequence-and-see-${process.pid}-${randomUUID()}.cjs`,
);

(async () => {
  let failure;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "render-sequence-and-see.ts")],
      bundle: true,
      platform: "node",
      format: "cjs",
      outfile: bundlePath,
      external: ["h264-mp4-encoder", "playwright-core", "pngjs"],
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
