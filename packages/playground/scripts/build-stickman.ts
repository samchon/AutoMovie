import { exportModelToGLB } from "@automovie/render";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { DEFAULT_STICKMAN, buildStickman } from "../src/stickman";

/**
 * Generate the committed `stickman.glb` from the stick-figure AST.
 *
 * The canonical demonstration of `@automovie/render`'s `exportModelToGLB`
 * round-trip: the same `IAutoMovieModel` the viewer renders is serialized to a
 * standalone binary glTF (rest / T-pose) any glTF tool, or automovie's own
 * ingest, can load. Re-run (`pnpm build:stickman`) after changing the figure's
 * proportions. Bundled and run by `build-stickman.cjs`.
 *
 * @author Samchon
 */
export const main = async (): Promise<void> => {
  const { model } = buildStickman(DEFAULT_STICKMAN);
  const glb = await exportModelToGLB(model);
  // The glb is a derived artifact: the viewer renders from the AST, so this is
  // regenerable scratch (like the screenshots), not committed source.
  const dir = resolve(__dirname, "../../../.shots/human");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "stickman.glb");
  writeFileSync(out, glb);
  console.log(`wrote ${out} (${glb.length} bytes)`);
};
