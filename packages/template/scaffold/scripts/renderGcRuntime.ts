import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  AutoMovieProductionProject,
  type IAutoMovieLocalProcessOwner,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderCleanupDecision,
  type IAutoMovieProductionRenderGcCandidate,
  type IAutoMovieProductionRenderGcPlan,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderTier,
  digestAutoMovieBytes,
  isAutoMovieLocalProcessOwner,
  planProductionRenderGc,
  readAutoMovieFilmTimeline,
  verifyProductionRenderChunkReceipt,
} from "@automovie/production";
import type fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { inspectCapturedProxyBundle } from "./assertProxyBundle";
import { captureProxyPublicationGcTarget } from "./publishProxyBundle";
import { listRenderAttempts } from "./renderAttemptSnapshot";
import {
  type IRenderChunkLockOwner,
  RENDER_LOCK_JSON_MAX_BYTES,
  isRenderChunkLockOwner,
} from "./renderChunkRuntime";
import {
  captureRenderChunkPublicationFromPointer,
  currentRenderChunkPublicationProtectsTree,
  inventoryRenderChunkGarbage,
  removeCapturedRenderChunkPointer,
  renderChunkPublicationPath,
} from "./renderChunkSnapshot";
import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY,
  RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  ensureRenderPhysicalDirectory,
  inventoryRenderQuarantineCandidates,
  isRenderGcPreservedPath,
  quarantineCapturedRenderTarget,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
  removeCapturedRenderQuarantine,
} from "./renderGcSnapshot";
import type { IProductionRenderHost } from "./renderHost";
import {
  acquireRenderGcLease,
  preserveRenderLivenessLease,
} from "./renderLiveness";
import { observeRenderOwnerRecovery } from "./renderOwnerState";
import { captureExistingRenderPlan } from "./renderPlanSnapshot";
import type { IProductionRenderChunkInspection } from "./renderPlanningRuntime";
import { parseRenderProcessOwnerSuffix } from "./renderProcessOwner";
import type { IProductionSoundRuntime } from "./renderSoundRuntime";
import { inventoryProductionSoundCaches } from "./soundCacheSnapshot";

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
  adjudication: IAutoMovieProductionRenderCleanupDecision["receipt"] | null;
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

