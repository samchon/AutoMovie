import { createHash } from "node:crypto";
import path from "node:path";

import {
  type AutoMovieProductionLanguage,
  isAutoMovieProductionLanguage,
} from "./AutoMovieProductionLanguage";
import { parseAutoMovieEvidenceMarkdownHeadings } from "./parseAutoMovieEvidenceMarkdown";

/**
 * One immutable shared-contract file identity recorded by a generated project.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Retains the exact path, digest, and anchor inventory a later migration validates.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Types one baseline member compared before migration completion.
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
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Makes the adopted scaffold generation explicit instead of guessing from current files.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Supplies the immutable baseline side of compatibility classification.
 */
export interface IAutoMovieContractBaseline {
  /** Exact shared-contract inventory in code-unit path order. */
  files: readonly IAutoMovieContractBaselineFile[];
  /** Creation-selected production contract language. */
  language: AutoMovieProductionLanguage;
  /** Portable record protocol. */
  protocol: "automovie.contract-baseline.v1";
  /** Installed scaffold contract generation. */
  version: string;
}

/**
 * One exact byte mutation admitted by a migration plan.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Restricts automatic work to explicit add, rename, or write decisions.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Carries the before identity and target bytes needed by apply.
 */
export type AutoMovieContractMigrationAction =
  | { action: "add"; after: string; path: string }
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
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Keeps partial or ambiguous work out of a successful result.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Names the exact unresolved class and affected path.
 */
export interface IAutoMovieContractMigrationConflict {
  /**
   * Closed conflict class used by an explicit adjudication flow.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Separates every unresolved migration condition from successful apply.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Carries the machine-readable failure class for one affected path.
   */
  kind:
    | "local-modification"
    | "missing-source"
    | "removed-anchor"
    | "removed-contract"
    | "rename-ambiguity"
    | "target-collision";
  /**
   * Project-relative contract path at which the conflict was observed.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Addresses the exact contract requiring adjudication.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Keeps a conflict inside the validated shared-contract inventory.
   */
  path: string;
  /**
   * Human-readable reason that names the unresolved state.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Explains why the migration cannot claim complete success.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Reports the observed mismatch beside its classification and path.
   */
  reason: string;
}

/**
 * One closed migration decision reused by dry-run and apply.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Prevents apply from silently recomputing a different migration.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Carries both explicit actions and unresolved conflicts between generations.
 */
export interface IAutoMovieContractMigrationPlan {
  /**
   * Exact ordered mutations admitted by the planner.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Limits apply to the inspected conflict-free decisions.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Carries add, write, and unambiguous rename actions in canonical order.
   */
  actions: readonly AutoMovieContractMigrationAction[];
  /**
   * Exact ordered conditions that prevent automatic apply.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Prevents a partial or ambiguous plan from becoming success.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Preserves every unresolved path for explicit adjudication.
   */
  conflicts: readonly IAutoMovieContractMigrationConflict[];
  /**
   * Recorded scaffold contract generation being migrated.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Retains the predecessor identity in the plan.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Names the immutable source generation.
   */
  fromVersion: string;
  /**
   * Portable migration-plan protocol.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Makes the decision record interpretable across invocations.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Identifies the supported plan shape.
   */
  protocol: "automovie.contract-migration-plan.v1";
  /**
   * Installed scaffold contract generation selected as the target.
   *
   * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Retains the successor identity without rewriting the predecessor plan.
   * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Names the validated target generation.
   */
  toVersion: string;
}

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const digest = (source: string): string =>
  `sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`;

const anchors = (source: string): string[] =>
  parseAutoMovieEvidenceMarkdownHeadings(source)
    .filter((heading) => heading.depth === 2 && heading.anchor !== undefined)
    .map((heading) => heading.anchor!);

const CONTRACT_PATH_PREFIXES = [
  "docs/discovery/",
  "docs/language/",
  "docs/obligations/",
  "docs/principles/",
  "docs/upstream/",
] as const;

