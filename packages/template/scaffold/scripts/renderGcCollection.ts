import type { AutoMovieContentDigest } from "@automovie/interface";
import type {
  IAutoMovieProductionRenderCleanupDecision,
  IAutoMovieProductionRenderCleanupReceipt,
  IAutoMovieProductionRenderGcCandidate,
  IAutoMovieProductionRenderGcPlan,
} from "@automovie/production";
import type fs from "node:fs";
import path from "node:path";

import {
  type IRenderGcTargetSnapshot,
  type IRenderQuarantineGcCandidate,
  isRenderGcPreservedPath,
  isRenderGcQuarantineMarkerPath,
} from "./renderGcSnapshot";

export interface IProductionRenderGcRuntime<Lease, Result> {
  acquire: () => Lease;
  assertNoLiveWorkers: () => void;
  collect: (apply: boolean, expected?: Result) => Result;
  release: (failure: { error: unknown } | undefined, lease: Lease) => void;
}

/** Census or atomically apply render garbage collection under one GC lease. */
export const runProductionRenderGarbageCollection = <Lease, Result>(
  apply: boolean,
  runtime: IProductionRenderGcRuntime<Lease, Result>,
): Result => {
  const preview = runtime.collect(false);
  if (apply === false) return preview;
  const lease = runtime.acquire();
  let failure: { error: unknown } | undefined;
  try {
    runtime.assertNoLiveWorkers();
    return runtime.collect(true, preview);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    runtime.release(failure, lease);
  }
};

/** One inventory key: a candidate's ownership class and canonical path. */
export const renderGcCandidateKey = (
  candidate: Pick<IAutoMovieProductionRenderGcCandidate, "kind" | "path">,
): string => `${candidate.kind}\0${candidate.path}`;

/**
 * Preserve trees whose only pointer evidence remains in quarantine.
 *
 * A quarantined pointer no longer authenticates anything, so every tree that
 * still carries its digest would otherwise read as unreferenced and be swept.
 * The tree is the physical evidence an operator adjudicates the pointer
 * against, so both stay until that adjudication happens. A tree the current
 * inventory retains is a later, verified generation of the same chunk and is
 * never demoted by an older pointer's quarantine.
 */
export const quarantinedRenderChunkPointerProtection = (props: {
  adjudication: IAutoMovieProductionRenderCleanupReceipt | null;
  candidates: readonly IAutoMovieProductionRenderGcCandidate[];
  retained: ReadonlySet<string>;
}): {
  observation: NonNullable<
    IAutoMovieProductionRenderGcCandidate["observation"]
  >;
  treePaths: readonly string[];
} | null => {
  const adjudication = props.adjudication;
  if (
    adjudication === null ||
    adjudication.disposition !== "quarantine" ||
    adjudication.kind !== "chunk-pointer" ||
    adjudication.state !== "integrity-failed" ||
    adjudication.authority !== "exact-quarantine"
  )
    return null;
  const pointer = /^(proxy|final)\/pointers\/([0-9a-f]{64})$/u.exec(
    adjudication.path,
  );
  if (pointer === null) return null;
  const digest = `sha256:${pointer[2]}` as AutoMovieContentDigest;
  const treePaths = props.candidates
    .filter(
      (candidate) =>
        candidate.kind === "chunk-tree" &&
        candidate.digest === digest &&
        candidate.path.startsWith(`${pointer[1]}/tmp/`) &&
        props.retained.has(candidate.path) === false,
    )
    .map((candidate) => candidate.path)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (treePaths.length === 0) return null;
  return {
    observation: {
      state: "observation-conflict",
      authority: "none",
      stage: "reference",
      reason:
        "a quarantined unresolved pointer still owns this digest; preserve its marker, evidence, and every matching tree for manual adjudication",
    },
    treePaths,
  };
};

/** One inventoried entry, with its snapshot when capture proved one. */
export interface IRenderGcInventoryEntry {
  candidate: IAutoMovieProductionRenderGcCandidate;
  snapshot: IRenderGcTargetSnapshot | null;
}

