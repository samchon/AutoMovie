import { createHash } from "node:crypto";

/**
 * One immutable shared-contract file identity recorded by a generated project.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Retains the exact path, digest, and anchor inventory a later migration validates.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-migration-validation Types one baseline member compared before migration completion.
 */
export interface IAutoMovieContractBaselineFile {
  /** Stable H2 identities present in the recorded bytes. */
  anchors: readonly string[];
  /** Project-relative scaffold contract path. */
  path: string;
  /** SHA-256 identity of the recorded UTF-8 bytes. */
  sha256: string;
}

/**
 * The scaffold contract generation an existing project last adopted.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-resume-compatibility-classification Makes the adopted scaffold generation explicit instead of guessing from current files.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-resume-compatibility Supplies the immutable baseline side of compatibility classification.
 */
export interface IAutoMovieContractBaseline {
  /** Exact shared-contract inventory in code-unit path order. */
  files: readonly IAutoMovieContractBaselineFile[];
  /** Creation-selected production contract language. */
  language: "chinese" | "english" | "japanese" | "korean";
  /** Portable record protocol. */
  protocol: "automovie.contract-baseline.v1";
  /** Installed scaffold contract generation. */
  version: string;
}

/**
 * One exact byte mutation admitted by a migration plan.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration Restricts automatic work to explicit add, remove, rename, or write decisions.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-nondestructive-migration Carries the before identity and target bytes needed by apply.
 */
export type AutoMovieContractMigrationAction =
  | { action: "add"; after: string; path: string }
  | { action: "remove"; beforeSha256: string; path: string }
  | {
      action: "rename";
      beforeSha256: string;
      from: string;
      path: string;
    }
  | {
      action: "write";
      after: string;
      beforeSha256: string;
      path: string;
    };

/**
 * One migration condition that requires explicit author adjudication.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Keeps partial or ambiguous work out of a successful result.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-migration-validation Names the exact unresolved class and affected path.
 */
export interface IAutoMovieContractMigrationConflict {
  kind:
    | "local-modification"
    | "missing-source"
    | "removed-anchor"
    | "removed-contract"
    | "rename-ambiguity"
    | "target-collision";
  path: string;
  reason: string;
}

/**
 * One closed migration decision reused by dry-run and apply.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration Prevents apply from silently recomputing a different migration.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-nondestructive-migration Carries both explicit actions and unresolved conflicts between generations.
 */
export interface IAutoMovieContractMigrationPlan {
  actions: readonly AutoMovieContractMigrationAction[];
  conflicts: readonly IAutoMovieContractMigrationConflict[];
  fromVersion: string;
  protocol: "automovie.contract-migration-plan.v1";
  toVersion: string;
}

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const digest = (source: string): string =>
  `sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`;

const anchors = (source: string): string[] =>
  [...source.matchAll(/^##(?!#)\s+\S.*?\{#([^{}\s]+)\}\s*$/gmu)].map(
    (match) => match[1]!,
  );

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    for (const member of Object.values(value as Record<string, unknown>))
      freeze(member);
    Object.freeze(value);
  }
  return value;
};

const baselineMap = (
  baseline: IAutoMovieContractBaseline,
): Map<string, IAutoMovieContractBaselineFile> => {
  if (baseline.protocol !== "automovie.contract-baseline.v1")
    throw new Error("Unsupported AutoMovie contract baseline protocol.");
  const map = new Map<string, IAutoMovieContractBaselineFile>();
  for (const file of baseline.files) {
    if (map.has(file.path))
      throw new Error(
        `Contract baseline repeats ${JSON.stringify(file.path)}.`,
      );
    map.set(file.path, file);
  }
  return map;
};

/**
 * Build the portable baseline receipt from exact target bytes.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Records the complete source inventory migration will later compare.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-migration-validation Derives stable path, anchor, and digest identities from current target bytes.
 */
export const createAutoMovieContractBaseline = (props: {
  files: Readonly<Record<string, string>>;
  language: IAutoMovieContractBaseline["language"];
  version: string;
}): IAutoMovieContractBaseline =>
  freeze({
    files: Object.keys(props.files)
      .sort(compare)
      .map((path) => ({
        anchors: anchors(props.files[path]!),
        path,
        sha256: digest(props.files[path]!),
      })),
    language: props.language,
    protocol: "automovie.contract-baseline.v1" as const,
    version: props.version,
  });

/**
 * Compare immutable from/to inventories with current project bytes.
 *
 * Exact baseline bytes may be replaced. Authored divergence, anchor removal,
 * ambiguous rename identity, and occupied targets remain explicit conflicts.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration Preserves authored divergence instead of overwriting it during scaffold contract migration.
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-migration-validation Reports every unresolved contract identity before mutation.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-nondestructive-migration Produces one immutable source-to-target plan consumed by dry-run and apply.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-migration-validation Binds each action to the exact source digest and target bytes.
 */