const PORTABLE_RESERVED_NAME =
  /^(?:con|prn|aux|nul|com(?:[1-9\u00b9\u00b2\u00b3])|lpt(?:[1-9\u00b9\u00b2\u00b3]))(?:\.|$)/iu;
const PORTABLE_RESERVED_CHARACTER = /[<>:"|?*\u0000-\u001f]/u;

/**
 * Whether one project-relative path belongs to the portable shared-contract
 * inventory a generated project's baseline may authorize.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Refuses a baseline path that could address project-external or non-contract bytes.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Restricts migration identities to normalized shared-contract Markdown paths.
 */
export const isAutoMovieContractTargetPath = (value: string): boolean => {
  if (
    value.length === 0 ||
    value !== value.normalize("NFC") ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    !value.endsWith(".md") ||
    !CONTRACT_PATH_PREFIXES.some((prefix) => value.startsWith(prefix))
  )
    return false;
  return value
    .split("/")
    .every(
      (segment) =>
        segment.length !== 0 &&
        segment !== "." &&
        segment !== ".." &&
        !segment.endsWith(".") &&
        !segment.endsWith(" ") &&
        !PORTABLE_RESERVED_CHARACTER.test(segment) &&
        !PORTABLE_RESERVED_NAME.test(segment),
    );
};

const assertContractPath = (value: unknown): string => {
  if (typeof value !== "string" || !isAutoMovieContractTargetPath(value))
    throw new Error(
      `Invalid AutoMovie contract baseline path: ${JSON.stringify(value)}.`,
    );
  return value;
};

const canonicalContractPath = (value: string): string => value.toLowerCase();

const assertExactGeneration = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    /\s/u.test(value) ||
    /^[~^*<>=]/u.test(value)
  )
    throw new Error(
      "AutoMovie contract baseline requires an exact generation.",
    );
  return value;
};

const assertExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
  owner: string,
): void => {
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  )
    throw new Error(`${owner} has an unsupported field set.`);
};

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
  validateContractBaseline(baseline);
  return new Map(baseline.files.map((file) => [file.path, file]));
};

const validateContractBaseline = (
  baseline: IAutoMovieContractBaseline,
): void => {
  if (baseline === null || typeof baseline !== "object")
    throw new Error("AutoMovie contract baseline must be an object.");
  assertExactKeys(
    baseline as unknown as Record<string, unknown>,
    ["files", "language", "protocol", "version"],
    "AutoMovie contract baseline",
  );
  if (baseline.protocol !== "automovie.contract-baseline.v1")
    throw new Error("Unsupported AutoMovie contract baseline protocol.");
  if (!isAutoMovieProductionLanguage(baseline.language))
    throw new Error("AutoMovie contract baseline has an invalid language.");
  assertExactGeneration(baseline.version);
  if (!Array.isArray(baseline.files))
    throw new Error("AutoMovie contract baseline files must be an array.");
  const canonical = new Set<string>();
  let previousPath: string | undefined;
  for (const candidate of baseline.files as readonly unknown[]) {
    if (candidate === null || typeof candidate !== "object")
      throw new Error("AutoMovie contract baseline file must be an object.");
    const file = candidate as Record<string, unknown>;
    assertExactKeys(
      file,
      ["anchors", "path", "sha256"],
      "Contract baseline file",
    );
    const relative = assertContractPath(file.path);
    if (previousPath !== undefined && compare(previousPath, relative) >= 0)
      throw new Error(
        "Contract baseline files are not in canonical path order.",
      );
    previousPath = relative;
    const key = canonicalContractPath(relative);
    if (canonical.has(key))
      throw new Error(
        `Contract baseline repeats portable path ${JSON.stringify(relative)}.`,
      );
    canonical.add(key);
    if (
      typeof file.sha256 !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(file.sha256)
    )
      throw new Error(
        `Contract baseline has an invalid digest for ${relative}.`,
      );
    if (
      !Array.isArray(file.anchors) ||
      file.anchors.some(
        (anchor) =>
          typeof anchor !== "string" ||
          anchor.length === 0 ||
          /[{}\s]/u.test(anchor),
      ) ||
      new Set(file.anchors).size !== file.anchors.length
    )
      throw new Error(`Contract baseline has invalid anchors for ${relative}.`);
  }
};