/** Filesystem and capture seams behind the renderer-owned directory scans. */
export interface IRenderGcScanSeams {
  captureTarget: (base: string, target: string) => IRenderGcTargetSnapshot;
  compareCodeUnits: (left: string, right: string) => number;
  filesystem: Pick<typeof fs, "existsSync" | "readdirSync">;
}

/**
 * Inventory one tier's chunk cache directory as typed candidates.
 *
 * Only digest-named entries belong to the cache. A link or non-directory under
 * a digest name is an unsafe locator and a directory that cannot be captured
 * consistently is unavailable; neither proves a generation, so neither can be
 * removed.
 */
export const inventoryRenderChunkCacheDirectory = (props: {
  renderJobRoot: string;
  seams: IRenderGcScanSeams;
  tier: "final" | "proxy";
}): IRenderGcInventoryEntry[] => {
  const chunks = path.join(props.renderJobRoot, props.tier, "chunks");
  if (props.seams.filesystem.existsSync(chunks) === false) return [];
  const entries: IRenderGcInventoryEntry[] = [];
  for (const entry of props.seams.filesystem
    .readdirSync(chunks, { withFileTypes: true })
    .sort((left, right) =>
      props.seams.compareCodeUnits(left.name, right.name),
    )) {
    if (/^[0-9a-f]{64}$/u.test(entry.name) === false) continue;
    const candidate: IAutoMovieProductionRenderGcCandidate = {
      path: `${props.tier}/chunks/${entry.name}`,
      kind: "chunk",
      digest: `sha256:${entry.name}`,
      bytes: null,
      generation: null,
      fingerprint: null,
      observation: null,
    };
    if (entry.isSymbolicLink() || entry.isDirectory() === false) {
      candidate.observation = {
        state: "unsafe-locator",
        authority: "none",
        stage: "locator",
        reason:
          "the chunk cache locator is not one resident physical directory",
      };
      entries.push({ candidate, snapshot: null });
      continue;
    }
    let snapshot: IRenderGcTargetSnapshot;
    try {
      snapshot = props.seams.captureTarget(
        props.renderJobRoot,
        path.join(chunks, entry.name),
      );
    } catch {
      candidate.observation = {
        state: "unavailable",
        authority: "none",
        stage: "capture",
        reason: "the chunk cache generation could not be captured consistently",
      };
      entries.push({ candidate, snapshot: null });
      continue;
    }
    candidate.bytes = snapshot.bytes;
    candidate.generation = snapshot.targetIdentity;
    candidate.fingerprint = snapshot.contentFingerprint;
    entries.push({ candidate, snapshot });
  }
  return entries;
};

/** One ownership root whose `quarantine` child holds GC markers. */
export interface IRenderGcQuarantineRoot {
  base: string;
  logical:
    | "final"
    | "production"
    | "project"
    | "proxy"
    | "publication"
    | "render-job";
}

/** The logical candidate path of one quarantine marker under its root. */
export const renderGcQuarantinePath = (
  logical: IRenderGcQuarantineRoot["logical"],
  name: string,
): string =>
  logical === "proxy" || logical === "final"
    ? `${logical}/quarantine/${name}`
    : `quarantine/${logical}/${name}`;

/**
 * Inventory every quarantine marker directory that a GC apply can write to.
 *
 * Apply writes a marker beside the ownership root of the target it moved, so
 * the next GC reads the same set of roots; a marker under a root nobody scans
 * would preserve its evidence forever without ever being adjudicated. Two
 * roots that resolve to one directory are scanned once. A root whose
 * `quarantine` directory exists but cannot be listed refuses the inventory,
 * because a plan that did not see it cannot claim to be complete.
 */
