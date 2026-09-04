import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedLibrary,
  IAutoMovieMaterializedLibraryOwner,
} from "@automovie/interface";

import {
  compareCodeUnits,
  encodeAutoMoviePathSegment,
} from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";

/**
 * Stable strict library-state refusal categories.
 *
 * @author Samchon
 */
export type AutoMovieLibraryProjectStateProblemCode =
  | "authoring-evidence-required"
  | "generated-file-missing"
  | "generated-shape-mismatch"
  | "library-index-invalid"
  | "library-owner-mismatch";

/**
 * One exact reason a library publication cannot become current state.
 *
 * @author Samchon
 */
export interface IAutoMovieLibraryProjectStateProblem {
  /** Stable machine-readable refusal category. */
  code: AutoMovieLibraryProjectStateProblemCode;
  /** Affected generated path, when one exists. */
  path: string | null;
  /** Actionable refusal explanation. */
  message: string;
}

/**
 * Strict result of reopening one compiler-owned library publication.
 *
 * @author Samchon
 */
export interface IAutoMovieLibraryProjectStateInspection {
  /** Parsed index, or null when no strict index could be opened. */
  index: IAutoMovieMaterializedLibrary | null;
  /** Every strict currentness refusal found. */
  problems: readonly IAutoMovieLibraryProjectStateProblem[];
}

/**
 * Reopen a library index against its manifest and graph-selected owner closure.
 *
 * The permissive observation reader is intentionally not reused here. A
 * current-state gate must distinguish an empty library from an unreadable or
 * contradictory one, and must never infer production kind from residue.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal Refuses a library publication whose shape, owner lineage, or exact artifact closure cannot be authenticated.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Binds current library state to the graph-selected kind and compiler fingerprint.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-fail-closed-decision-gate Opens the library discriminant only after strict index and artifact validation.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Verifies the library publication against its current authoring input identity.
 * @author Samchon
 */