/**
 * Parse and validate one persisted contract baseline before any path in it is
 * used for project I/O.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Rejects malformed or path-escaping recorded generations before migration inspection.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Produces a closed portable baseline value from untrusted JSON bytes.
 */
export const parseAutoMovieContractBaseline = (
  source: string,
): IAutoMovieContractBaseline => {
  const baseline = JSON.parse(source) as IAutoMovieContractBaseline;
  validateContractBaseline(baseline);
  return freeze({
    files: baseline.files.map((file) => ({
      anchors: [...file.anchors],
      path: file.path,
      sha256: file.sha256,
    })),
    language: baseline.language,
    protocol: baseline.protocol,
    version: baseline.version,
  });
};

/**
 * Build the portable baseline receipt from exact target bytes.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-baseline-identity Records the complete source inventory migration will later compare.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-baseline-identity Derives stable path, anchor, and digest identities from current target bytes.
 */
export const createAutoMovieContractBaseline = (props: {
  files: Readonly<Record<string, string>>;
  language: IAutoMovieContractBaseline["language"];
  version: string;
}): IAutoMovieContractBaseline => {
  assertExactGeneration(props.version);
  if (!isAutoMovieProductionLanguage(props.language))
    throw new Error("AutoMovie contract baseline has an invalid language.");
  const files = Object.keys(props.files);
  for (const relative of files) assertContractPath(relative);
  const canonical = new Set(files.map(canonicalContractPath));
  if (canonical.size !== files.length)
    throw new Error(
      "Contract baseline source paths contain a portable collision.",
    );
  const baseline: IAutoMovieContractBaseline = {
    files: files.sort(compare).map((relative) => ({
      anchors: anchors(props.files[relative]!),
      path: relative,
      sha256: digest(props.files[relative]!),
    })),
    language: props.language,
    protocol: "automovie.contract-baseline.v1" as const,
    version: props.version,
  };
  validateContractBaseline(baseline);
  return freeze(baseline);
};

/**
 * Compare immutable from/to inventories with current project bytes.
 *
 * Exact baseline bytes may be replaced. Authored divergence, anchor removal,
 * ambiguous rename identity, and occupied targets remain explicit conflicts.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Preserves authored divergence and reports every unresolved contract identity before mutation.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Produces one immutable source-to-target plan whose actions retain exact source and target identities.
 */
