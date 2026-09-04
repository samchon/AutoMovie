import {
  type IAutoMovieContractBaseline,
  applyAutoMovieContractMigrationPlan,
  createAutoMovieContractBaseline,
  isAutoMovieContractTargetPath,
  parseAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieContractMigrationPublication,
  planAutoMovieDeliveryToc,
} from "@automovie/evidence";

/**
 * Project-relative location of the installed scaffold contract generation.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Makes the baseline discoverable without inspecting authored contract prose.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Names the portable receipt consumed by compatibility planning.
 */
export const AUTO_MOVIE_CONTRACT_BASELINE_PATH =
  "automovie/contracts-baseline.json";

/**
 * Select the exact scaffold-owned contract bytes from rendered project files.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Supplies the complete target inventory used by migration validation.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Separates scaffold contracts from authored project documents.
 */
export const autoMovieContractTargetSources = (
  files: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(files).filter(([path]) =>
      isAutoMovieContractTargetPath(path),
    ),
  );

/**
 * Render the portable baseline receipt installed in every new project.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Preserves the immutable source generation used by a future migration.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Serializes the exact path, anchor, and digest inventory beside the project.
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
 * @evidence requirements/story/delivery-index.md#story-delivery-index Keeps both delivery indexes linked to their authoritative unit files.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Applies one canonical renderer across every delivery group.
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
  const deliveryMembers = new Map<"scripts" | "screenplays", Set<string>>();
  for (const layer of ["scripts", "screenplays"] as const) {
    const prefix = `docs/${layer}/`;
    const groups = new Set<string>();
    const validMembers = new Set<string>();
    const residents = Object.keys(props.files)
      .filter((path) => path.startsWith(prefix) && path.endsWith(".md"))
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    for (const resident of residents) {
      const parts = resident.slice(prefix.length).split("/");
      if (
        parts.length !== 2 ||
        !/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(parts[0]!) ||
        (parts[1] !== "index.md" &&
          !/^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(parts[1]!))
      ) {
        diagnostics.push(`${resident} is not a valid delivery index member.`);
        continue;
      }
      groups.add(parts[0]!);
      validMembers.add(resident.slice(prefix.length));
    }
    deliveryMembers.set(layer, validMembers);
    for (const group of [...groups].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    )) {
      const indexPath = `${prefix}${group}/index.md`;
      const indexSource = props.files[indexPath];
      if (indexSource === undefined) {
        diagnostics.push(`${indexPath} is missing for its delivery group.`);
        continue;
      }
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
      if (units.length === 0) {
        diagnostics.push(`${indexPath} has no numbered delivery unit.`);
        continue;
      }
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
  const scripts = deliveryMembers.get("scripts")!;
  const screenplays = deliveryMembers.get("screenplays")!;
  if (scripts.size !== 0 && screenplays.size !== 0)
    for (const relative of [...new Set([...scripts, ...screenplays])].sort(
      (left, right) => (left < right ? -1 : left > right ? 1 : 0),
    ))
      if (scripts.has(relative) !== screenplays.has(relative))
        diagnostics.push(
          `Delivery inventory differs between scripts and screenplays at ${relative}.`,
        );
  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    files: Object.freeze(output),
  });
};

/**
 * Select only stale delivery indexes after proving the observation used for
 * generation has not changed before publication.
 *
 * @evidence requirements/story/delivery-index.md#story-delivery-index Refuses to overwrite a delivery index edited after its canonical rendering was planned.
 * @evidence specifications/narrative-and-intent/delivery-index.md#narrative-intent-delivery-index Produces one complete current index candidate for parent-bound publication.
 */
export const planAutoMovieDeliveryTocPublication = (props: {
  current: Readonly<Record<string, string>>;
  observed: Readonly<Record<string, string>>;
  planned: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> => {
  const writes = Object.create(null) as Record<string, string>;
  for (const [relative, source] of Object.entries(props.planned)) {
    if (source === props.current[relative]) continue;
    if (
      !/^docs\/(?:scripts|screenplays)\/\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/index\.md$/u.test(
        relative,
      )
    )
      throw new Error(`Delivery TOC planned an invalid target: ${relative}.`);
    if (props.observed[relative] !== props.current[relative])
      throw new Error(`Delivery index changed after planning: ${relative}.`);
    writes[relative] = source;
  }
  return Object.freeze(writes);
};

export {
  applyAutoMovieContractMigrationPlan,
  type IAutoMovieContractBaseline,
  parseAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieContractMigrationPublication,
};
