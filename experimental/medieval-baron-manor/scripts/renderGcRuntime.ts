import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  AutoMovieProductionProject,
  type IAutoMovieLocalProcessOwner,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderGcCandidate,
  type IAutoMovieProductionRenderGcPlan,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderTier,
  isAutoMovieLocalProcessOwner,
  parseAutoMovieStructuredJson,
  planProductionRenderGc,
  readAutoMovieFilmTimeline,
  verifyProductionRenderChunkReceipt,
} from "@automovie/production";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { inspectCapturedProxyBundle } from "./assertProxyBundle";
import { captureProxyPublicationGcTarget } from "./publishProxyBundle";
import { listRenderAttempts } from "./renderAttemptSnapshot";
import type { IProductionRenderChunkInspection } from "./renderChunkInspection";
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
  type IRenderGcScanSeams,
  bindRenderGcApplyTargets,
  bindRenderQuarantineCandidates,
  inventoryRenderChunkCacheDirectory,
  inventoryRenderPublicationDirectory,
  inventoryRenderQuarantineRoots,
  listRenderGcPhysicalFiles,
  renderGcCandidateKey,
  renderGcRelativePath,
  runProductionRenderGarbageCollection,
} from "./renderGcCollection";
import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_QUARANTINE_EVIDENCE_DIRECTORY,
  RENDER_GC_REMOVAL_STAGING_DIRECTORY,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  ensureRenderPhysicalDirectory,
  inventoryRenderQuarantineCandidates,
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
import { parseRenderProcessOwnerSuffix } from "./renderProcessOwner";
import type { IProductionSoundRuntime } from "./renderSoundRuntime";
import { inventoryProductionSoundCaches } from "./soundCacheSnapshot";

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
      productionStateRoot,
      seams: {
        assertCaptured: assertCapturedRenderTarget,
        captureTarget: props.captureTarget,
      },
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

    for (const bound of bindRenderQuarantineCandidates({
      candidates,
      entries: quarantineEntries,
      inventory: inventoryRenderQuarantineCandidates,
      retained: retainedChunkPaths,
    })) {
      const key = renderGcCandidateKey(bound.candidate);
      candidates.push(bound.candidate);
      candidateSnapshots.set(key, bound.marker);
      if (bound.evidence !== null)
        quarantineEvidenceSnapshots.set(key, bound.evidence);
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
        const relative = renderGcRelativePath(renderRoot, target);
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
                `publication/${renderGcRelativePath(renderRoot, file)}`,
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
    if (renderHost.filesystem.existsSync(renderRoot))
      for (const entry of inventoryRenderPublicationDirectory({
        renderRoot,
        seams: scanSeams,
        sweptRoots: sweptPublicationRoots,
        sweptTargets: sweptPublicationTargets,
      })) {
        candidates.push(entry.candidate);
        if (entry.snapshot !== null)
          candidateSnapshots.set(
            renderGcCandidateKey(entry.candidate),
            entry.snapshot,
          );
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
      return parseAutoMovieStructuredJson({
        record: "captured-render-record",
        bytes,
      }) as T;
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
