import { exportModelToGLB } from "@automovie/render";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildKnight } from "../src/knight";

/**
 * Generate `knight.glb` from the knight rider AST. Same `exportModelToGLB`
 * round-trip as the other builders (`pnpm build:knight`).
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

if (resolve(process.argv[1] ?? "") === resolve(__filename))
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
