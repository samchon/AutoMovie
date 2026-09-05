import { IAutoMovieProductionRegistryManifest } from "@automovie/interface";
import typia from "typia";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { digestAutoMovieBytes } from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";

/**
 * Read and authenticate the current compiler-owned evidence target registry.
 */
export const readAutoMovieProductionRegistry = (
  project: AutoMovieProductionProject,
): IAutoMovieProductionRegistryManifest => {
  const generated = project.generatedManifest();
  if (generated === null)
    throw new Error(
      "Evidence requires a current compiler registry. Run the scaffold compile command first.",
    );
  const entry = generated.files.find(
    (file) => file.path === "manifests/compile.json",
  );
  if (entry === undefined)
    throw new Error(
      "Current generated ownership has no evidence target registry. Recompile with the installed AutoMovie package.",
    );
  const bytes = project.readGeneratedFile("manifests/compile.json");
  if (digestAutoMovieBytes(bytes) !== entry.digest)
    throw new Error(
      "Compiler target registry bytes differ from generated ownership. Recompile before producing evidence.",
    );
  const validation = typia.validateEquals<IAutoMovieProductionRegistryManifest>(
    parseAutoMovieStructuredJson({ record: "target-registry", bytes }),
  );
  if (
    validation.success === false ||
    validation.data.productionId !== project.productionId ||
    validation.data.inputFingerprint !== generated.inputFingerprint
  )
    throw new Error(
      "Compiler target registry is malformed or stale for the active production. Recompile before producing evidence.",
    );
  return validation.data;
};