export const createProductionRenderGarbageRuntime = (props: {
  captureTarget: typeof captureRenderGcTarget;
  compareCodeUnits: (left: string, right: string) => number;
  finalTier: IAutoMovieProductionRenderTier;
  host: IProductionRenderHost;
  inspectChunk: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
    pointer: IRenderGcTargetSnapshot,
  ) => IProductionRenderChunkInspection;
  productionId: string;
  productionStateRoot: string;
  proxyTier: IAutoMovieProductionRenderTier;
  readRendererJson: <Value>(ownershipRoot: string, file: string) => Value;
  removeTarget: typeof removeCapturedRenderGcTarget;
  renderJobRoot: string;
  renderLivenessScope: string;
  renderPublicationFingerprint: (
    plan: IAutoMovieProductionRenderJobPlan,
  ) => AutoMovieContentDigest;
  renderTier: IAutoMovieProductionRenderTier;
  root: string;
  soundRuntime: IProductionSoundRuntime;
  sourceFingerprint: () => AutoMovieContentDigest;
  stateRoot: string;
}) => {
  const renderHost = props.host;
  const root = props.root;
  const productionId = props.productionId;
  const productionStateRoot = props.productionStateRoot;
  const renderJobRoot = props.renderJobRoot;
  const renderLivenessScope = props.renderLivenessScope;
  const renderTier = props.renderTier;
  const stateRoot = props.stateRoot;
  const sourceFingerprint = props.sourceFingerprint;
  const renderPublicationFingerprint = props.renderPublicationFingerprint;
  const readRendererJson = props.readRendererJson;
  const compareCodeUnits = props.compareCodeUnits;
  const config = { render: { proxy: props.proxyTier, final: props.finalTier } };
  const chunkDirectory = (digest: AutoMovieContentDigest): string =>
    renderChunkPublicationPath({
      chunk: digest,
      root,
      scope: renderLivenessScope,
      tier: renderTier.kind,
    });

  const renderGarbageCollection = (apply: boolean) => {
    return runProductionRenderGarbageCollection(apply, {
      acquire: () =>
        acquireRenderGcLease({
          coordinationRoot: root,
          observeProcessOwner: renderHost.observeProcessOwner,
          owner: renderHost.owner,
          scope: renderLivenessScope,
        }),
      assertNoLiveWorkers: assertNoLiveRenderWorkers,
      collect: collectRenderGarbage,
      release: preserveRenderLivenessLease,
    });
  };

  type RenderGcExecution = IAutoMovieProductionRenderGcPlan & {
    applied: boolean;
  };

  const collectRenderGarbage = (
    apply: boolean,
    expected?: RenderGcExecution,
  ): RenderGcExecution => {
    const currentCompileFingerprint = sourceFingerprint();
    const plans = renderHost.filesystem.existsSync(renderJobRoot)
      ? (["proxy", "final"] as const).flatMap((tier) => {
          const file = path.join(renderJobRoot, tier, "plan.json");
          const captured = captureExistingRenderPlan(renderJobRoot, file);
          if (captured === null) return [];
          const plan = captured.plan;
          const currentTier =
            tier === "proxy" ? config.render.proxy : config.render.final;
          return plan.compileFingerprint === currentCompileFingerprint &&
            isDeepStrictEqual(plan.tier, currentTier)
            ? [plan]
            : [];
        })
      : [];
    const project = AutoMovieProductionProject.openReadOnly(root, productionId);
    const soundRetention = props.soundRuntime.cacheRetention({
      compileFingerprint: currentCompileFingerprint,
      project,
      timeline: readAutoMovieFilmTimeline(project, currentCompileFingerprint),
    });
    const renderRoot = project.renderRoot();
    const manifestPath = path.join(productionStateRoot, "render-manifest.json");
    const publicationPaths = new Set(
      renderHost.filesystem.existsSync(manifestPath)
        ? (
            readRendererJson<{
              deliverables: Array<{ files: Array<{ path: string }> }>;
            }>(productionStateRoot, manifestPath).deliverables ?? []
          ).flatMap((deliverable) =>
            deliverable.files.map((file) => `publication/${file.path}`),
          )
        : [],
    );
    const candidates: IAutoMovieProductionRenderGcCandidate[] = [];
    const candidateSnapshots = new Map<string, IRenderGcTargetSnapshot>();
    const scanSeams: IRenderGcScanSeams = {
      captureTarget: props.captureTarget,
      compareCodeUnits,
      filesystem: renderHost.filesystem,
    };
    const quarantineEvidenceSnapshots = new Map<
      string,
      IRenderGcTargetSnapshot
    >();
    const retainedChunkPaths = new Set<string>();
    const retainedCachePaths = new Set([
      ...soundRetention.dialoguePaths,
      ...soundRetention.modelPaths,
    ]);
    for (const entry of inventoryProductionSoundCaches({
      captureTarget: props.captureTarget,
      productionStateRoot,
    })) {
      candidates.push(entry.candidate);
      candidateSnapshots.set(
        renderGcCandidateKey(entry.candidate),
        entry.snapshot,
      );
    }
    for (const tier of ["proxy", "final"] as const) {
      const tierPlan = plans.find((plan) => plan.tier.kind === tier);
      const tierChunks = new Map(
        (tierPlan?.chunks ?? []).map((chunk) => [chunk.id, chunk]),
      );
      const publicationInventory = inventoryRenderChunkGarbage({
        assertReceipt: (chunk, receipt) => {
          if (tierPlan === undefined)
            throw new Error("Render GC has no current plan for this chunk.");
          verifyProductionRenderChunkReceipt({
            plan: tierPlan,
            chunk,
            receipt,
          });
        },
        chunks: tierChunks,
        observeProcessOwner: renderHost.observeProcessOwner,
        renderJobRoot,
        root,
        scope: renderLivenessScope,
        seams: {
          assertCaptured: assertCapturedRenderTarget,
          captureTarget: props.captureTarget,
          capturePublication: captureRenderChunkPublicationFromPointer,
          filesystem: renderHost.filesystem,
        },
        tier,
      });
      const currentPublicationPaths = new Set(
        publicationInventory.retainedChunkPaths,
      );
      for (const pointer of publicationInventory.entries.filter(
        (entry) =>
          entry.candidate.kind === "chunk-pointer" &&
          entry.snapshot !== null &&
          currentPublicationPaths.has(entry.candidate.path),
      )) {
        const chunk = tierChunks.get(pointer.candidate.digest!);
        if (tierPlan === undefined || chunk === undefined) continue;
        const inspection = props.inspectChunk(
          tierPlan,
          chunk,
          pointer.snapshot!,
        );
        if (inspection.finding.state === "current") continue;
        const observation = {
          state: inspection.finding.state,
          authority: inspection.finding.authority,
          stage: inspection.finding.stage,
          reason: inspection.finding.reason,
        };
        pointer.candidate.observation = observation;
        currentPublicationPaths.delete(pointer.candidate.path);
        for (const tree of publicationInventory.entries)
          if (
            tree.candidate.kind === "chunk-tree" &&
            tree.candidate.digest === pointer.candidate.digest &&
            currentPublicationPaths.has(tree.candidate.path)
          ) {
            tree.candidate.observation = observation;
            currentPublicationPaths.delete(tree.candidate.path);
          }
      }
      for (const entry of publicationInventory.entries) {
        candidates.push(entry.candidate);
        if (entry.snapshot !== null)
          candidateSnapshots.set(
            renderGcCandidateKey(entry.candidate),
            entry.snapshot,
          );
      }
      for (const retained of currentPublicationPaths)
        retainedChunkPaths.add(retained);
      for (const entry of inventoryRenderChunkCacheDirectory({
        renderJobRoot,
        seams: scanSeams,
        tier,
      })) {
        candidates.push(entry.candidate);
        if (entry.snapshot !== null)
          candidateSnapshots.set(
            renderGcCandidateKey(entry.candidate),
            entry.snapshot,
          );
      }
    }
    const quarantineEntries: Array<{
      candidate: IAutoMovieProductionRenderGcCandidate;
      snapshot: IRenderGcTargetSnapshot;
    }> = [];
    for (const entry of inventoryRenderQuarantineRoots({
      roots: [
        { base: root, logical: "project" },
        { base: productionStateRoot, logical: "production" },
        { base: renderJobRoot, logical: "render-job" },
        { base: path.join(renderJobRoot, "proxy"), logical: "proxy" },
        { base: path.join(renderJobRoot, "final"), logical: "final" },
        { base: renderRoot, logical: "publication" },
      ],
      seams: scanSeams,
    })) {
      if (entry.snapshot === null) candidates.push(entry.candidate);
      else
        quarantineEntries.push({
          candidate: entry.candidate,
          snapshot: entry.snapshot,
        });
    }

    const quarantineEntryByTarget = new Map(
      quarantineEntries.map((entry) => [entry.snapshot.target, entry]),
    );
    for (const inventory of inventoryRenderQuarantineCandidates(
      quarantineEntries.map((entry) => entry.snapshot),
    )) {
      const entry = quarantineEntryByTarget.get(inventory.marker.target);
      if (entry === undefined)
        throw new Error("Render quarantine inventory lost its candidate.");
      const key = renderGcCandidateKey(entry.candidate);
      entry.candidate.bytes = inventory.bytes;
      entry.candidate.fingerprint =
        inventory.evidence === null
          ? inventory.marker.contentFingerprint
          : digestAutoMovieBytes(
              Buffer.from(
                `${inventory.marker.contentFingerprint}\0${inventory.evidence.contentFingerprint}`,
              ),
            );
      entry.candidate.observation =
        inventory.evidence === null
          ? {
              state: "observation-conflict",
              authority: "none",
              stage: "reference",
              reason:
                "the quarantine marker does not bind one unique preserved generation",
            }
          : null;
      const treeProtection = quarantinedRenderChunkPointerProtection({
        adjudication: inventory.adjudication,
        candidates,
        retained: retainedChunkPaths,
      });
      if (treeProtection !== null) {
        entry.candidate.observation = treeProtection.observation;
        const treePaths = new Set(treeProtection.treePaths);
        for (const candidate of candidates)
          if (
            treePaths.has(candidate.path) &&
            (candidate.observation === null ||
              candidate.observation.authority !== "none")
          )
            candidate.observation = treeProtection.observation;
      }
      candidates.push(entry.candidate);
      candidateSnapshots.set(key, inventory.marker);
      if (inventory.evidence !== null)
        quarantineEvidenceSnapshots.set(key, inventory.evidence);
    }
    const sweptPublicationRoots: string[] = [];
    const sweptPublicationTargets = new Set<string>();
    const proxyRoot = path.join(renderRoot, "deliverables", "proxy");
    if (renderHost.filesystem.existsSync(proxyRoot)) {
      const currentProxy = plans.find((plan) => plan.tier.kind === "proxy");
      for (const entry of renderHost.filesystem
        .readdirSync(proxyRoot, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        if (/^[0-9a-f]{64}$/u.test(entry.name) === false) continue;
        const target = path.join(proxyRoot, entry.name);
        const relative = normalizeSlash(path.relative(renderRoot, target));
        const logical = `publication/${relative}`;
        if (
          entry.isSymbolicLink() ||
          (entry.isDirectory() === false && entry.isFile() === false)
        ) {
          candidates.push({
            path: logical,
            kind: "publication",
            digest: null,
            bytes: null,
            generation: null,
            fingerprint: null,
            observation: {
              state: "unsafe-locator",
              authority: "none",
              stage: "locator",
              reason:
                "the proxy publication locator is not one resident physical file or directory",
            },
          });
          sweptPublicationTargets.add(relative);
          continue;
        }
        const retainedByManifest = [...publicationPaths].some(
          (file) => file === logical || file.startsWith(`${logical}/`),
        );
        let integrityFailed = false;
        let adjudicated: {
          snapshot: IRenderGcTargetSnapshot;
          value: boolean;
        };
        try {
          adjudicated = captureProxyPublicationGcTarget({
            renderRoot,
            target,
            judge: (snapshot, evidence) => {
              try {
                const receipt = inspectCapturedProxyBundle(snapshot, evidence);
                return (
                  currentProxy !== undefined &&
                  entry.name ===
                    renderPublicationFingerprint(currentProxy).slice(7) &&
                  receipt.publicationFingerprint ===
                    renderPublicationFingerprint(currentProxy) &&
                  receipt.compileFingerprint ===
                    currentProxy.compileFingerprint &&
                  receipt.editFingerprint === currentProxy.editFingerprint
                );
              } catch {
                integrityFailed = true;
                return false;
              }
            },
          });
        } catch {
          candidates.push({
            path: logical,
            kind: "publication",
            digest: null,
            bytes: null,
            generation: null,
            fingerprint: null,
            observation: {
              state: "unavailable",
              authority: "none",
              stage: "capture",
              reason:
                "the proxy publication generation could not be captured consistently",
            },
          });
          if (entry.isDirectory()) sweptPublicationRoots.push(`${relative}/`);
          else sweptPublicationTargets.add(relative);
          continue;
        }
        const current = adjudicated.value;
        if (current) {
          if (adjudicated.snapshot.kind === "file")
            publicationPaths.add(logical);
          else
            for (const entry of adjudicated.snapshot.entries) {
              if (entry.kind !== "file") continue;
              const file = path.join(
                adjudicated.snapshot.target,
                ...entry.path.split("/"),
              );
              publicationPaths.add(
                `publication/${normalizeSlash(path.relative(renderRoot, file))}`,
              );
            }
          continue;
        }
        const candidate: IAutoMovieProductionRenderGcCandidate = {
          path: logical,
          kind: "publication",
          digest: null,
          bytes: adjudicated.snapshot.bytes,
          generation: adjudicated.snapshot.targetIdentity,
          fingerprint: adjudicated.snapshot.contentFingerprint,
          observation: retainedByManifest
            ? {
                state: "observation-conflict",
                authority: "none",
                stage: "reference",
                reason:
                  "the aggregate manifest references a proxy bundle that did not verify as current",
              }
            : integrityFailed
              ? {
                  state: "integrity-failed",
                  authority: "exact-quarantine",
                  stage: "inventory",
                  reason:
                    "the proxy bundle failed receipt, inventory, or digest verification",
                }
              : null,
        };
        candidates.push(candidate);
        candidateSnapshots.set(
          renderGcCandidateKey(candidate),
          adjudicated.snapshot,
        );
        if (adjudicated.snapshot.kind === "file")
          sweptPublicationTargets.add(relative);
        else sweptPublicationRoots.push(`${relative}/`);
      }
    }
    const unsafePublicationTargets: string[] = [];
    const unavailablePublicationTargets: string[] = [];
    if (renderHost.filesystem.existsSync(renderRoot)) {
      for (const file of listRenderGcPhysicalFiles({
        compareCodeUnits,
        directory: renderRoot,
        filesystem: renderHost.filesystem,
        unavailableLocators: unavailablePublicationTargets,
        unsafeLocators: unsafePublicationTargets,
      })) {
        const relative = normalizeSlash(path.relative(renderRoot, file));
        if (isRenderGcPreservedPath(relative)) continue;
        if (sweptPublicationTargets.has(relative)) continue;
        if (sweptPublicationRoots.some((root) => relative.startsWith(root)))
          continue;
        const candidate: IAutoMovieProductionRenderGcCandidate = {
          path: `publication/${relative}`,
          kind: "publication",
          digest: null,
          bytes: null,
          generation: null,
          fingerprint: null,
          observation: null,
        };
        let snapshot: IRenderGcTargetSnapshot;
        try {
          snapshot = props.captureTarget(renderRoot, file);
        } catch {
          candidate.observation = {
            state: "unavailable",
            authority: "none",
            stage: "capture",
            reason: "the publication target could not be captured consistently",
          };
          candidates.push(candidate);
          continue;
        }
        candidate.bytes = snapshot.bytes;
        candidate.generation = snapshot.targetIdentity;
        candidate.fingerprint = snapshot.contentFingerprint;
        candidates.push(candidate);
        candidateSnapshots.set(renderGcCandidateKey(candidate), snapshot);
      }
      for (const target of unsafePublicationTargets) {
        const relative = normalizeSlash(path.relative(renderRoot, target));
        if (isRenderGcPreservedPath(relative)) continue;
        if (sweptPublicationTargets.has(relative)) continue;
        if (sweptPublicationRoots.some((root) => relative.startsWith(root)))
          continue;
        candidates.push({
          path: `publication/${relative}`,
          kind: "publication",
          digest: null,
          bytes: null,
          generation: null,
          fingerprint: null,
          observation: {
            state: "unsafe-locator",
            authority: "none",
            stage: "locator",
            reason:
              "the publication locator is a symbolic link and remains outside automatic cleanup authority",
          },
        });
      }
      for (const target of unavailablePublicationTargets) {
        const relative = normalizeSlash(path.relative(renderRoot, target));
        if (isRenderGcPreservedPath(relative)) continue;
        if (sweptPublicationTargets.has(relative)) continue;
        if (sweptPublicationRoots.some((root) => relative.startsWith(root)))
          continue;
        candidates.push({
          path: `publication/${relative}`,
          kind: "publication",
          digest: null,
          bytes: null,
          generation: null,
          fingerprint: null,
          observation: {
            state: "unavailable",
            authority: "none",
            stage: "capture",
            reason:
              "the publication directory could not be inventoried consistently",
          },
        });
      }
    }
    const plan = planProductionRenderGc({
      plans,
      publicationPaths: [...publicationPaths],
      retainedChunkPaths: [...retainedChunkPaths],
      retainedCachePaths: [...retainedCachePaths],
      candidates,
    });
    soundRetention.assertCurrent();
    if (apply) {
      const targets = bindRenderGcApplyTargets({
        assertCaptured: assertCapturedRenderTarget,
        evidence: quarantineEvidenceSnapshots,
        expected,
        plan,
        snapshots: candidateSnapshots,
      });
      const quarantines = new Map<string, string>();
      for (const target of targets.remove) {
        const base = target.snapshot.base.path;
        let quarantine = quarantines.get(base);
        if (quarantine === undefined) {
          quarantine = ensureRenderPhysicalDirectory(
            base,
            RENDER_GC_REMOVAL_STAGING_DIRECTORY,
          );
          quarantines.set(base, quarantine);
        }
        if (target.evidence !== undefined)
          removeCapturedRenderQuarantine({
            evidence: target.evidence,
            marker: target.snapshot,
            quarantine,
          });
        else
          props.removeTarget({
            isolated: path.join(quarantine, renderHost.randomUuid()),
            quarantine,
            snapshot: target.snapshot,
          });
      }
      for (const target of targets.quarantine) {
        const preserved = ensureRenderPhysicalDirectory(
          target.snapshot.base.path,
          RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY,
        );
        const markers = ensureRenderPhysicalDirectory(
          target.snapshot.base.path,
          "quarantine",
        );
        quarantineCapturedRenderTarget({
          adjudication: target.decision.receipt,
          destination: path.join(markers, `${renderHost.randomUuid()}.json`),
          isolated: path.join(preserved, renderHost.randomUuid()),
          quarantine: preserved,
          snapshot: target.snapshot,
        });
      }
    }
    soundRetention.assertCurrent();
    return { applied: apply, ...plan };
  };

  const assertNoLiveRenderWorkers = (): void => {
    for (const tier of ["proxy", "final"] as const) {
      const tierRoot = path.join(renderJobRoot, tier);
      const locks = path.join(tierRoot, "locks");
      if (renderHost.filesystem.existsSync(locks))
        for (const file of listRenderGcPhysicalFiles({
          compareCodeUnits,
          directory: locks,
          filesystem: renderHost.filesystem,
        }).filter((candidate) => candidate.endsWith(".lock"))) {
          const snapshot = captureExistingRenderTarget(tierRoot, file);
          if (snapshot === null) continue;
          const owner = readCapturedRenderJson<IRenderChunkLockOwner>(
            snapshot,
            RENDER_LOCK_JSON_MAX_BYTES,
          );
          if (isRenderChunkLockOwner(owner) === false)
            throw new Error(
              `Render GC --apply refuses ${tier} worker at "${file}" because its owner record is invalid.`,
            );
          const recovery = observeRenderOwnerRecovery({
            between: () => assertCapturedRenderTarget(snapshot),
            observe: renderHost.observeProcessOwner,
            owner: owner.owner,
          });
          if (recovery.state !== "reclaimable")
            throw new Error(
              `Render GC --apply refuses ${tier} worker ${owner.owner.pid} at "${file}" because its owner is ${recovery.observation.state}.`,
            );
        }
      const attempts = path.join(tierRoot, "attempts");
      for (const captured of listRenderAttempts(tierRoot, attempts)) {
        const attempt = captured.record;
        const file = captured.snapshot.target;
        if (attempt.state === "running") {
          const recovery = observeRenderOwnerRecovery({
            between: () => assertCapturedRenderTarget(captured.snapshot),
            observe: renderHost.observeProcessOwner,
            owner: attempt.owner,
          });
          if (recovery.state !== "reclaimable")
            throw new Error(
              `Render GC --apply refuses ${tier} attempt ${attempt.owner.pid} at "${file}" because its owner is ${recovery.observation.state}.`,
            );
        }
      }
    }
  };

  const normalizeSlash = (value: string): string => value.replaceAll("\\", "/");

  const recoverAbandonedTemporaryDirectories = (
    chunks: readonly IAutoMovieProductionRenderChunk[],
  ): void => {
    const currentChunks = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    const locks = path.join(stateRoot, "locks");
    if (renderHost.filesystem.existsSync(locks))
      for (const slot of renderHost.filesystem
        .readdirSync(locks, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => compareCodeUnits(left.name, right.name)))
        for (const entry of renderHost.filesystem
          .readdirSync(path.join(locks, slot.name), { withFileTypes: true })
          .filter((candidate) => candidate.name.endsWith(".candidate"))
          .sort((left, right) => compareCodeUnits(left.name, right.name))) {
          const target = path.join(locks, slot.name, entry.name);
          const snapshot = captureAbandonedRenderStateTarget(
            target,
            (captured) => {
              const candidate = readCapturedRenderJson<IRenderChunkLockOwner>(
                captured,
                RENDER_LOCK_JSON_MAX_BYTES,
              );
              return isRenderChunkLockOwner(candidate) ? candidate.owner : null;
            },
          );
          if (snapshot === null) continue;
          quarantine(target, "abandoned-lock-candidate", snapshot);
        }
    const directory = path.join(stateRoot, "tmp");
    if (renderHost.filesystem.existsSync(directory) === false) return;
    for (const entry of renderHost.filesystem
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const target = path.join(directory, entry.name);
      const identity = temporaryTreeOwner(entry.name);
      if (identity === null) continue;
      const snapshot = captureAbandonedRenderStateTarget(
        target,
        () => identity,
      );
      if (snapshot === null) continue;
      if (currentPublicationProtectsTree(currentChunks, entry.name, snapshot))
        continue;
      quarantine(target, "abandoned-partial", snapshot);
    }
  };

  const quarantineStaleSlotOutputs = (
    plan: IAutoMovieProductionRenderJobPlan,
  ): void => {
    const chunks = plan.chunks;
    const currentIds = new Set(chunks.map((chunk) => chunk.id));
    const currentChunks = new Map(
      chunks.map((chunk) => [chunk.slot, chunk.id]),
    );
    const pointerPrefix = `.automovie-chunk-${renderLivenessScope}.${renderTier.kind}.`;
    for (const name of renderHost.filesystem
      .readdirSync(root)
      .filter(
        (candidate) =>
          candidate.startsWith(pointerPrefix) &&
          candidate.endsWith(".publication.json"),
      )
      .sort(compareCodeUnits)) {
      const pointer = path.join(root, name);
      const digest = `sha256:${name.slice(
        pointerPrefix.length,
        -".publication.json".length,
      )}` as AutoMovieContentDigest;
      let pointerSnapshot: IRenderGcTargetSnapshot;
      try {
        pointerSnapshot = props.captureTarget(root, pointer);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      let current = false;
      const expected = currentIds.has(digest)
        ? chunks.find((chunk) => chunk.id === digest)
        : undefined;
      if (expected !== undefined) {
        const inspection = props.inspectChunk(plan, expected, pointerSnapshot);
        if (inspection.finding.state === "current") continue;
        if (inspection.finding.state !== "verified-stale") continue;
        removeCapturedRenderChunkPointer(pointerSnapshot);
        continue;
      }
      try {
        const publication =
          captureRenderChunkPublicationFromPointer(pointerSnapshot);
        current =
          currentIds.has(digest) &&
          publication.receipt.chunk === digest &&
          currentChunks.get(publication.receipt.slot) === digest;
      } catch {
        // A pointer that cannot authenticate its generation is unresolved. It
        // remains in place so render cannot reinterpret it as absence.
        continue;
      }
      if (current === false) removeCapturedRenderChunkPointer(pointerSnapshot);
    }
    const directory = path.join(stateRoot, "chunks");
    if (renderHost.filesystem.existsSync(directory) === false) return;
    for (const entry of renderHost.filesystem
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => compareCodeUnits(left.name, right.name))) {
      const target = path.join(directory, entry.name);
      const receiptFile = path.join(target, "receipt.json");
      const receiptSnapshot = captureExistingRenderStateTarget(receiptFile);
      if (receiptSnapshot === null || receiptSnapshot.kind !== "file") continue;
      let receipt: IAutoMovieProductionRenderChunkReceipt;
      try {
        receipt =
          readCapturedRenderJson<IAutoMovieProductionRenderChunkReceipt>(
            receiptSnapshot,
          );
      } catch {
        // An unreadable unrelated directory has no trustworthy slot ownership.
        continue;
      }
      const currentChunk = currentChunks.get(receipt.slot);
      if (currentChunk !== undefined && receipt.chunk !== currentChunk) {
        const snapshot = captureExistingRenderStateTarget(target);
        if (snapshot === null || snapshot.kind !== "directory") continue;
        assertCapturedRenderGcFileEntry({
          directory: snapshot,
          file: receiptSnapshot,
          relative: "receipt.json",
        });
        try {
          quarantine(target, "stale-slot", snapshot);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
    }
  };

  const captureCurrentChunkPointer = (
    chunk: IAutoMovieProductionRenderChunk,
  ): IRenderGcTargetSnapshot | null => {
    try {
      return props.captureTarget(root, chunkDirectory(chunk.id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  };

  const currentChunkPointerLocatorState = (
    chunk: IAutoMovieProductionRenderChunk,
  ): "absent" | "resident" | "unsafe" | "unavailable" => {
    try {
      const status = renderHost.filesystem.lstatSync(chunkDirectory(chunk.id));
      return status.isSymbolicLink() ||
        (status.isFile() === false && status.isDirectory() === false)
        ? "unsafe"
        : "resident";
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "absent"
        : "unavailable";
    }
  };

  const currentPublicationProtectsTree = (
    chunks: ReadonlyMap<
      AutoMovieContentDigest,
      IAutoMovieProductionRenderChunk
    >,
    candidateName: string,
    candidate: IRenderGcTargetSnapshot,
  ): boolean => {
    return currentRenderChunkPublicationProtectsTree({
      candidate,
      candidateName,
      chunks,
      capture: (chunk) => {
        const pointer = captureCurrentChunkPointer(chunk);
        return pointer === null
          ? null
          : captureRenderChunkPublicationFromPointer(pointer);
      },
    });
  };

  const captureExistingRenderStateTarget = (
    target: string,
  ): IRenderGcTargetSnapshot | null =>
    captureExistingRenderTarget(stateRoot, target);

  const captureExistingRenderTarget = (
    base: string,
    target: string,
  ): IRenderGcTargetSnapshot | null => {
    try {
      return props.captureTarget(base, target);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code === "ENOENT" ||
        (error as NodeJS.ErrnoException).code === "ENOTDIR"
      )
        return null;
      throw error;
    }
  };

  const captureAbandonedRenderStateTarget = (
    target: string,
    ownerOf: (snapshot: IRenderGcTargetSnapshot) => unknown,
  ): IRenderGcTargetSnapshot | null => {
    try {
      const snapshot = captureExistingRenderStateTarget(target);
      if (snapshot === null) return null;
      const owner = ownerOf(snapshot);
      if (isAutoMovieLocalProcessOwner(owner) === false) return null;
      if (
        observeRenderOwnerRecovery({
          between: () => assertCapturedRenderTarget(snapshot),
          observe: renderHost.observeProcessOwner,
          owner,
        }).state !== "reclaimable"
      )
        return null;
      assertCapturedRenderTarget(snapshot);
      return snapshot;
    } catch {
      return null;
    }
  };

  const temporaryTreeOwner = (
    name: string,
  ): IAutoMovieLocalProcessOwner | null => {
    const match = /^[0-9a-f]{64}\.[^.]+\.(.+)$/u.exec(name);
    return match === null ? null : parseRenderProcessOwnerSuffix(match[1]);
  };

  const readCapturedRenderJson = <T>(
    snapshot: IRenderGcTargetSnapshot,
    maximumBytes: number = snapshot.bytes,
  ): T => {
    const bytes = readCapturedRenderGcFile(snapshot, maximumBytes);
    try {
      return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
    } catch {
      throw new Error("Captured render JSON is unreadable.");
    }
  };

  const removeOwnedChunkClaim = (
    snapshot: IRenderGcTargetSnapshot,
  ): "lost" | "removed" => {
    const quarantine = ensureRenderPhysicalDirectory(
      stateRoot,
      RENDER_GC_REMOVAL_STAGING_DIRECTORY,
    );
    const isolated = path.join(quarantine, renderHost.randomUuid());
    try {
      props.removeTarget({ isolated, quarantine, snapshot });
      return "removed";
    } catch (error) {
      if (renderHost.filesystem.existsSync(isolated)) throw error;
      let successor: IRenderGcTargetSnapshot | null;
      try {
        successor = captureExistingRenderStateTarget(snapshot.target);
      } catch (inspectionError) {
        throw new AggregateError(
          [error, inspectionError],
          "Owned chunk claim removal failed and successor inspection also failed.",
          { cause: error },
        );
      }
      if (
        successor !== null &&
        (successor.targetIdentity !== snapshot.targetIdentity ||
          successor.contentFingerprint !== snapshot.contentFingerprint ||
          successor.namespaceFingerprint !== snapshot.namespaceFingerprint)
      )
        return "lost";
      if (successor === null) return "lost";
      throw error;
    }
  };

  const quarantine = (
    target: string,
    reason: string,
    captured?: IRenderGcTargetSnapshot,
  ): void => {
    const absolute = path.resolve(target);
    const prefix = `${path.resolve(stateRoot)}${path.sep}`;
    if (absolute.startsWith(prefix) === false)
      throw new Error(
        `Refusing to quarantine path outside render state: ${target}`,
      );
    const snapshot = captured ?? props.captureTarget(stateRoot, absolute);
    if (snapshot.target !== absolute)
      throw new Error(
        `Render quarantine target "${target}" changed namespace.`,
      );
    const directory = ensureRenderPhysicalDirectory(stateRoot, "quarantine");
    const preserved = ensureRenderPhysicalDirectory(
      stateRoot,
      RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY,
    );
    quarantineCapturedRenderTarget({
      destination: path.join(
        directory,
        `${path.basename(target)}.${reason}.${renderHost.now()}.${renderHost.pid}.${renderHost.randomUuid()}`,
      ),
      isolated: path.join(preserved, renderHost.randomUuid()),
      quarantine: preserved,
      snapshot,
    });
  };

  return {
    captureCurrentChunkPointer,
    currentChunkPointerLocatorState,
    captureExistingRenderStateTarget,
    collect: renderGarbageCollection,
    quarantine,
    quarantineStaleSlotOutputs,
    readCapturedRenderJson,
    recoverAbandonedTemporaryDirectories,
    removeOwnedChunkClaim,
  };
};
