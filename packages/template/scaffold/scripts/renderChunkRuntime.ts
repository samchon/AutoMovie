import {
  renderAutoMovieSemanticMaskSidecar,
  resolveProductionFrameRate,
} from "@automovie/engine";
import type {
  AutoMovieCaptureObservation,
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieRenderReport,
} from "@automovie/interface";
import {
  type AutoMovieLocalProcessOwnerObservation,
  type IAutoMovieLocalProcessOwner,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderJobPlan,
  assertProductionRenderDialogueRuntimeIdentity,
  assertProductionVideoProfile,
  canonicalAutoMovieCaptureRuntimeIdentity,
  classifyAutoMovieProductionSemanticMaskEvidence,
  createAutoMovieProductionSemanticMaskReceipt,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  isAutoMovieLocalProcessOwner,
  probeProductionMedia,
  probeProductionVideoMp4,
  productionRenderLayersForPass,
  productionRenderMaterializationDecision,
  resolveProductionVideoProfile,
} from "@automovie/production";
import path from "node:path";
import type { PNG } from "pngjs";

import {
  type IOwnedRenderAttemptSnapshot,
  beginRenderAttempt,
  completeRenderAttempt,
  failRenderAttempt,
} from "./renderAttemptSnapshot";
import { productionRenderFrameCaptureInput } from "./renderFrameCaptureInput";
import {
  type IRenderGcTargetSnapshot,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  createRenderGcFileSnapshot,
} from "./renderGcSnapshot";
import type { IProductionRenderHost } from "./renderHost";
import type {
  IProductionMaskSidecarPublication,
  IProductionRenderObservationAudit,
} from "./renderObservationAudit";
import { observeRenderOwnerRecovery } from "./renderOwnerState";
import type { IProductionRenderChunkInspection } from "./renderPlanningRuntime";
import { renderProcessOwnerSuffix } from "./renderProcessOwner";
import { runWithProductionRuntimeClosure } from "./renderSoundRuntime";
import {
  type IRenderChunkTemporaryTree,
  assertRenderChunkTemporaryTree,
} from "./renderTemporarySnapshot";

export const RENDER_LOCK_JSON_MAX_BYTES = 64 * 1024;

export interface IRenderChunkLockOwner {
  version: 2;
  chunk: AutoMovieContentDigest;
  owner: IAutoMovieLocalProcessOwner;
  token: string;
}

/** Validate the complete generation-aware chunk-lock record before use. */
export const isRenderChunkLockOwner = (
  value: unknown,
): value is IRenderChunkLockOwner =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray(value) === false &&
  Object.keys(value).sort(compareCodeUnits).join(",") ===
    "chunk,owner,token,version" &&
  (value as { version?: unknown }).version === 2 &&
  typeof (value as { chunk?: unknown }).chunk === "string" &&
  /^sha256:[0-9a-f]{64}$/u.test((value as { chunk: string }).chunk) &&
  isAutoMovieLocalProcessOwner((value as { owner?: unknown }).owner) &&
  typeof (value as { token?: unknown }).token === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
    (value as { token: string }).token,
  );

export interface IProductionRenderChunkLeaseHost {
  filesystem: Pick<
    typeof import("node:fs"),
    "existsSync" | "mkdirSync" | "readdirSync"
  >;
  observeProcessOwner: (
    owner: unknown,
  ) => AutoMovieLocalProcessOwnerObservation;
  owner: IAutoMovieLocalProcessOwner;
  randomUuid: () => string;
}

export interface IProductionRenderChunkLeaseRuntime {
  acquire: (chunk: IAutoMovieProductionRenderChunk) => Promise<boolean>;
  begin: (
    chunk: IAutoMovieProductionRenderChunk,
  ) => IOwnedRenderAttemptSnapshot;
  complete: (chunk: IAutoMovieProductionRenderChunk) => void;
  fail: (
    chunk: IAutoMovieProductionRenderChunk,
    correction: string,
  ) => Promise<void>;
  release: (chunk: IAutoMovieProductionRenderChunk) => Promise<void>;
}