export const inventoryRenderQuarantineRoots = (props: {
  roots: readonly IRenderGcQuarantineRoot[];
  seams: IRenderGcScanSeams;
}): IRenderGcInventoryEntry[] => {
  const roots = props.roots.filter(
    (entry, index, entries) =>
      entries.findIndex(
        (candidate) =>
          path.resolve(candidate.base) === path.resolve(entry.base),
      ) === index,
  );
  const entries: IRenderGcInventoryEntry[] = [];
  for (const owner of roots) {
    const quarantineRoot = path.join(owner.base, "quarantine");
    if (props.seams.filesystem.existsSync(quarantineRoot) === false) continue;
    let listed: fs.Dirent[];
    try {
      listed = props.seams.filesystem.readdirSync(quarantineRoot, {
        withFileTypes: true,
      });
    } catch (error) {
      throw new Error(
        `Render GC cannot inventory quarantine root "${quarantineRoot}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    for (const entry of listed.sort((left, right) =>
      props.seams.compareCodeUnits(left.name, right.name),
    )) {
      const candidate: IAutoMovieProductionRenderGcCandidate = {
        path: renderGcQuarantinePath(owner.logical, entry.name),
        kind: "quarantine",
        digest: null,
        bytes: null,
        generation: null,
        fingerprint: null,
        observation: null,
      };
      if (
        entry.isSymbolicLink() ||
        (entry.isDirectory() === false && entry.isFile() === false)
      ) {
        candidate.observation = {
          state: "unsafe-locator",
          authority: "none",
          stage: "locator",
          reason:
            "the quarantine locator is not one resident physical file or directory",
        };
        entries.push({ candidate, snapshot: null });
        continue;
      }
      let snapshot: IRenderGcTargetSnapshot;
      try {
        snapshot = props.seams.captureTarget(
          owner.base,
          path.join(quarantineRoot, entry.name),
        );
      } catch {
        candidate.observation = {
          state: "unavailable",
          authority: "none",
          stage: "capture",
          reason:
            "the quarantine generation could not be captured consistently",
        };
        entries.push({ candidate, snapshot: null });
        continue;
      }
      candidate.generation = snapshot.targetIdentity;
      candidate.fingerprint = snapshot.contentFingerprint;
      entries.push({ candidate, snapshot });
    }
  }
  return entries;
};

/** One captured marker with the inventory verdict folded into its candidate. */
export interface IRenderGcQuarantineBinding {
  candidate: IAutoMovieProductionRenderGcCandidate;
  evidence: IRenderGcTargetSnapshot | null;
  marker: IRenderGcTargetSnapshot;
}

/**
 * Fold each captured marker's inventory verdict into its GC candidate.
 *
 * The inventory answers one verdict per marker in marker order. A marker whose
 * evidence did not bind uniquely is an observation conflict. A marker that
 * records the quarantine of a chunk pointer keeps every unretained tree of that
 * digest out of the sweep, and is itself kept, until an operator adjudicates
 * the pointer: the same observation is written onto the marker and onto each
 * such tree that would otherwise carry mutation authority.
 */
export const bindRenderQuarantineCandidates = (props: {
  candidates: IAutoMovieProductionRenderGcCandidate[];
  entries: ReadonlyArray<{
    candidate: IAutoMovieProductionRenderGcCandidate;
    snapshot: IRenderGcTargetSnapshot;
  }>;
  inventory: (
    markers: readonly IRenderGcTargetSnapshot[],
  ) => readonly IRenderQuarantineGcCandidate[];
  retained: ReadonlySet<string>;
}): IRenderGcQuarantineBinding[] =>
  props
    .inventory(props.entries.map((entry) => entry.snapshot))
    .map((inventory, index) => {
      const candidate = props.entries[index]!.candidate;
      candidate.bytes = inventory.bytes;
      candidate.fingerprint = inventory.fingerprint;
      candidate.observation =
        inventory.evidence === null
          ? {
              state: "observation-conflict",
              authority: "none",
              stage: "reference",
              reason:
                "the quarantine marker does not bind one unique preserved generation",
            }
          : null;
      const protection = quarantinedRenderChunkPointerProtection({
        adjudication: inventory.adjudication,
        candidates: props.candidates,
        retained: props.retained,
      });
      if (protection !== null) {
        candidate.observation = protection.observation;
        const treePaths = new Set(protection.treePaths);
        for (const tree of props.candidates)
          if (
            treePaths.has(tree.path) &&
            (tree.observation === null || tree.observation.authority !== "none")
          )
            tree.observation = protection.observation;
      }
      return {
        candidate,
        evidence: inventory.evidence,
        marker: inventory.marker,
      };
    });

/**
 * Inventory the publication root's loose files as typed candidates.
 *
 * Bundles the proxy sweep already adjudicated are skipped by exact file or
 * root. GC's own preserved evidence and marker directories are never
 * publication content: the markers are inventoried once, as quarantine
 * candidates. A link, a directory that refused to list, and a file that could
 * not be captured each stay in the plan under their own state.
 */
export const inventoryRenderPublicationDirectory = (props: {
  renderRoot: string;
  seams: IRenderGcScanSeams;
  sweptRoots: readonly string[];
  sweptTargets: ReadonlySet<string>;
}): IRenderGcInventoryEntry[] => {
  const unsafeLocators: string[] = [];
  const unavailableLocators: string[] = [];
  const entries: IRenderGcInventoryEntry[] = [];
  const owned = (target: string): string | null => {
    const relative = renderGcRelativePath(props.renderRoot, target);
    return isRenderGcPreservedPath(relative) ||
      isRenderGcQuarantineMarkerPath(relative) ||
      props.sweptTargets.has(relative) ||
      props.sweptRoots.some((root) => relative.startsWith(root))
      ? null
      : relative;
  };
  const candidateOf = (
    relative: string,
  ): IAutoMovieProductionRenderGcCandidate => ({
    path: `publication/${relative}`,
    kind: "publication",
    digest: null,
    bytes: null,
    generation: null,
    fingerprint: null,
    observation: null,
  });
  for (const file of listRenderGcPhysicalFiles({
    compareCodeUnits: props.seams.compareCodeUnits,
    directory: props.renderRoot,
    filesystem: props.seams.filesystem,
    unavailableLocators,
    unsafeLocators,
  })) {
    const relative = owned(file);
    if (relative === null) continue;
    const candidate = candidateOf(relative);
    let snapshot: IRenderGcTargetSnapshot;
    try {
      snapshot = props.seams.captureTarget(props.renderRoot, file);
    } catch {
      candidate.observation = {
        state: "unavailable",
        authority: "none",
        stage: "capture",
        reason: "the publication target could not be captured consistently",
      };
      entries.push({ candidate, snapshot: null });
      continue;
    }
    candidate.bytes = snapshot.bytes;
    candidate.generation = snapshot.targetIdentity;
    candidate.fingerprint = snapshot.contentFingerprint;
    entries.push({ candidate, snapshot });
  }
  for (const target of unsafeLocators) {
    const relative = owned(target);
    if (relative === null) continue;
    const candidate = candidateOf(relative);
    candidate.observation = {
      state: "unsafe-locator",
      authority: "none",
      stage: "locator",
      reason:
        "the publication locator is a symbolic link and remains outside automatic cleanup authority",
    };
    entries.push({ candidate, snapshot: null });
  }
  for (const target of unavailableLocators) {
    const relative = owned(target);
    if (relative === null) continue;
    const candidate = candidateOf(relative);
    candidate.observation = {
      state: "unavailable",
      authority: "none",
      stage: "capture",
      reason: "the publication directory could not be inventoried consistently",
    };
    entries.push({ candidate, snapshot: null });
  }
  return entries;
};

/** The logical POSIX path of one physical target under its ownership root. */
export const renderGcRelativePath = (root: string, target: string): string =>
  path.relative(root, target).replaceAll("\\", "/");

/** One mutation target whose decision, snapshot, and evidence were rebound. */
export interface IRenderGcApplyTarget {
  decision: IAutoMovieProductionRenderCleanupDecision;
  evidence: IRenderGcTargetSnapshot | undefined;
  snapshot: IRenderGcTargetSnapshot;
}

/**
 * Bind the exact remove and quarantine targets an apply may mutate.
 *
 * Apply consumes only a plan whose basis equals the dry-run it was fenced
 * against, only decisions whose receipts are bound to that basis, and only
 * targets whose captured snapshot (and quarantine evidence) still holds at the
 * moment before mutation. Any other input refuses before the first move.
 */
export const bindRenderGcApplyTargets = (props: {
  assertCaptured: (snapshot: IRenderGcTargetSnapshot) => void;
  evidence: ReadonlyMap<string, IRenderGcTargetSnapshot>;
  expected: { applied: boolean; basis: AutoMovieContentDigest } | undefined;
  plan: IAutoMovieProductionRenderGcPlan;
  snapshots: ReadonlyMap<string, IRenderGcTargetSnapshot>;
}): {
  quarantine: IRenderGcApplyTarget[];
  remove: IRenderGcApplyTarget[];
} => {
  const expected = props.expected;
  if (
    expected === undefined ||
    expected.applied ||
    expected.basis !== props.plan.basis
  )
    throw new Error(
      "Render GC inventory changed between preview and apply; rerun the dry-run before mutating any target.",
    );
  const bind = (
    disposition: "quarantine" | "remove",
    decisions: readonly IAutoMovieProductionRenderCleanupDecision[],
  ): IRenderGcApplyTarget[] =>
    decisions.map((decision) => {
      const receipt = decision.receipt;
      const candidate = decision.candidate;
      if (
        receipt.version !== 1 ||
        receipt.basis !== props.plan.basis ||
        receipt.disposition !== disposition ||
        receipt.kind !== candidate.kind ||
        receipt.path !== candidate.path ||
        receipt.generation !== candidate.generation ||
        receipt.fingerprint !== candidate.fingerprint ||
        receipt.state !== decision.state ||
        receipt.authority !== decision.authority ||
        receipt.stage !== decision.stage ||
        receipt.reason !== decision.reason
      )
        throw new Error(
          `Render GC ${disposition} decision for "${candidate.path}" is not bound to this plan basis.`,
        );
      const key = renderGcCandidateKey(candidate);
      const snapshot = props.snapshots.get(key);
      if (snapshot === undefined)
        throw new Error(
          `GC ${disposition} candidate "${candidate.path}" has no matching inventory snapshot.`,
        );
      props.assertCaptured(snapshot);
      const evidence = props.evidence.get(key);
      if (evidence !== undefined) props.assertCaptured(evidence);
      return { decision, evidence, snapshot };
    });
  return {
    quarantine: bind("quarantine", props.plan.quarantine),
    remove: bind("remove", props.plan.remove),
  };
};

/**
 * List the physical files under one directory in code-unit order.
 *
 * The root itself must list, because a plan over an unlisted root would not
 * know what it failed to see. A descendant that refuses to list, or a symbolic
 * link, is recorded through the matching collector when one is supplied and
 * refuses the listing otherwise.
 */
export const listRenderGcPhysicalFiles = (props: {
  compareCodeUnits: (left: string, right: string) => number;
  directory: string;
  filesystem: Pick<typeof fs, "readdirSync">;
  unavailableLocators?: string[];
  unsafeLocators?: string[];
}): string[] => {
  const visit = (directory: string, nested: boolean): string[] => {
    const output: string[] = [];
    let entries: fs.Dirent[];
    try {
      entries = props.filesystem.readdirSync(directory, {
        withFileTypes: true,
      });
    } catch (error) {
      if (nested === false || props.unavailableLocators === undefined)
        throw error;
      props.unavailableLocators.push(directory);
      return output;
    }
    for (const entry of entries.sort((left, right) =>
      props.compareCodeUnits(left.name, right.name),
    )) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (props.unsafeLocators === undefined)
          throw new Error(`Render GC refuses linked publication "${target}".`);
        props.unsafeLocators.push(target);
        continue;
      }
      if (entry.isDirectory()) output.push(...visit(target, true));
      else if (entry.isFile()) output.push(target);
    }
    return output;
  };
  return visit(props.directory, false);
};