export const planAutoMovieContractMigration = (props: {
  current: Readonly<Record<string, string>>;
  from: IAutoMovieContractBaseline;
  targetSources: Readonly<Record<string, string>>;
  to: IAutoMovieContractBaseline;
}): IAutoMovieContractMigrationPlan => {
  const from = baselineMap(props.from);
  const to = baselineMap(props.to);
  for (const target of to.values())
    if (digest(props.targetSources[target.path] ?? "") !== target.sha256)
      throw new Error(
        `Target source does not match baseline for ${target.path}.`,
      );

  const actions: AutoMovieContractMigrationAction[] = [];
  const conflicts: IAutoMovieContractMigrationConflict[] = [];
  const removed = [...from.values()].filter((file) => !to.has(file.path));
  const added = [...to.values()].filter((file) => !from.has(file.path));
  const renamedFrom = new Set<string>();
  const renamedTo = new Set<string>();
  for (const source of removed) {
    const candidates = added.filter(
      (target) => target.sha256 === source.sha256,
    );
    const reverse = candidates[0]
      ? removed.filter(
          (candidate) => candidate.sha256 === candidates[0]!.sha256,
        )
      : [];
    if (candidates.length > 1 || reverse.length > 1) {
      conflicts.push({
        kind: "rename-ambiguity",
        path: source.path,
        reason: `Contract ${source.path} has ${candidates.length} target paths with the same identity.`,
      });
      renamedFrom.add(source.path);
      for (const target of candidates) renamedTo.add(target.path);
      continue;
    }
    const target = candidates[0];
    if (target === undefined) continue;
    renamedFrom.add(source.path);
    renamedTo.add(target.path);
    const current = props.current[source.path];
    const occupied = props.current[target.path];
    if (current === undefined) {
      if (occupied === undefined || digest(occupied) !== target.sha256)
        conflicts.push({
          kind: "missing-source",
          path: source.path,
          reason: `Rename source ${source.path} is missing.`,
        });
    } else if (digest(current) !== source.sha256)
      conflicts.push({
        kind: "local-modification",
        path: source.path,
        reason: `Rename source ${source.path} differs from its recorded baseline.`,
      });
    else if (occupied !== undefined)
      conflicts.push({
        kind: "target-collision",
        path: target.path,
        reason: `Rename target ${target.path} already exists.`,
      });
    else
      actions.push({
        action: "rename",
        beforeSha256: source.sha256,
        from: source.path,
        path: target.path,
      });
  }

  for (const path of [...new Set([...from.keys(), ...to.keys()])].sort(
    compare,
  )) {
    if (renamedFrom.has(path) || renamedTo.has(path)) continue;
    const source = from.get(path);
    const target = to.get(path);
    const current = props.current[path];
    if (source === undefined && target !== undefined) {
      if (current === undefined)
        actions.push({
          action: "add",
          after: props.targetSources[path]!,
          path,
        });
      else if (digest(current) !== target.sha256)
        conflicts.push({
          kind: "target-collision",
          path,
          reason: `New contract target ${path} is already occupied by different bytes.`,
        });
      continue;
    }
    if (source !== undefined && target === undefined) {
      if (current === undefined) continue;
      if (digest(current) !== source.sha256)
        conflicts.push({
          kind: "local-modification",
          path,
          reason: `Removed contract ${path} contains authored changes.`,
        });
      else
        conflicts.push({
          kind: "removed-contract",
          path,
          reason: `Contract ${path} was removed and requires explicit adjudication.`,
        });
      continue;
    }
    if (source === undefined || target === undefined) continue;
    if (current === undefined) {
      conflicts.push({
        kind: "missing-source",
        path,
        reason: `Tracked contract ${path} is missing.`,
      });
      continue;
    }
    const currentDigest = digest(current);
    if (currentDigest === target.sha256) continue;
    if (currentDigest !== source.sha256) {
      conflicts.push({
        kind: "local-modification",
        path,
        reason: `Contract ${path} differs from its recorded baseline.`,
      });
      continue;
    }
    const missingAnchors = source.anchors.filter(
      (anchor) => !target.anchors.includes(anchor),
    );
    if (missingAnchors.length !== 0)
      conflicts.push({
        kind: "removed-anchor",
        path,
        reason: `Contract ${path} removes anchors: ${missingAnchors.join(", ")}.`,
      });
    else
      actions.push({
        action: "write",
        after: props.targetSources[path]!,
        beforeSha256: source.sha256,
        path,
      });
  }
  return freeze({
    actions: actions.sort((left, right) => compare(left.path, right.path)),
    conflicts: conflicts.sort((left, right) => compare(left.path, right.path)),
    fromVersion: props.from.version,
    protocol: "automovie.contract-migration-plan.v1" as const,
    toVersion: props.to.version,
  });
};

/**
 * Apply one already-decided plan to the exact current byte map.
 *
 * @evidence requirements/operations-and-recovery/migration-and-compatibility.md#operations-nondestructive-migration Refuses conflicts and changed source bytes before deriving replacement output.
 * @evidence specifications/execution-and-recovery/portability-migration-and-compatibility.md#execution-nondestructive-migration Executes only the actions frozen by the inspected plan.
 */
export const applyAutoMovieContractMigrationPlan = (
  plan: IAutoMovieContractMigrationPlan,
  current: Readonly<Record<string, string>>,
): Record<string, string> => {
  if (plan.conflicts.length !== 0)
    throw new Error(
      "A contract migration plan with conflicts cannot be applied.",
    );
  const output = { ...current };
  for (const action of plan.actions) {
    if (action.action === "add") {
      if (output[action.path] !== undefined)
        throw new Error(`Contract migration target changed: ${action.path}.`);
      output[action.path] = action.after;
    } else if (action.action === "rename") {
      const source = output[action.from];
      if (source === undefined || digest(source) !== action.beforeSha256)
        throw new Error(`Contract migration source changed: ${action.from}.`);
      if (output[action.path] !== undefined)
        throw new Error(`Contract migration target changed: ${action.path}.`);
      output[action.path] = source;
      delete output[action.from];
    } else {
      const source = output[action.path];
      if (source === undefined || digest(source) !== action.beforeSha256)
        throw new Error(`Contract migration source changed: ${action.path}.`);
      if (action.action === "write") output[action.path] = action.after;
      else delete output[action.path];
    }
  }
  return output;
};
