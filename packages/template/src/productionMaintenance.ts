import {
  type IAutoMovieContractBaseline,
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieDeliveryToc,
} from "@automovie/evidence";

/**
 * Project-relative location of the installed scaffold contract generation.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Makes the baseline discoverable without inspecting authored contract prose.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Names the portable receipt consumed by compatibility planning.
 */
export const AUTO_MOVIE_CONTRACT_BASELINE_PATH =
  "automovie/contracts-baseline.json";

const CONTRACT_PREFIXES = [
  "docs/discovery/",
  "docs/obligations/",
  "docs/principles/",
  "docs/upstream/",
];

/**
 * Select the exact scaffold-owned contract bytes from rendered project files.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Supplies the complete target inventory used by migration validation.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-migration-validation Separates scaffold contracts from authored project documents.
 */
export const autoMovieContractTargetSources = (
  files: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(files).filter(([path]) =>
      CONTRACT_PREFIXES.some((prefix) => path.startsWith(prefix)),
    ),
  );

/**
 * Render the portable baseline receipt installed in every new project.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration Preserves the immutable source generation used by a future migration.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-nondestructive-migration Serializes the exact path, anchor, and digest inventory beside the project.
 */
export const renderAutoMovieContractBaseline = (props: {
  files: Readonly<Record<string, string>>;
  language: IAutoMovieContractBaseline["language"];
  version: string;
}): string =>
  `${JSON.stringify(
    createAutoMovieContractBaseline({
      files: autoMovieContractTargetSources(props.files),
      language: props.language,
      version: props.version,
    }),
    null,
    2,
  )}\n`;

/**
 * Plan every delivery index in scripts and screenplays from numbered units.
 *
 * @evidence requirements/story/scenes-and-observable-action.md#story-screenplay-index-prose Keeps both delivery indexes linked to their authoritative unit files.
 * @evidence specifications/narrative-and-intent/story-authority-and-hierarchy.md#narrative-intent-scene-prose-index Applies one canonical renderer across every delivery group.
 */
export const planAutoMovieProjectDeliveryTocs = (props: {
  check?: boolean;
  files: Readonly<Record<string, string>>;
}): {
  diagnostics: readonly string[];
  files: Readonly<Record<string, string>>;
} => {
  const output = { ...props.files };
  const diagnostics: string[] = [];
  for (const layer of ["scripts", "screenplays"] as const) {
    const prefix = `docs/${layer}/`;
    const groups = new Set(
      Object.keys(props.files)
        .filter((path) => path.startsWith(prefix) && path.endsWith(".md"))
        .map((path) => path.slice(prefix.length).split("/")[0]!)
        .filter((group) => group.length !== 0),
    );
    for (const group of [...groups].sort()) {
      const indexPath = `${prefix}${group}/index.md`;
      const indexSource = props.files[indexPath];
      if (indexSource === undefined) continue;
      const unitPrefix = `${prefix}${group}/`;
      const units = Object.entries(props.files)
        .filter(
          ([path]) =>
            path.startsWith(unitPrefix) &&
            path !== indexPath &&
            /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(
              path.slice(unitPrefix.length),
            ),
        )
        .map(([path, source]) => ({
          path: path.slice(unitPrefix.length),
          source,
        }));
      const plan = planAutoMovieDeliveryToc({
        check: props.check,
        indexPath,
        indexSource,
        units,
      });
      output[indexPath] = plan.source;
      diagnostics.push(...plan.diagnostics);
    }
  }
  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    files: Object.freeze(output),
  });
};

export {
  applyAutoMovieContractMigrationPlan,
  type IAutoMovieContractBaseline,
  planAutoMovieContractMigration,
};
