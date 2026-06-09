import { exportModelToGLB } from "@autofilm/render";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

import { buildKnight } from "../src/knight";

/**
 * Generate `knight.glb` from the knight rider AST. Same `exportModelToGLB`
 * round-trip as the other builders. Bundled and run by `build-knight.cjs`
 * (`pnpm build:knight`).
 *
 * @author Samchon
 */
export const main = async (): Promise<void> => {
  const { model } = buildKnight();
  const glb = await exportModelToGLB(model);
  const dir = resolve(__dirname, "../../../.shots/knight");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, "knight.glb");
  writeFileSync(out, glb);
  console.log(`wrote ${out} (${glb.length} bytes)`);
};