/** Own one invocation's chunk claims and attempt transitions. */
export const createProductionRenderChunkLeaseRuntime = (props: {
  captureExisting: (target: string) => IRenderGcTargetSnapshot | null;
  host: IProductionRenderChunkLeaseHost;
  quarantine: (
    target: string,
    reason: string,
    snapshot: IRenderGcTargetSnapshot,
  ) => void;
  readJson: <Value>(
    snapshot: IRenderGcTargetSnapshot,
    maximumBytes: number,
  ) => Value;
  remove: (snapshot: IRenderGcTargetSnapshot) => "lost" | "removed";
  stateRoot: string;
}): IProductionRenderChunkLeaseRuntime => {
  const heldLocks = new Map<
    string,
    { snapshot: IRenderGcTargetSnapshot; token: string }
  >();
  const heldAttempts = new Map<string, IOwnedRenderAttemptSnapshot>();
  const attemptPath = (chunk: IAutoMovieProductionRenderChunk): string =>
    path.join(
      props.stateRoot,
      "attempts",
      `${encodeAutoMoviePathSegment(chunk.slot)}.json`,
    );
  const legacyLockPath = (chunk: IAutoMovieProductionRenderChunk): string =>
    path.join(
      props.stateRoot,
      "locks",
      `${encodeAutoMoviePathSegment(chunk.slot)}.lock`,
    );
  const lockDirectory = (chunk: IAutoMovieProductionRenderChunk): string =>
    path.join(props.stateRoot, "locks", encodeAutoMoviePathSegment(chunk.slot));
  const lockClaims = (chunk: IAutoMovieProductionRenderChunk): string[] => {
    const directory = lockDirectory(chunk);
    const claims = props.host.filesystem.existsSync(directory)
      ? props.host.filesystem
          .readdirSync(directory, { withFileTypes: true })
          .filter((entry) => entry.name.endsWith(".lock"))
          .map((entry) => path.join(directory, entry.name))
      : [];
    const legacy = legacyLockPath(chunk);
    if (props.host.filesystem.existsSync(legacy)) claims.push(legacy);
    return claims.sort(compareCodeUnits);
  };
  const releaseOwnedClaim = (
    chunk: IAutoMovieProductionRenderChunk,
    token: string,
    captured: IRenderGcTargetSnapshot,
  ): void => {
    let owner: IRenderChunkLockOwner;
    try {
      owner = props.readJson<IRenderChunkLockOwner>(
        captured,
        RENDER_LOCK_JSON_MAX_BYTES,
      );
    } catch {
      // A missing, unreadable, or replaced claim is not proven to be ours.
      return;
    }
    if (
      isRenderChunkLockOwner(owner) === false ||
      owner.chunk !== chunk.id ||
      props.host.observeProcessOwner(owner.owner).state !== "same-owner" ||
      owner.token !== token
    )
      return;
    props.remove(captured);
  };
  const acquire = async (
    chunk: IAutoMovieProductionRenderChunk,
  ): Promise<boolean> => {
    const directory = lockDirectory(chunk);
    props.host.filesystem.mkdirSync(directory, { recursive: true });
    const token = props.host.randomUuid();
    const claim = path.join(
      directory,
      `claim.${props.host.owner.pid}.${token}.lock`,
    );
    const claimSnapshot = createRenderGcFileSnapshot(
      props.stateRoot,
      claim,
      Buffer.from(
        `${JSON.stringify({ version: 2, chunk: chunk.id, owner: props.host.owner, token })}\n`,
      ),
    );
    try {
      for (const file of lockClaims(chunk)) {
        let owner: IRenderChunkLockOwner;
        const snapshot =
          file === claim ? claimSnapshot : props.captureExisting(file);
        if (snapshot === null) continue;
        try {
          owner = props.readJson<IRenderChunkLockOwner>(
            snapshot,
            RENDER_LOCK_JSON_MAX_BYTES,
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw new Error(
            `Chunk lock "${file}" has no readable owner identity. Verify that no render worker owns it, then quarantine it before retrying.`,
          );
        }
        if (isRenderChunkLockOwner(owner) === false || owner.chunk !== chunk.id)
          throw new Error(
            `Chunk lock "${file}" has an invalid owner record. Verify that no render worker owns it, then quarantine it before retrying.`,
          );
        const first = props.host.observeProcessOwner(owner.owner);
        if (file === claim) {
          if (first.state !== "same-owner" || owner.token !== token)
            throw new Error(
              `Chunk lock claim "${claim}" changed before rendering began.`,
            );
          continue;
        }
        let firstConsumed = false;
        const recovery = observeRenderOwnerRecovery({
          between: () => assertCapturedRenderTarget(snapshot),
          observe: (candidate) => {
            if (firstConsumed === false) {
              firstConsumed = true;
              return first;
            }
            return props.host.observeProcessOwner(candidate);
          },
          owner: owner.owner,
        });
        if (recovery.state !== "reclaimable") {
          releaseOwnedClaim(chunk, token, claimSnapshot);
          const state = recovery.observation.state;
          if (state === "unknown" || state === "elsewhere")
            throw new Error(
              `Chunk lock "${file}" has ${state} owner state and cannot be reclaimed.`,
            );
          return false;
        }
        try {
          props.quarantine(file, "abandoned-lock", snapshot);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      }
      const owner = props.readJson<IRenderChunkLockOwner>(
        claimSnapshot,
        RENDER_LOCK_JSON_MAX_BYTES,
      );
      if (
        isRenderChunkLockOwner(owner) === false ||
        owner.chunk !== chunk.id ||
        props.host.observeProcessOwner(owner.owner).state !== "same-owner" ||
        owner.token !== token
      )
        throw new Error(
          `Chunk lock claim "${claim}" changed before rendering began.`,
        );
      heldLocks.set(chunk.slot, { snapshot: claimSnapshot, token });
      return true;
    } catch (error) {
      try {
        releaseOwnedClaim(chunk, token, claimSnapshot);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Chunk lock acquisition failed and its owned claim could not be cleaned up.",
          { cause: error },
        );
      }
      throw error;
    }
  };
  const begin = (
    chunk: IAutoMovieProductionRenderChunk,
  ): IOwnedRenderAttemptSnapshot => {
    const held = heldLocks.get(chunk.slot);
    if (held === undefined)
      throw new Error(
        `Chunk "${chunk.slot}" cannot start an attempt without its held lock.`,
      );
    const attempt = beginRenderAttempt({
      base: props.stateRoot,
      chunk: chunk.id,
      lock: {
        chunk: chunk.id,
        owner: props.host.owner,
        snapshot: held.snapshot,
        token: held.token,
      },
      observeProcessOwner: props.host.observeProcessOwner,
      owner: props.host.owner,
      slot: chunk.slot,
      target: attemptPath(chunk),
      token: held.token,
    });
    heldAttempts.set(chunk.slot, attempt);
    return attempt;
  };
  return {
    acquire,
    begin,
    complete: (chunk) => {
      const attempt = heldAttempts.get(chunk.slot);
      if (attempt === undefined) return;
      completeRenderAttempt(attempt);
      heldAttempts.delete(chunk.slot);
    },
    fail: async (chunk, correction) => {
      const attempt = heldAttempts.get(chunk.slot);
      if (attempt === undefined) return;
      failRenderAttempt({ attempt, correction });
      heldAttempts.delete(chunk.slot);
    },
    release: async (chunk) => {
      heldAttempts.delete(chunk.slot);
      const held = heldLocks.get(chunk.slot);
      if (held === undefined) return;
      heldLocks.delete(chunk.slot);
      releaseOwnedClaim(chunk, held.token, held.snapshot);
    },
  };
};

export interface IProductionRenderInvocationObservationState {
  audits: IProductionRenderObservationAudit[];
  maskSidecars: Array<
    {
      globalFrame: number;
      pass: AutoMovieGuidePass;
      shot: string;
    } & (
      | ({ status: "available" } & IProductionMaskSidecarPublication)
      | { status: "not-run"; reason: string }
    )
  >;
}

/** Capture, encode, verify, and atomically publish one render chunk. */
export const createProductionRenderChunkCaptureRuntime = (props: {
  capture: IProductionRenderHost["capture"];
  captureCompleted: (root: string, target: string) => IRenderGcTargetSnapshot;
  createTemporary: (props: {
    name: string;
    state: IRenderGcTargetSnapshot["base"];
  }) => IRenderChunkTemporaryTree;
  inspect: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
  ) => Promise<IProductionRenderChunkInspection>;
  encode: (
    frames: readonly Uint8Array[],
    plan: IAutoMovieProductionRenderJobPlan,
  ) => Promise<Uint8Array>;
  lease: IProductionRenderChunkLeaseRuntime;
  observations: {
    audit: (props: {
      globalFrame: number;
      observation: Awaited<
        ReturnType<IProductionRenderHost["capture"]>
      >["observation"];
      pass: AutoMovieGuidePass;
      report: AutoMovieCaptureObservation<IAutoMovieRenderReport>;
      shot: string;
    }) => IProductionRenderObservationAudit;
    publishMask: (props: {
      chunk: AutoMovieContentDigest;
      shot: string;
      semanticMask: Awaited<
        ReturnType<IProductionRenderHost["capture"]>
      >["semanticMask"];
      stateRoot: string;
    }) =>
      | { status: "available"; value: IProductionMaskSidecarPublication }
      | { status: "not-run"; reason: string };
    state: IProductionRenderInvocationObservationState;
  };
  pngGeneration: IProductionRenderHost["pngGeneration"];
  owner: IAutoMovieLocalProcessOwner;
  productionId: string;
  publication: {
    publish: (props: {
      chunk: AutoMovieContentDigest;
      receipt: IAutoMovieProductionRenderChunkReceipt;
      root: string;
      scope: string;
      tier: "final" | "proxy";
      tree: IRenderGcTargetSnapshot;
    }) => {
      publication: { receipt: IAutoMovieProductionRenderChunkReceipt };
    };
  };
  renderLivenessScope: string;
  randomUuid: () => string;
  root: string;
  stateRoot: string;
  tier: "final" | "proxy";
  write: (props: {
    bytes: Uint8Array;
    file: string;
    ownership: IRenderChunkTemporaryTree;
  }) => IRenderGcTargetSnapshot;
}): {
  render: (
    plan: IAutoMovieProductionRenderJobPlan,
    chunk: IAutoMovieProductionRenderChunk,
    reports: ReadonlyMap<
      string,
      AutoMovieCaptureObservation<IAutoMovieRenderReport>
    >,
  ) => Promise<IAutoMovieProductionRenderChunkReceipt>;
} => ({
  render: (plan, chunk, reports) =>
    runWithProductionRuntimeClosure(
      props.pngGeneration.assertCurrent,
      async () => {
        const { PNG } = props.pngGeneration.module;
        const inspection = await props.inspect(plan, chunk);
        const materialization = productionRenderMaterializationDecision(
          inspection.finding.state,
        );
        if (materialization === "reuse") {
          if (inspection.current === null)
            throw new Error(
              `Chunk "${chunk.slot}" current finding has no verified publication.`,
            );
          return inspection.current.receipt;
        }
        if (materialization === "refuse")
          throw new Error(inspection.finding.reason);
        const attempt = props.lease.begin(chunk);
        const temporaryOwnership = props.createTemporary({
          name: `${chunk.id.slice(7)}.${props.randomUuid()}.${renderProcessOwnerSuffix(props.owner)}`,
          state: attempt.snapshot.base,
        });
        const temporary = temporaryOwnership.path;
        const frameReceipts: IAutoMovieProductionRenderChunkReceipt["frames"] =
          [];
        const semanticMasks: IAutoMovieProductionRenderChunkReceipt["semanticMasks"] =
          [];
        const frameBytes: Uint8Array[] = [];
        const writtenFiles: Array<{
          relative: string;
          snapshot: IRenderGcTargetSnapshot;
        }> = [];
        for (const sample of chunk.frames) {
          const images: Array<{ image: PNG; weight: number }> = [];
          const layers = productionRenderLayersForPass(sample, chunk.pass);
          for (const [layerIndex, layer] of layers.entries()) {
            const captured = await props.capture(
              productionRenderFrameCaptureInput({
                root: props.root,
                productionId: props.productionId,
                plan,
                shot: layer.shot,
                sourceFrame: layer.sourceFrame,
                sourceFps: plan.sourceFrameFormat.fps,
                sample,
                pass: chunk.pass,
              }),
            );
            assertProductionRenderDialogueRuntimeIdentity({
              boundary: `chunk ${chunk.slot} frame ${sample.globalFrame} layer ${layerIndex} pass ${chunk.pass}`,
              expected: plan.runtimeIdentity.dialogueRuntimeIdentity,
              observed: captured.dialogueRuntimeIdentity,
            });
            if (
              canonicalAutoMovieCaptureRuntimeIdentity(
                captured.runtimeIdentity,
              ) !==
              canonicalAutoMovieCaptureRuntimeIdentity(
                plan.runtimeIdentity.capture,
              )
            )
              throw new Error(
                `Capture runtime changed while rendering "${chunk.slot}". Replan before mixing renderer identities.`,
              );
            const report: AutoMovieCaptureObservation<IAutoMovieRenderReport> =
              reports.get(layer.shot) ?? {
                status: "not-run",
                reason: `render budget preflight published no assessment for shot "${layer.shot}"`,
              };
            props.observations.state.audits.push(
              props.observations.audit({
                globalFrame: sample.globalFrame,
                observation: captured.observation,
                pass: chunk.pass,
                report,
                shot: layer.shot,
              }),
            );
            const maskSidecar = props.observations.publishMask({
              chunk: chunk.id,
              shot: layer.shot,
              semanticMask: captured.semanticMask,
              stateRoot: props.stateRoot,
            });
            props.observations.state.maskSidecars.push(
              maskSidecar.status === "available"
                ? {
                    globalFrame: sample.globalFrame,
                    pass: chunk.pass,
                    shot: layer.shot,
                    status: "available",
                    ...maskSidecar.value,
                    path: normalizeSlash(
                      path.relative(props.root, maskSidecar.value.path),
                    ),
                  }
                : {
                    globalFrame: sample.globalFrame,
                    pass: chunk.pass,
                    shot: layer.shot,
                    status: "not-run",
                    reason: maskSidecar.reason,
                  },
            );
            if (chunk.pass === "mask") {
              const semanticStatus =
                classifyAutoMovieProductionSemanticMaskEvidence({
                  observation: captured.semanticMask,
                  expectedShot: layer.shot,
                });
              if (semanticStatus.status !== "complete")
                throw new Error(
                  `Semantic mask evidence for shot "${layer.shot}" at frame ${sample.globalFrame} is ${semanticStatus.status}: ${semanticStatus.reason}`,
                );
              const sidecarBytes = Buffer.from(
                renderAutoMovieSemanticMaskSidecar(
                  semanticStatus.evidence.mask,
                ),
                "utf8",
              );
              const relativeSidecar = `semantic/frame_${String(
                sample.globalFrame,
              ).padStart(
                8,
                "0",
              )}.${encodeAutoMoviePathSegment(layer.shot)}.mask.json`;
              writtenFiles.push({
                relative: relativeSidecar,
                snapshot: props.write({
                  bytes: sidecarBytes,
                  file: path.join(temporary, relativeSidecar),
                  ownership: temporaryOwnership,
                }),
              });
              semanticMasks.push(
                createAutoMovieProductionSemanticMaskReceipt({
                  frame: sample.globalFrame,
                  evidence: semanticStatus.evidence,
                  sidecar: { path: relativeSidecar, bytes: sidecarBytes },
                }),
              );
            }
            const image = PNG.sync.read(Buffer.from(captured.bytes));
            if (
              captured.width !== plan.frameFormat.width ||
              captured.height !== plan.frameFormat.height ||
              image.width !== plan.frameFormat.width ||
              image.height !== plan.frameFormat.height
            )
              throw new Error(
                `Capture for frame ${sample.globalFrame} reports ${captured.width}x${captured.height} and decodes as ${image.width}x${image.height}; expected ${plan.frameFormat.width}x${plan.frameFormat.height}.`,
              );
            if (hasProductionVisiblePixelVariance(image) === false)
              throw new Error(
                `Capture for frame ${sample.globalFrame} has no visible pixel variance. Fix the camera, lighting, scene, or pass before rendering.`,
              );
            images.push({ image, weight: layer.weight });
          }
          const bytes = compositeProductionCaptureLayers(
            images,
            plan.frameFormat.width,
            plan.frameFormat.height,
            props.pngGeneration.module,
          );
          const relative = `frame_${String(sample.globalFrame).padStart(
            8,
            "0",
          )}.${chunk.pass}.png`;
          writtenFiles.push({
            relative,
            snapshot: props.write({
              bytes,
              file: path.join(temporary, relative),
              ownership: temporaryOwnership,
            }),
          });
          const probe = probeProductionMedia({
            kind: "preview",
            mediaType: "image/png",
            bytes,
          });
          if (probe.kind !== "png")
            throw new Error(
              `Frame ${sample.globalFrame} did not decode as PNG.`,
            );
          frameBytes.push(bytes);
          frameReceipts.push({
            globalFrame: sample.globalFrame,
            path: relative,
            digest: digestAutoMovieBytes(bytes),
            bytes: bytes.length,
            width: probe.width,
            height: probe.height,
          });
        }
        const encodedBytes = await props.encode(frameBytes, plan);
        const encodedPath = "chunk.mp4";
        writtenFiles.push({
          relative: encodedPath,
          snapshot: props.write({
            bytes: encodedBytes,
            file: path.join(temporary, encodedPath),
            ownership: temporaryOwnership,
          }),
        });
        const encodedProbe = probeProductionVideoMp4(encodedBytes);
        assertProductionVideoProfile({
          expected: resolveProductionVideoProfile({
            width: plan.frameFormat.width,
            height: plan.frameFormat.height,
            frameRate: resolveProductionFrameRate(plan.frameFormat),
          }),
          actual: encodedProbe,
        });
        if (
          encodedProbe.frameCount !== chunk.frames.length ||
          encodedProbe.width !== plan.frameFormat.width ||
          encodedProbe.height !== plan.frameFormat.height
        )
          throw new Error(
            `Encoded chunk "${chunk.slot}" failed frame-count, raster, or frame-clock probe.`,
          );
        const receipt: IAutoMovieProductionRenderChunkReceipt = {
          version: 2,
          slot: chunk.slot,
          chunk: chunk.id,
          frames: frameReceipts,
          semanticMasks,
          encoded: {
            path: encodedPath,
            digest: digestAutoMovieBytes(encodedBytes),
            bytes: encodedBytes.length,
          },
        };
        assertRenderChunkTemporaryTree(temporaryOwnership);
        for (const written of writtenFiles)
          assertCapturedRenderTarget(written.snapshot);
        const completedTree = props.captureCompleted(props.root, temporary);
        if (
          completedTree.kind !== "directory" ||
          completedTree.targetIdentity !== temporaryOwnership.tree.identity
        )
          throw new Error(
            "Render chunk completed tree changed physical identity.",
          );
        for (const written of writtenFiles)
          assertCapturedRenderGcFileEntry({
            directory: completedTree,
            file: written.snapshot,
            relative: written.relative,
          });
        assertRenderChunkTemporaryTree(temporaryOwnership);
        const published = props.publication.publish({
          chunk: chunk.id,
          receipt,
          root: props.root,
          scope: props.renderLivenessScope,
          tier: props.tier,
          tree: completedTree,
        });
        props.lease.complete(chunk);
        return published.publication.receipt;
      },
    ),
});

