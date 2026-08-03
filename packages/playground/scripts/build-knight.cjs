/* eslint-disable */
// Runner for build-knight.ts. See build-stickman.cjs. Emits .shots/knight/knight.glb.
const esbuild = require("esbuild");
const { randomUUID } = require("crypto");
const path = require("path");

const {
  preserveBundleCleanupFailure,
} = require("./preserveBundleCleanupFailure.cjs");

const bundlePath = path.join(
  __dirname,
  `.knight-gen-${process.pid}-${randomUUID()}.cjs`,
);

(async () => {
  let failure;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "build-knight.ts")],
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