export const inspectAutoMovieLibraryProjectState = (props: {
  production: string;
  compiler: string;
  inputFingerprint: AutoMovieContentDigest;
  authoringEvidence: IAutoMovieProductionEvidence | undefined;
  manifest: IAutoMovieGeneratedManifest;
  readFile: (path: string) => Uint8Array | null;
}): IAutoMovieLibraryProjectStateInspection => {
  const problems: IAutoMovieLibraryProjectStateProblem[] = [];
  const evidence = props.authoringEvidence;
  if (evidence === undefined || evidence.manifest.kind !== "library")
    return {
      index: null,
      problems: [
        {
          code: "authoring-evidence-required",
          path: null,
          message:
            "Current library state requires graph-derived library authoring evidence; generated residue cannot select the production kind.",
        },
      ],
    };
  const manifestPaths = new Set(props.manifest.files.map((file) => file.path));
  const timedResidue = props.manifest.files.find(
    (file) =>
      file.path === "manifests/compile.json" ||
      file.path === "contracts/production.json" ||
      file.path === "contracts/world.json" ||
      file.path.startsWith("shots/") ||
      file.path.startsWith("film/"),
  );
  if (timedResidue !== undefined)
    problems.push({
      code: "generated-shape-mismatch",
      path: timedResidue.path,
      message: `Library publication manifest contains timed-production artifact "${timedResidue.path}". Recompile one declared production shape from a clean generated transaction.`,
    });
  const indexBytes = manifestPaths.has("library/index.json")
    ? props.readFile("library/index.json")
    : null;
  if (indexBytes === null)
    return {
      index: null,
      problems: problems.concat({
        code: "generated-file-missing",
        path: "library/index.json",
        message:
          "Library publication manifest does not own a readable library/index.json.",
      }),
    };
  let index: IAutoMovieMaterializedLibrary;
  try {
    index = parseIndex(indexBytes);
  } catch (error) {
    return {
      index: null,
      problems: problems.concat({
        code: "library-index-invalid",
        path: "library/index.json",
        message: errorMessage(error),
      }),
    };
  }
  if (
    index.production !== props.production ||
    index.compiler !== props.compiler ||
    index.inputFingerprint !== props.inputFingerprint
  )
    problems.push({
      code: "library-index-invalid",
      path: "library/index.json",
      message:
        "Library index production, compiler, or input fingerprint differs from the selected current compile identity.",
    });

  const bindings = new Map(
    (evidence.sourceOwners ?? []).map((binding) => [
      JSON.stringify([
        binding.branch,
        `${binding.targetPath}#${binding.targetAnchor}`,
        binding.sourcePath,
        binding.exportName,
      ]),
      binding,
    ]),
  );
  const artifactOwners = new Map<string, string>();
  const indexedOwners = new Set<string>();
  const publishedOwners = new Set<string>();
  for (const owner of index.owners) {
    const ownerIdentity = `${owner.branch}:${owner.owner}`;
    if (indexedOwners.has(ownerIdentity))
      problems.push({
        code: "library-owner-mismatch",
        path: "library/index.json",
        message: `Library design owner "${ownerIdentity}" appears more than once in the materialized index. One reviewed owner must resolve to one exact source export.`,
      });
    else indexedOwners.add(ownerIdentity);
    const designOwner = evidence.designOwners.find(
      (candidate) =>
        candidate.branch === owner.branch &&
        candidate.units.some(
          (unit) => `${candidate.path}#${unit.anchor}` === owner.owner,
        ),
    );
    const sourceBranch = designOwner?.sourceBinding?.branch ?? null;
    publishedOwners.add(
      JSON.stringify([sourceBranch, owner.owner, owner.source, owner.export]),
    );
    const binding = bindings.get(
      JSON.stringify([sourceBranch, owner.owner, owner.source, owner.export]),
    );
    if (
      binding === undefined ||
      binding.sourceDigest !== owner.sourceDigest ||
      binding.enforced === false ||
      binding.reviewed === false
    )
      problems.push({
        code: "library-owner-mismatch",
        path: "library/index.json",
        message: `Library owner "${ownerIdentity}" does not match one enforced graph-selected source export at the recorded digest.`,
      });
    for (const artifact of ownerArtifactPaths(owner)) {
      const previous = artifactOwners.get(artifact);
      if (previous !== undefined)
        problems.push({
          code: "library-owner-mismatch",
          path: artifact,
          message: `Library artifact "${artifact}" is claimed by both "${previous}" and "${ownerIdentity}".`,
        });
      else artifactOwners.set(artifact, ownerIdentity);
      if (
        manifestPaths.has(artifact) === false ||
        props.readFile(artifact) === null
      )
        problems.push({
          code: "generated-file-missing",
          path: artifact,
          message: `Library owner "${ownerIdentity}" names artifact "${artifact}" that is absent from the authenticated generated manifest or unreadable.`,
        });
    }
  }
  for (const binding of evidence.sourceOwners ?? []) {
    if (binding.enforced === false || binding.reviewed === false) continue;
    const identity = JSON.stringify([
      binding.branch,
      `${binding.targetPath}#${binding.targetAnchor}`,
      binding.sourcePath,
      binding.exportName,
    ]);
    if (publishedOwners.has(identity) === false)
      problems.push({
        code: "library-owner-mismatch",
        path: "library/index.json",
        message: `Reviewed source export "${binding.sourcePath}#${binding.exportName}" has no exact owner entry in the materialized library index.`,
      });
  }
  for (const file of props.manifest.files)
    if (
      file.path !== "library/index.json" &&
      artifactOwners.has(file.path) === false
    )
      problems.push({
        code: "generated-shape-mismatch",
        path: file.path,
        message: `Generated file "${file.path}" is not owned by the selected library index.`,
      });
  return { index: problems.length === 0 ? index : null, problems };
};