/** Preserve the original opaque weighted-RGB capture composition contract. */
export const compositeProductionCaptureLayers = (
  layers: Array<{ image: PNG; weight: number }>,
  width: number,
  height: number,
  pngModule: IProductionRenderHost["pngGeneration"]["module"],
): Uint8Array => {
  const { PNG } = pngModule;
  const output = new PNG({ width, height });
  output.gamma = 0.45455;
  for (let offset = 0; offset < output.data.length; offset += 4) {
    for (let channel = 0; channel < 3; ++channel)
      output.data[offset + channel] = Math.round(
        layers.reduce(
          (sum, layer) =>
            sum + layer.image.data[offset + channel]! * layer.weight,
          0,
        ),
      );
    output.data[offset + 3] = 255;
  }
  return PNG.sync.write(output);
};

/** Ignore RGB differences whose zero alpha makes them physically invisible. */
export const hasProductionVisiblePixelVariance = (png: PNG): boolean => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let index = 4; index < png.data.length; index += 4) {
    const currentAlpha = png.data[index + 3]!;
    if (
      png.data[index]! * currentAlpha !== first[0] ||
      png.data[index + 1]! * currentAlpha !== first[1] ||
      png.data[index + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};

const normalizeSlash = (value: string): string => value.replaceAll("\\", "/");

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
