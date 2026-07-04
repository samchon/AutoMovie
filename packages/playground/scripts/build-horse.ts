import { exportModelToGLB } from "@automovie/render";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { DEFAULT_HORSE, buildHorse } from "../src/horse";

/**
 * Generate `horse.glb` from the stick-horse AST (the mount). Same
 * `exportModelToGLB` round-trip as the other builders. Bundled and run by
 * `build-horse.cjs` (`pnpm build:horse`).
 *
 * @author Samchon
 */
export const main = async (): Promise<void> => {
  const { model } = buildHorse(DEFAULT_HORSE);
  const glb = await exportModelToGLB(model);
  const dir = resolve(__dirname, "../../../.shots/knight");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "horse.glb");
  writeFileSync(out, glb);
  console.log(`wrote ${out} (${glb.length} bytes)`);
};
