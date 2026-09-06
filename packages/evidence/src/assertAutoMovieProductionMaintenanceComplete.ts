import * as fs from "node:fs";
import path from "node:path";

/**
 * Refuse an interrupted contract/TOC tree before its graph can report success.
 * Any pending entry counts, including malformed files and dangling links;
 * registration-only maintenance does not alter production contract meaning.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Admits only a complete physical contract generation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Refuses pending maintenance before interpreting the potentially displaced contract inventory.
 */
export const assertAutoMovieProductionMaintenanceComplete = (
  root: string,
  stat: (
    file: string,
  ) => Pick<fs.Stats, "isDirectory" | "isSymbolicLink"> = fs.lstatSync,
): void => {
  const state = path.join(root, "automovie");
  for (const file of [
    state,
    path.join(state, "contract-maintenance.pending.json"),
  ]) {
    let entry: ReturnType<typeof stat>;
    try {
      entry = stat(file);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      )
        return;
      throw error;
    }
    if (file === state) {
      if (entry.isSymbolicLink() || !entry.isDirectory())
        throw new Error(
          "Production maintenance state must be an ordinary directory.",
        );
    } else
      throw new Error(
        "Pending contract or TOC maintenance must be recovered before production evidence can be admitted. Preserve automovie/contract-maintenance.pending.json and its archive; rerun the same explicit mutating maintenance command.",
      );
  }
};