export const planAutoMovieContractMigration = (props: {
  current: Readonly<Record<string, string>>;
  from: IAutoMovieContractBaseline;
  targetSources: Readonly<Record<string, string>>;
  to: IAutoMovieContractBaseline;
}): IAutoMovieContractMigrationPlan => {
  const from = baselineMap(props.from);
  const to = baselineMap(props.to);
  if (props.from.language !== props.to.language)
    throw new Error("Contract migration cannot change production language.");
  const targetPaths = Object.keys(props.targetSources);
  for (const relative of targetPaths) assertContractPath(relative);
  if (
    targetPaths.length !== to.size ||
    targetPaths.some((relative) => !to.has(relative))
  )
    throw new Error("Target source inventory does not match its baseline.");
  for (const relative of Object.keys(props.current))
    assertContractPath(relative);
  for (const target of to.values()) {
    if (!Object.prototype.hasOwnProperty.call(props.targetSources, target.path))
      throw new Error(`Target source is missing for ${target.path}.`);
    const targetSource = props.targetSources[target.path]!;
    if (
      digest(targetSource) !== target.sha256 ||
      JSON.stringify(anchors(targetSource)) !== JSON.stringify(target.anchors)
    )
      throw new Error(
        `Target source does not match baseline for ${target.path}.`,
      );
  }

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
    else if (occupied === undefined || digest(occupied) === target.sha256)
      actions.push({
        action: "rename",
        beforeSha256: source.sha256,
        from: source.path,
        path: target.path,
      });
    else
      conflicts.push({
        kind: "target-collision",
        path: target.path,
        reason: `Rename target ${target.path} already exists.`,
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
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-plan Refuses conflicts and changed source bytes before deriving replacement output.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-plan Executes only the actions frozen by the inspected plan.
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
      const target = output[action.path];
      if (target !== undefined && digest(target) !== action.beforeSha256)
        throw new Error(`Contract migration target changed: ${action.path}.`);
      if (target === undefined) output[action.path] = source;
      delete output[action.from];
    } else {
      const source = output[action.path];
      if (source === undefined || digest(source) !== action.beforeSha256)
        throw new Error(`Contract migration source changed: ${action.path}.`);
      output[action.path] = action.after;
    }
  }
  return output;
};

/**
 * One source path retired only after its target bytes are published.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-publication Preserves the exact source until its validated rename target exists.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-publication Carries both generations needed by target-first rename execution.
 */
export interface IAutoMovieContractMigrationRemoval {
  /** Exact bytes that must occupy the published rename target. */
  after: string;
  /** Exact bytes that must still occupy the source path before retirement. */
  before: string;
  /** Validated project-relative source path. */
  path: string;
  /** Validated project-relative target path. */
  target: string;
}

/**
 * Closed file mutations derived from a still-current migration plan.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-publication Separates complete target publication from later source retirement.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-publication Makes the target candidate and exact rename consequences explicit before mutation.
 */
export interface IAutoMovieContractMigrationPublication {
  /** Rename sources retired after every target write completes. */
  removals: readonly IAutoMovieContractMigrationRemoval[];
  /** Complete target byte candidate published before any source is retired. */
  writes: Readonly<Record<string, string>>;
}

const actionPaths = (
  action: AutoMovieContractMigrationAction,
): readonly string[] =>
  action.action === "rename" ? [action.from, action.path] : [action.path];

/**
 * Revalidate a migration plan against a new observation and close its complete
 * target candidate before a caller performs filesystem mutation.
 *
 * @evidence requirements/operations-and-recovery/contract-migration.md#operations-contract-migration-publication Refuses a changed source or competitor before publishing target bytes or retiring a rename source.
 * @evidence specifications/execution-and-recovery/contract-migration.md#execution-contract-migration-publication Derives target-first writes and exact rename-source retirements from one inspected plan.
 */
export const planAutoMovieContractMigrationPublication = (props: {
  current: Readonly<Record<string, string>>;
  observed: Readonly<Record<string, string>>;
  plan: IAutoMovieContractMigrationPlan;
}): IAutoMovieContractMigrationPublication => {
  const compared = new Set(props.plan.actions.flatMap(actionPaths));
  for (const relative of compared)
    if (props.current[relative] !== props.observed[relative])
      throw new Error(
        `Contract migration input changed after planning: ${relative}.`,
      );
  const migrated = applyAutoMovieContractMigrationPlan(
    props.plan,
    props.observed,
  );
  const writes = Object.create(null) as Record<string, string>;
  const removals: IAutoMovieContractMigrationRemoval[] = [];
  for (const action of props.plan.actions) {
    const source = migrated[action.path]!;
    if (props.observed[action.path] !== source) writes[action.path] = source;
    if (action.action === "rename")
      removals.push(
        Object.freeze({
          after: source,
          before: props.observed[action.from]!,
          path: action.from,
          target: action.path,
        }),
      );
  }
  return Object.freeze({
    removals: Object.freeze(removals),
    writes: Object.freeze(writes),
  });
};
