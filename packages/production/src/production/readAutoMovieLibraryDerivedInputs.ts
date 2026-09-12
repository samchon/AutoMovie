import type {
  IAutoMovieAssetProvenance,
  IAutoMovieDerivedArtifactSource,
  IAutoMovieDiagnostic,
} from "@automovie/interface";

import type {
  AutoMovieProductionProject,
  IAutoMovieProductionContentInput,
} from "./AutoMovieProductionProject";
import type { IAutoMovieFingerprintField } from "./contentIdentity";
import { inspectAutoMovieDerivedArtifacts } from "./derivedArtifacts";
import { productionAssetInventory } from "./productionAssetInventory";
import { errorMessage } from "./productionBuildDiagnostics";
import { contentFingerprintFields } from "./productionBuildIdentity";

/**
 * Read the content closure one library compile executes against and hashes.
 *
 * A library's input identity ends with its declared content inventory and the
 * verified derivation closure, and its execution receives the admitted derived
 * artifacts from the same read. A compile and a later currentness check that both
 * read the closure through this one function cannot drift apart on the fields a
 * result was bound to, which is why the source snapshot reads it here.
 *
 * An unreadable inventory is not an exception. It becomes the
 * `content:inventory` unsafe field and a `content-input-unsafe` diagnostic, and
 * the derivation closure is still inspected, so the failure reaches both the
 * identity and the author. A disabled read, which the design scope asks for,
 * touches nothing.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Supplies the content inventory and derived bytes a library result is bound to and a later check compares.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Admits declared content, adopted asset and verified derived bytes as library derivation inputs through one read.
 */
export const readAutoMovieLibraryDerivedInputs = (props: {
  /** Project handle the library compiles in. */
  project: AutoMovieProductionProject;

  /** Whether the requested scope reads content at all. */
  enabled: boolean;
}): {
  /** Derived artifacts admitted to library execution. */
  artifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;

  /** Content inventory and derivation closure fields in read order. */
  fields: IAutoMovieFingerprintField[];

  /** Inventory, asset ledger and derivation refusals. */
  diagnostics: IAutoMovieDiagnostic[];

  /** Adopted asset records the ledger declares. */
  assets: IAutoMovieAssetProvenance[];

  /** Declared content inputs, empty when the inventory was unreadable. */
  content: IAutoMovieProductionContentInput[];
} => {
  const fields: IAutoMovieFingerprintField[] = [];
  const diagnostics: IAutoMovieDiagnostic[] = [];
  let assets: IAutoMovieAssetProvenance[] = [];
  let content: IAutoMovieProductionContentInput[] = [];
  if (props.enabled === false)
    return { artifacts: {}, fields, diagnostics, assets, content };
  const project = props.project;
  const manifest = project.manifest();
  let externalAssetPaths: string[] = [];
  try {
    content = project.contentInputs();
    fields.push(...contentFingerprintFields(content));
    const inventory = productionAssetInventory(
      manifest.assetManifest,
      content,
      project.productionId,
      project.graph(),
      project.archetypes,
    );
    assets = inventory.records;
    externalAssetPaths = assets.map((asset) => asset.path);
    diagnostics.push(...inventory.diagnostics);
  } catch (error) {
    fields.push({
      role: "content:inventory",
      kind: "unsafe",
      payload: new Uint8Array(),
    });
    diagnostics.push({
      code: "content-input-unsafe",
      category: "error",
      phase: "source",
      target: "declared-content",
      path: null,
      message: errorMessage(error),
    });
  }
  const inspection = inspectAutoMovieDerivedArtifacts({
    root: project.root,
    manifestPath: manifest.derivedArtifactManifest,
    externalAssetPaths,
  });
  fields.push(...inspection.fingerprintFields);
  diagnostics.push(
    ...inspection.problems.map(
      (problem): IAutoMovieDiagnostic => ({
        code: problem.code,
        category: "error",
        phase: "project",
        target: problem.target,
        path: problem.path,
        message: problem.message,
      }),
    ),
  );
  return {
    artifacts: inspection.artifacts,
    fields,
    diagnostics,
    assets,
    content,
  };
};
