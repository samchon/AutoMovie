import {
  AutoMovieContentDigest,
  IAutoMovieLegacyImportInventoryEntry,
  IAutoMovieLegacyImportPlan,
  IAutoMovieLegacyOwnedDirectoryBaseline,
} from "@automovie/interface";
import typia from "typia";

import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";

/** Domain separator of the persisted v1 import plan. */
export const AUTOMOVIE_LEGACY_IMPORT_PROTOCOL = "automovie.legacy-import.v1";

/** A present legacy plan that cannot serve as migration provenance. */
export class AutoMovieLegacyImportPlanError extends Error {
  /** Stable machine-readable diagnostic code. */
  public readonly code = "automovie-legacy-import-plan-invalid" as const;

  public constructor(detail: string) {
    super(`Invalid AutoMovie legacy import plan: ${detail}`);
    this.name = "AutoMovieLegacyImportPlanError";
  }
}

/**
 * Fingerprint every semantic plan member except the fingerprint itself.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Makes legacy provenance identity cover the complete admitted plan.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Uses one deterministic identity owner at apply and reopen.
 */
export const fingerprintAutoMovieLegacyImportPlan = (
  plan: IAutoMovieLegacyImportPlan,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      protocol: AUTOMOVIE_LEGACY_IMPORT_PROTOCOL,
      version: plan.version,
      legacyRevision: plan.legacyRevision,
      inventory: plan.inventory,
      rollbackBaseline: plan.rollbackBaseline,
      productionDraft: plan.productionDraft,
      shotContractDrafts: plan.shotContractDrafts,
      sourceTodos: plan.sourceTodos,
      diagnostics: plan.diagnostics,
    }),
  );

/**
 * Admit the full plan shape, runtime refinements, baseline and fingerprint.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Refuses incompatible or stale present migration provenance instead of projecting one convenient field.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Gives apply and reopen the same semantic compatibility decision.
 */
export const assertAutoMovieLegacyImportPlan = (
  value: unknown,
): IAutoMovieLegacyImportPlan => {
  const validation = typia.validateEquals<IAutoMovieLegacyImportPlan>(value);
  if (validation.success === false)
    throw new AutoMovieLegacyImportPlanError(
      `schema mismatch at ${validation.errors[0]?.path ?? "$input"}`,
    );
  const plan = validation.data;
  if (!Number.isSafeInteger(plan.legacyRevision) || plan.legacyRevision < 0)
    throw new AutoMovieLegacyImportPlanError(
      "legacyRevision must be a non-negative safe integer",
    );
  assertInventory(plan.inventory, "inventory");
  const expected = ["src", "generated", "renders"] as const;
  if (plan.rollbackBaseline.length !== expected.length)
    throw new AutoMovieLegacyImportPlanError(
      "rollbackBaseline must contain src, generated and renders exactly once",
    );
  plan.rollbackBaseline.forEach((baseline, index) =>
    assertBaseline(baseline, expected[index]!),
  );
  if (plan.fingerprint !== fingerprintAutoMovieLegacyImportPlan(plan))
    throw new AutoMovieLegacyImportPlanError("fingerprint is stale");
  return plan;
};

/** Boolean companion for paths whose established API uses a predicate. */
export const isAutoMovieLegacyImportPlan = (
  value: unknown,
): value is IAutoMovieLegacyImportPlan => {
  try {
    assertAutoMovieLegacyImportPlan(value);
    return true;
  } catch {
    return false;
  }
};

const assertBaseline = (
  baseline: IAutoMovieLegacyOwnedDirectoryBaseline,
  expectedPath: IAutoMovieLegacyOwnedDirectoryBaseline["path"],
): void => {
  if (baseline.path !== expectedPath)
    throw new AutoMovieLegacyImportPlanError(
      `rollbackBaseline entry ${expectedPath} is out of canonical order`,
    );
  if (
    !baseline.existed &&
    (baseline.directories.length !== 0 || baseline.files.length !== 0)
  )
    throw new AutoMovieLegacyImportPlanError(
      `absent rollback baseline ${expectedPath} must be empty`,
    );
  assertSortedPaths(
    baseline.directories,
    `${expectedPath} directories`,
    (path) => isBaselinePath(path, expectedPath),
  );
  assertInventory(
    baseline.files,
    `${expectedPath} files`,
    (entry) =>
      entry.kind === "project" && isBaselinePath(entry.path, expectedPath),
  );
  const directories = new Set(baseline.directories);
  if (baseline.files.some((entry) => directories.has(entry.path)))
    throw new AutoMovieLegacyImportPlanError(
      `${expectedPath} baseline cannot describe one path as both file and directory`,
    );
};

const assertInventory = (
  inventory: readonly IAutoMovieLegacyImportInventoryEntry[],
  role: string,
  extra: (entry: IAutoMovieLegacyImportInventoryEntry) => boolean = () => true,
): void => {
  assertSortedPaths(
    inventory.map((entry) => entry.path),
    role,
    (path) => isCanonicalRelativePath(path),
  );
  const folded = new Set<string>();
  for (const entry of inventory) {
    const lower = entry.path.toLowerCase();
    if (
      !Number.isSafeInteger(entry.bytes) ||
      entry.bytes < 0 ||
      (entry.digest === null && entry.bytes !== 0) ||
      (entry.digest === null && entry.kind !== "asset") ||
      (entry.digest !== null && !/^sha256:[0-9a-f]{64}$/.test(entry.digest)) ||
      !extra(entry) ||
      folded.has(lower)
    )
      throw new AutoMovieLegacyImportPlanError(
        `${role} contains an invalid entry for ${JSON.stringify(entry.path)}`,
      );
    folded.add(lower);
  }
};

const assertSortedPaths = (
  paths: readonly string[],
  role: string,
  predicate: (path: string) => boolean,
): void => {
  let previous: string | undefined;
  for (const path of paths) {
    if (
      !predicate(path) ||
      (previous !== undefined && compareCodeUnits(previous, path) >= 0)
    )
      throw new AutoMovieLegacyImportPlanError(
        `${role} must contain canonical, strictly sorted paths`,
      );
    previous = path;
  }
};

const isCanonicalRelativePath = (value: string): boolean =>
  value.length !== 0 &&
  value.includes("\\") === false &&
  !value.startsWith("/") &&
  !/^[A-Za-z]:/.test(value) &&
  value
    .split("/")
    .every(
      (segment) => segment.length !== 0 && segment !== "." && segment !== "..",
    );

const isBaselinePath = (
  value: string,
  root: IAutoMovieLegacyOwnedDirectoryBaseline["path"],
): boolean => value.startsWith(`${root}/`) && isCanonicalRelativePath(value);
