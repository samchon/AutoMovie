import type { IAutoMovieLibraryContribution } from "@automovie/interface";

const SUPPORTED_LIBRARY_RESULTS = {
  maps: "contexts",
  models: "models",
  spaces: "environments",
} as const;

const LIBRARY_BRANCHES = [
  "maps",
  "models",
  "spaces",
  "materials",
  "instances",
  "motions",
  "systems",
] as const;

/**
 * Validate one library result against the active semantic owner branch.
 *
 * The current library protocol has exactly three result carriers: adopted
 * worlds, reusable models, and built environments. Their map, model, and space
 * owners must return a nonempty payload only in the carrier that branch owns.
 * Material, instance, motion, and system source branches remain legitimate
 * authoring populations, but no standalone library-result carrier exists for
 * them yet, so compilation refuses their result explicitly instead of
 * promoting a structurally convenient nested record as completion.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Prevents an empty, cross-branch, or unsupported source result from being recorded as its reviewed owner's completed artifact.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Enforces the branch-specific result carrier before derived library state is materialized and keeps unsupported capability explicit.
 * @author Samchon
 */
export const autoMovieLibraryContributionDiagnostics = (
  branch: string,
  contribution: IAutoMovieLibraryContribution,
): string[] => {
  const recognized = LIBRARY_BRANCHES.find((candidate) => candidate === branch);
  if (recognized === undefined)
    return [
      `Library source branch "${branch}" is not a recognized design owner.`,
    ];
  const expected =
    recognized === "maps"
      ? SUPPORTED_LIBRARY_RESULTS.maps
      : recognized === "models"
        ? SUPPORTED_LIBRARY_RESULTS.models
        : recognized === "spaces"
          ? SUPPORTED_LIBRARY_RESULTS.spaces
          : undefined;
  if (expected === undefined)
    return [
      `Library source branch "${branch}" has no supported standalone result carrier. Keep its reviewed source in authoring until the compiler exposes that semantic result instead of nesting it inside another owner's environment or model.`,
    ];
  const populations = {
    contexts: contribution.contexts ?? [],
    environments: contribution.environments,
    models: contribution.models,
  };
  const diagnostics: string[] = [];
  if (populations[expected].length === 0)
    diagnostics.push(
      `Library source branch "${branch}" returned no ${expected}. A completed owner must publish at least one result in its branch carrier.`,
    );
  for (const [name, population] of Object.entries(populations))
    if (name !== expected && population.length !== 0)
      diagnostics.push(
        `Library source branch "${branch}" returned ${population.length} ${name}, but that payload belongs to the ${name === "contexts" ? "maps" : name === "environments" ? "spaces" : "models"} branch rather than this owner.`,
      );
  return diagnostics;
};
