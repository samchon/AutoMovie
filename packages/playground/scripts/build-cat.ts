import { exportModelToGLB } from "@automovie/render";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { DEFAULT_CAT, buildCat } from "../src/cat";

/**
 * Generate `cat.glb` from the stick-cat AST — the quadruped counterpart to
 * {@link build-stickman}. Same `exportModelToGLB` round-trip: the very model the
 * viewer renders, serialized to a standalone binary glTF at rest. Re-run (`pnpm
 * build:cat`) after changing the cat's proportions. Bundled and run by
 * `build-cat.cjs`.
 *
 * @author Samchon
 */
export const main = async (): Promise<void> => {
  const { model } = buildCat(DEFAULT_CAT);
  const glb = await exportModelToGLB(model);
  // Derived artifact (the viewer renders from the AST) — regenerable scratch.
  const dir = resolve(__dirname, "../../../.shots/cat");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "cat.glb");
  writeFileSync(out, glb);
  console.log(`wrote ${out} (${glb.length} bytes)`);
};
