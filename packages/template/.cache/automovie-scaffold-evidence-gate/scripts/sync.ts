import { writeAutoMovieProductionInstructions } from "@automovie/template";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { productionEvidence } from "../productionEvidence";

/**
 * Replace this project's generated instruction surface from its installed template.
 *
 * Scenarios:
 *
 * 1. The current tracked evidence declaration produces a shape-aware router
 *    and a complete fresh copy of the installed production skill.
 * 2. A stale or locally edited generated instruction is overwritten while
 *    tracked production documents and source remain untouched.
 */
export const synchronizeProductionInstructions = (props?: {
  root?: string;
  scaffoldRoot?: string;
}): string[] =>
  writeAutoMovieProductionInstructions({
    root: props?.root ?? process.cwd(),
    productionEvidence,
    scaffoldRoot: props?.scaffoldRoot,
  });

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const written = synchronizeProductionInstructions();
  process.stdout.write(
    `Synchronized ${written.length} generated instruction path(s).\n`,
  );
}
