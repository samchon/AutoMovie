/* eslint-disable */
// Runner for build-cat.ts. See build-stickman.cjs. esbuild bundles the entry
// (and the workspace TS it pulls in) into one CommonJS module, then runs its
// `main()`. Emits .shots/cat/cat.glb.
const esbuild = require("esbuild");
const { randomUUID } = require("crypto");
const path = require("path");

const {
  preserveBundleCleanupFailure,
} = require("./preserveBundleCleanupFailure.cjs");

const bundlePath = path.join(
  __dirname,
  `.cat-gen-${process.pid}-${randomUUID()}.cjs`,
);

(async () => {
  let failure;
  try {
    await esbuild.build({
      entryPoints: [path.join(__dirname, "build-cat.ts")],
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