const ownerArtifactPaths = (
  owner: IAutoMovieMaterializedLibraryOwner,
): string[] =>
  [
    ...owner.environments.map(
      (id) => `library/environments/${encodeAutoMoviePathSegment(id)}.json`,
    ),
    ...owner.models.map(
      (id) => `models/${encodeAutoMoviePathSegment(id)}.json`,
    ),
    ...(owner.contexts ?? []).map(
      (id) => `library/contexts/${encodeAutoMoviePathSegment(id)}.json`,
    ),
  ].sort(compareCodeUnits);

const parseIndex = (bytes: Uint8Array): IAutoMovieMaterializedLibrary => {
  const value = parseAutoMovieStructuredJson({
    record: "library/index.json",
    bytes,
  });
  if (isRecord(value) === false || value.version !== 1)
    throw new Error("Library index is not a supported version-1 object.");
  assertExactKeys(value, [
    "compiler",
    "inputFingerprint",
    "owners",
    "production",
    "version",
  ]);
  if (
    typeof value.compiler !== "string" ||
    typeof value.production !== "string" ||
    isDigest(value.inputFingerprint) === false ||
    Array.isArray(value.owners) === false
  )
    throw new Error("Library index identity or owners are malformed.");
  const owners = value.owners.map((owner, index) => parseOwner(owner, index));
  const identities = owners.map((owner) =>
    JSON.stringify([owner.branch, owner.owner, owner.source, owner.export]),
  );
  if (new Set(identities).size !== identities.length)
    throw new Error("Library index repeats an owner identity.");
  const sortedOwners = [...owners].sort((left, right) =>
    compareCodeUnits(
      JSON.stringify([left.branch, left.owner, left.source, left.export]),
      JSON.stringify([right.branch, right.owner, right.source, right.export]),
    ),
  );
  if (JSON.stringify(owners) !== JSON.stringify(sortedOwners))
    throw new Error("Library index owners are not in canonical order.");
  return {
    version: 1,
    compiler: value.compiler,
    production: value.production,
    inputFingerprint: value.inputFingerprint,
    owners,
  };
};

const parseOwner = (
  value: unknown,
  index: number,
): IAutoMovieMaterializedLibraryOwner => {
  if (
    isRecord(value) === false ||
    typeof value.branch !== "string" ||
    typeof value.owner !== "string" ||
    typeof value.source !== "string" ||
    typeof value.export !== "string" ||
    isDigest(value.sourceDigest) === false ||
    isStringArray(value.environments) === false ||
    isStringArray(value.models) === false ||
    isStringArray(value.contexts) === false
  )
    throw new Error(`Library index owner ${index} is malformed.`);
  assertExactKeys(value, [
    "branch",
    "contexts",
    "environments",
    "export",
    "models",
    "owner",
    "source",
    "sourceDigest",
  ]);
  return {
    branch: value.branch,
    owner: value.owner,
    source: value.source,
    export: value.export,
    sourceDigest: value.sourceDigest,
    environments: unique(value.environments, index, "environment"),
    models: unique(value.models, index, "model"),
    contexts: unique(value.contexts, index, "context"),
  };
};

const unique = (values: string[], owner: number, kind: string): string[] => {
  if (new Set(values).size !== values.length)
    throw new Error(`Library index owner ${owner} repeats a ${kind} id.`);
  const sorted = [...values].sort(compareCodeUnits);
  if (JSON.stringify(values) !== JSON.stringify(sorted))
    throw new Error(
      `Library index owner ${owner} ${kind} ids are not in canonical order.`,
    );
  return values;
};

const assertExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): void => {
  const actual = Object.keys(value).sort(compareCodeUnits);
  if (
    JSON.stringify(actual) !==
    JSON.stringify([...expected].sort(compareCodeUnits))
  )
    throw new Error(
      `Library index object has unexpected or missing members: ${actual.join(", ") || "<none>"}.`,
    );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const isDigest = (value: unknown): value is AutoMovieContentDigest =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
