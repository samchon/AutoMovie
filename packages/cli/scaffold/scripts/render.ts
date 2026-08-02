import {
  deriveProductionSoundPlan,
  productionPhonemesToVisemes,
  productionSoundSpectrogram,
  productionSoundWaveform,
  renderProductionSound,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCaptureFrame,
  IAutoMovieCompiledShotSource,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenditionDelivery,
  IAutoMovieProductionSoundAnalysis,
  IAutoMovieProductionSoundPlan,
  IAutoMovieProductionTtsReceipt,
  IAutoMovieRepaintReceipt,
  IAutoMovieReviewTarget,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  type IAutoMovieProductionAudioAssetIdentity,
  type IAutoMovieProductionEncoderIdentity,
  type IAutoMovieProductionRenderChunk,
  type IAutoMovieProductionRenderChunkReceipt,
  type IAutoMovieProductionRenderGcCandidate,
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderRuntimeIdentity,
  type IAutoMovieProductionRenderTier,
  canonicalAutoMovieCaptureRuntimeIdentity,
  canonicalAutoMovieJsonBytes,
  conformProductionRenditionVideoMp4,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  inspectAutoMovieProduction,
  muxProductionFeatureMp4,
  openAutoMovieProduction,
  planProductionRenderGc,
  planProductionRenderJob,
  probeProductionMedia,
  probeProductionVideoMp4,
  productionPublicationInputFingerprint,
  productionRenderChunkStatuses,
  productionRenderLayersForPass,
  readAutoMovieFilmTimeline,
  readAutoMovieProductionOwnedFile,
  resolveProductionRenderTierFrameFormat,
  runProductionRenderJob,
  sampleProductionRenderFrame,
  selectAutoMovieFilmReviewFrames,
  trimProductionAudioPresentation,
  verifyProductionRenderChunkReceipt,
  verifyProductionRenderJobPlan,
} from "@automovie/mcp";
import * as HME from "h264-mp4-encoder";
import { BoxParser, createFile } from "mp4box";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";

import config from "../automovie.config";
import {
  assertPublishedProxyBundle,
  inspectPublishedProxyBundle,
} from "./assertProxyBundle";
import {
  captureProductionFrame,
  closeProductionFrameCapture,
  productionFrameCaptureMetrics,
} from "./capture";
import {
  type ICurrentRenderChunkPublication,
  captureRenderChunkPublicationFromPointer,
  consumeCurrentRenderChunkFrames,
  loadCurrentRenderChunkPublication,
  publishRenderChunkSnapshot,
  removeCapturedRenderChunkPointer,
  renderChunkPublicationPath,
  renderChunkPublicationProtectsTree,
} from "./renderChunkSnapshot";
import {
  type IRenderGcTargetSnapshot,
  RENDER_GC_PRESERVED_PREFIX,
  assertCapturedRenderGcFileEntry,
  captureRenderGcTarget,
  ensureRenderPhysicalDirectory,
  isRenderGcPreservedPath,
  quarantineCapturedRenderTarget,
  readCapturedRenderGcFile,
  removeCapturedRenderGcTarget,
} from "./renderGcSnapshot";
import {
  acquireRenderGcLease,
  acquireRenderSessionLease,
  releaseRenderLivenessLease,
} from "./renderLiveness";
import {
  type IRuntimePackageSnapshot,
  type RuntimePackageAssetSelection,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

const root = process.cwd();
const productionId = config.productionId;
const tierName = (() => {
  const index = process.argv.indexOf("--tier");
  const value = index < 0 ? "final" : process.argv[index + 1];
  if (value !== "proxy" && value !== "final")
    throw new Error('--tier must be either "proxy" or "final".');
  return value;
})();
const renderTier: IAutoMovieProductionRenderTier =
  tierName === "proxy" ? config.render.proxy : config.render.final;
const productionSegment = encodeAutoMoviePathSegment(productionId);
const renderLivenessScope = digestAutoMovieBytes(
  Buffer.from(
    JSON.stringify({
      protocol: "automovie.render-liveness.v1",
      productionId,
    }),
  ),
).slice(7);
const productionStateRoot = path.join(
  root,
  ".automovie",
  "productions",
  productionSegment,
);
const renderJobRoot = path.join(productionStateRoot, "render-job");
const stateRoot = path.join(renderJobRoot, renderTier.kind);
const planPath = path.join(stateRoot, "plan.json");
const action = process.argv[2] ?? "all";
const require = createRequire(import.meta.url);
const resolveImportEntry = (packageName: string): string =>
  fileURLToPath(import.meta.resolve(packageName));
const heldChunkLocks = new Map<
  string,
  { snapshot: IRenderGcTargetSnapshot; token: string }
>();
const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX" as const;
const KOKORO_MODEL_REVISION =
  "1939ad2a8e416c0acfeecc08a694d14ef25f2231" as const;
const KOKORO_DEVICE = "cpu" as const;
const KOKORO_VOICE = "af_heart";
const RENDER_LOCK_JSON_MAX_BYTES = 64 * 1024;

interface IRenderChunkLockOwner {
  chunk: AutoMovieContentDigest;
  pid: number;
  /** Absent only on an older lock written before owner-checked release. */
  token?: string;
}

const main = async (): Promise<void> => {
  if (
    action !== "all" &&
    action !== "plan" &&
    action !== "run" &&
    action !== "status" &&
    action !== "verify" &&
    action !== "finalize" &&
    action !== "gc"
  )
    throw new Error(
      `Unknown render action "${action}". Use plan, run, status, verify, finalize, or gc.`,
    );
  if (action === "gc") {
    output(renderGarbageCollection(process.argv.includes("--apply")));
    return;
  }
  if (action === "status") {
    const plan = readPlan();
    if (sourceFingerprint() !== plan.compileFingerprint)
      output(
        stalePlanRows(
          plan,
          "Source/design input changed. Run automovie render plan, then rerender only the new chunk identities.",
        ),
      );
    else {
      const inputs = await currentRenderPlanInputs(plan);
      if (
        isDeepStrictEqual(inputs.runtimeIdentity, plan.runtimeIdentity) ===
        false
      )
        output(
          stalePlanRows(
            plan,
            "Capture, graphics, render-source, or encoder identity changed. Run automovie render plan, then rerender only the new chunk identities.",
          ),
        );
      else {
        try {
          verifyProductionRenderJobPlan({ plan, ...inputs });
          output(await renderStatus(plan));
        } catch {
          output(
            stalePlanRows(
              plan,
              "Stored render plan differs from current compiler-owned inputs. Run automovie render plan, then rerender only the new chunk identities.",
            ),
          );
        }
      }
    }
    return;
  }
  if (action === "verify") {
    const current = await currentStoredPlan();
    const status = await renderStatus(current);
    if (status.some((item) => item.status !== "complete"))
      throw new Error(
        "Render verification found incomplete chunks. Run automovie render status, then run.",
      );
    output({ verified: true, plan: current, chunks: status });
    return;
  }
  const session = acquireRenderSessionLease({
    coordinationRoot: root,
    pid: process.pid,
    processAlive,
    scope: renderLivenessScope,
    tier: renderTier.kind,
  });
  try {
    if (action === "finalize") {
      output(await finalize(await currentStoredPlan()));
      return;
    }
    const current = await currentPlan();
    if (action === "plan") {
      output(current);
      return;
    }
    if (action === "all") await captureReviewEvidence();
    if (action === "run" || action === "all") {
      recoverAbandonedTemporaryDirectories(current.chunks);
      quarantineStaleSlotOutputs(current.chunks);
      const result = await runProductionRenderJob({
        plan: current,
        workers: integerOption("--workers", 1),
        deliverable: stringOption("--deliverable"),
        adapters: {
          current: currentReceipt,
          acquire: acquireChunk,
          render: (chunk) => renderChunk(current, chunk),
          fail: failChunk,
          release: releaseChunk,
        },
      });
      output({
        plan: {
          compileFingerprint: current.compileFingerprint,
          editFingerprint: current.editFingerprint,
          tier: current.tier,
        },
        capture: productionFrameCaptureMetrics(),
        result,
        chunks: await renderStatus(current),
      });
      if (result.failed.length !== 0 || result.busy.length !== 0)
        process.exitCode = 1;
      if (action === "run" || process.exitCode === 1) return;
    }
    output(await finalize(current));
  } finally {
    releaseRenderLivenessLease(session);
  }
};

const sourceFingerprint = (): AutoMovieContentDigest => {
  const checked = new AutoMovieProductionCompiler(
    AutoMovieProductionProject.open(root, productionId),
  ).lint({ scope: "source" });
  if (checked.success === false)
    throw new Error(
      `Source lint failed while checking render status: ${JSON.stringify(
        checked.diagnostics,
      )}`,
    );
  return checked.compiler.inputFingerprint;
};

const captureReviewEvidence = async (): Promise<IAutoMovieCaptureFrame[]> => {
  const app = productionApplication();
  const compiled = productionServices().compiler.compile({ scope: "source" });
  if (compiled.success === false)
    throw new Error(
      `Source compilation failed before review capture: ${JSON.stringify(
        compiled.diagnostics,
      )}`,
    );
  const project = AutoMovieProductionProject.open(root, productionId);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Review capture requires a production design.");
  const timeline = readAutoMovieFilmTimeline(
    project,
    compiled.compiler.inputFingerprint,
  );
  const frames: IAutoMovieCaptureFrame[] = [];
  for (const segment of timeline.segments) {
    const contract = graph.shots.get(segment.shot);
    if (contract === undefined)
      throw new Error(
        `Compiled film segment references missing shot "${segment.shot}".`,
      );
    for (const request of selectAutoMovieFilmReviewFrames(
      segment,
      contract,
      timeline.fps,
    ))
      for (const pass of request.passes)
        frames.push(
          await app.captureFrame({
            target: {
              kind: "shot",
              productionId,
              id: segment.shot,
              time: request.time,
              pass,
            },
          }),
        );
  }
  const failed = frames.filter((frame) => frame.captured === false);
  if (failed.length !== 0)
    throw new Error(
      `Review evidence capture failed for ${failed.length} current frame(s): ${JSON.stringify(
        failed,
      )}`,
    );
  return frames;
};

const currentPlan = async (): Promise<IAutoMovieProductionRenderJobPlan> => {
  const compiled = productionServices().compiler.compile({ scope: "source" });
  if (compiled.success === false)
    throw new Error(
      `Source compilation failed before render planning: ${JSON.stringify(
        compiled.diagnostics,
      )}`,
    );
  const project = AutoMovieProductionProject.open(root, productionId);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Render planning requires a production design.");
  if (
    graph.production.frameFormat.width % 2 !== 0 ||
    graph.production.frameFormat.height % 2 !== 0
  )
    throw new Error(
      "The package-owned H.264 adapter requires even production width and height.",
    );
  const timeline = readAutoMovieFilmTimeline(
    project,
    compiled.compiler.inputFingerprint,
  );
  const frameFormat = resolveProductionRenderTierFrameFormat(
    graph.production.frameFormat,
    renderTier,
  );
  const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1)!;
  const runtimeIdentity = await renderRuntimeIdentity({
    project,
    compileFingerprint: compiled.compiler.inputFingerprint,
    timeline,
    first,
    width: frameFormat.width,
    height: frameFormat.height,
    fps: frameFormat.fps,
  });
  const planned = planProductionRenderJob({
    timeline,
    production: graph.production,
    audioAssets: productionAudioAssets(project, timeline),
    runtimeIdentity,
    sourceFingerprints: renderShotFingerprints(project, timeline),
    chunkFrames: integerOption("--chunk-frames", 48),
    tier: renderTier,
  });
  writeJsonAtomic(planPath, planned);
  return planned;
};

const productionAudioAssets = (
  project: AutoMovieProductionProject,
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
): IAutoMovieProductionAudioAssetIdentity[] => {
  const inputs = new Map(
    project.contentInputs().map((input) => [input.path, input.bytes]),
  );
  return [...new Set(timeline.tracks.audio.map((cue) => cue.asset))]
    .sort(compareCodeUnits)
    .map((asset) => {
      const bytes = inputs.get(asset);
      if (bytes === undefined || bytes === null)
        throw new Error(
          `Audio asset "${asset}" has no current compiler-owned bytes.`,
        );
      let metadata: unknown;
      try {
        metadata = JSON.parse(Buffer.from(bytes).toString("utf8"));
      } catch {
        throw new Error(
          `Audio asset "${asset}" is not a supported deterministic guide-stem descriptor.`,
        );
      }
      const value = metadata as Partial<{
        kind: string;
        durationSeconds: number;
        sampleRate: number;
        channels: number;
      }>;
      if (
        value.kind !== "placeholder-audio-stem" ||
        Number.isFinite(value.durationSeconds) === false ||
        Number.isSafeInteger(value.sampleRate) === false ||
        Number.isSafeInteger(value.channels) === false ||
        value.sampleRate !== 48_000 ||
        value.channels !== 2
      )
        throw new Error(
          `Audio asset "${asset}" must declare one 48 kHz stereo deterministic guide stem and finite duration.`,
        );
      return {
        path: asset,
        digest: digestAutoMovieBytes(bytes),
        durationSeconds: value.durationSeconds!,
        sampleRate: value.sampleRate,
        channels: value.channels,
      };
    });
};

const renderSourceDigest = (
  project: AutoMovieProductionProject,
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        content: project
          .contentInputs()
          .filter((input) => {
            const audio = new Set(
              timeline.tracks.audio.map((cue) => cue.asset),
            );
            return input.render && audio.has(input.path) === false;
          })
          .map((input) => ({
            path: input.path,
            digest:
              input.bytes === null ? null : digestAutoMovieBytes(input.bytes),
          })),
        soundRuntime: productionSoundRuntimeIdentity(),
      }),
      "utf8",
    ),
  );

const productionSoundRuntimeIdentity = () => ({
  protocol: "automovie.production-sound.v1",
  sampleRate: 48_000,
  channels: 2,
  opus: {
    ...resolvedPackageIdentity("libopus-wasm"),
    bitrate: 128_000,
    complexity: 10,
    vbr: false,
    frameSize: 960,
  },
  mux: resolvedPackageIdentity("mp4box"),
  evidencePng: resolvedPackageIdentity("pngjs"),
  tts: {
    ...resolvedPackageIdentity("kokoro-js"),
    adapter: resolvedPackageIdentity("@huggingface/transformers"),
    backend: onnxRuntimeNodeIdentity(),
    imageCapability: resolvedPackageIdentity("sharp"),
    model: KOKORO_MODEL,
    modelRevision: KOKORO_MODEL_REVISION,
    dtype: "q8",
    device: KOKORO_DEVICE,
    voice: KOKORO_VOICE,
    speed: 1,
  },
});

const resolvedPackageIdentity = (
  packageName: string,
): {
  package: string;
  version: string;
  entryDigest: AutoMovieContentDigest;
} => packageSnapshotIdentity(resolvedPackageSnapshot(packageName));

const resolvedPackageSnapshot = (
  packageName: string,
  assets: readonly RuntimePackageAssetSelection[] = [],
): IRuntimePackageSnapshot =>
  snapshotRuntimePackage({
    assets,
    entry: resolveImportEntry(packageName),
    packageName,
  });

const packageSnapshotIdentity = (
  snapshot: IRuntimePackageSnapshot,
): {
  package: string;
  version: string;
  entryDigest: AutoMovieContentDigest;
} => ({
  package: snapshot.package,
  version: snapshot.version,
  entryDigest: snapshot.entryDigest,
});

const onnxRuntimeNodeIdentity = (): ReturnType<
  typeof packageSnapshotIdentity
> & {
  nativeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
} => {
  const relative = ["bin", "napi-v3", process.platform, process.arch].join("/");
  let snapshot: IRuntimePackageSnapshot;
  try {
    snapshot = resolvedPackageSnapshot("onnxruntime-node", [
      { kind: "tree", relative },
    ]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new Error(
        `ONNX Runtime Node has no native backend for ${process.platform}/${process.arch}.`,
      );
    throw error;
  }
  if (snapshot.assets.length === 0)
    throw new Error(
      `ONNX Runtime Node native backend is empty for ${process.platform}/${process.arch}.`,
    );
  return {
    ...packageSnapshotIdentity(snapshot),
    nativeAssets: snapshot.assets.map((asset) => ({
      path: `package:onnxruntime-node/${asset.path}`,
      digest: asset.digest,
    })),
  };
};

const renderShotFingerprints = (
  project: AutoMovieProductionProject,
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>,
): Record<string, AutoMovieContentDigest> => {
  const manifest = project.generatedManifest();
  if (manifest === null)
    throw new Error("Render planning requires current generated ownership.");
  return Object.fromEntries(
    [...new Set(timeline.segments.map((segment) => segment.shot))]
      .sort(compareCodeUnits)
      .map((shot) => {
        const generated = manifest.files.find(
          (file) =>
            file.path === `shots/${encodeAutoMoviePathSegment(shot)}.json`,
        );
        if (generated === undefined)
          throw new Error(
            `Render planning cannot find compiler-owned source bytes for shot "${shot}".`,
          );
        return [shot, generated.digest];
      }),
  );
};

const renderStatus = async (plan: IAutoMovieProductionRenderJobPlan) => {
  const currentChunks = await Promise.all(
    plan.chunks.map((chunk) => currentChunk(chunk)),
  );
  const receipts = currentChunks.flatMap((current) =>
    current === null ? [] : [current.receipt],
  );
  const attempts = readAllJson<{
    slot: string;
    chunk: AutoMovieContentDigest;
    state: "running" | "failed";
    correction: string;
  }>(path.join(stateRoot, "attempts"), ".json");
  const rows = productionRenderChunkStatuses({ plan, receipts, attempts });
  return rows.map((row, index) => {
    if (row.status !== "complete") return row;
    return currentChunks[index] === null
      ? {
          ...row,
          status: "failed" as const,
          correction:
            "Chunk publication tree or receipt is partial, changed, corrupt, or parser-inconsistent. Quarantine and rerender this chunk.",
        }
      : row;
  });
};

const currentReceipt = async (
  chunk: IAutoMovieProductionRenderChunk,
): Promise<IAutoMovieProductionRenderChunkReceipt | null> => {
  const current = await currentChunk(chunk);
  return current?.receipt ?? null;
};

const currentChunk = async (
  chunk: IAutoMovieProductionRenderChunk,
  pointer?: IRenderGcTargetSnapshot | null,
): Promise<ICurrentRenderChunkPublication | null> => {
  try {
    const currentPointer =
      pointer === undefined ? captureCurrentChunkPointer(chunk) : pointer;
    if (currentPointer === null) return null;
    const plan = readPlan();
    return loadCurrentRenderChunkPublication({
      assertReceipt: (receipt) =>
        verifyProductionRenderChunkReceipt({ plan, chunk, receipt }),
      chunk,
      frameFormat: plan.frameFormat,
      pointer: currentPointer,
    });
  } catch {
    return null;
  }
};

const acquireChunk = async (
  chunk: IAutoMovieProductionRenderChunk,
): Promise<boolean> => {
  const directory = chunkLockDirectory(chunk);
  fs.mkdirSync(directory, { recursive: true });
  const token = randomUUID();
  const claim = path.join(directory, `claim.${process.pid}.${token}.lock`);
  const candidate = `${claim}.candidate`;
  try {
    fs.writeFileSync(
      candidate,
      `${JSON.stringify({ chunk: chunk.id, pid: process.pid, token })}\n`,
      { flag: "wx" },
    );
    // Publish a fully written owner record in one namespace operation. The
    // unique claim path is never reused by another worker, so dead-owner
    // recovery cannot rename or unlink a later owner's lock.
    fs.linkSync(candidate, claim);
  } finally {
    fs.rmSync(candidate, { force: true });
  }
  try {
    for (const file of chunkLockClaims(chunk)) {
      let owner: IRenderChunkLockOwner;
      const snapshot = captureExistingRenderStateTarget(file);
      if (snapshot === null) continue;
      try {
        owner = readCapturedRenderJson<IRenderChunkLockOwner>(
          snapshot,
          RENDER_LOCK_JSON_MAX_BYTES,
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw new Error(
          `Chunk lock "${file}" has no readable owner identity. Verify that no render worker owns it, then quarantine it before retrying: ${String(error)}`,
        );
      }
      if (Number.isSafeInteger(owner.pid) === false || owner.pid <= 0)
        throw new Error(
          `Chunk lock "${file}" has an invalid owner process. Verify that no render worker owns it, then quarantine it before retrying.`,
        );
      if (processAlive(owner.pid)) {
        if (file !== claim) {
          releaseOwnedChunkClaim(chunk, claim, token);
          return false;
        }
        continue;
      }
      try {
        quarantine(file, "abandoned-lock", snapshot);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const ownedClaim = captureRenderGcTarget(stateRoot, claim);
    const owner = readCapturedRenderJson<IRenderChunkLockOwner>(
      ownedClaim,
      RENDER_LOCK_JSON_MAX_BYTES,
    );
    if (
      owner.chunk !== chunk.id ||
      owner.pid !== process.pid ||
      owner.token !== token
    )
      throw new Error(
        `Chunk lock claim "${claim}" changed before rendering began.`,
      );
    heldChunkLocks.set(chunk.slot, { snapshot: ownedClaim, token });
    return true;
  } catch (error) {
    releaseOwnedChunkClaim(chunk, claim, token);
    throw error;
  }
};

const renderChunk = async (
  plan: IAutoMovieProductionRenderJobPlan,
  chunk: IAutoMovieProductionRenderChunk,
): Promise<IAutoMovieProductionRenderChunkReceipt> => {
  const pointer = captureCurrentChunkPointer(chunk);
  const existing = await currentChunk(chunk, pointer);
  if (existing !== null) return existing.receipt;
  if (pointer !== null) removeCapturedRenderChunkPointer(pointer);
  const temporaryRoot = ensureRenderPhysicalDirectory(stateRoot, "tmp");
  const temporary = path.join(
    temporaryRoot,
    `${chunk.id.slice(7)}.${randomUUID()}.${process.pid}`,
  );
  fs.mkdirSync(temporary);
  writeJsonAtomic(attemptPath(chunk), {
    slot: chunk.slot,
    chunk: chunk.id,
    state: "running",
    correction: "",
    pid: process.pid,
  });
  const frameReceipts: IAutoMovieProductionRenderChunkReceipt["frames"] = [];
  const frameBytes: Uint8Array[] = [];
  for (const sample of chunk.frames) {
    const images: Array<{ image: PNG; weight: number }> = [];
    for (const layer of productionRenderLayersForPass(sample, chunk.pass)) {
      const captured = await captureProductionFrame({
        projectRoot: root,
        productionId,
        compileFingerprint: plan.compileFingerprint,
        target: { kind: "shot", id: layer.shot },
        time: layer.sourceFrame / plan.sourceFrameFormat.fps,
        pass: chunk.pass,
        width: plan.frameFormat.width,
        height: plan.frameFormat.height,
      });
      if (
        canonicalAutoMovieCaptureRuntimeIdentity(captured.runtimeIdentity) !==
        canonicalAutoMovieCaptureRuntimeIdentity(plan.runtimeIdentity.capture)
      )
        throw new Error(
          `Capture runtime changed while rendering "${chunk.slot}". Replan before mixing renderer identities.`,
        );
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
      if (hasVisiblePixelVariance(image) === false)
        throw new Error(
          `Capture for frame ${sample.globalFrame} has no visible pixel variance. Fix the camera, lighting, scene, or pass before rendering.`,
        );
      images.push({ image, weight: layer.weight });
    }
    const bytes = composite(
      images,
      plan.frameFormat.width,
      plan.frameFormat.height,
    );
    const relative = `frames/frame_${String(sample.globalFrame).padStart(
      8,
      "0",
    )}.${chunk.pass}.png`;
    writeFileAtomic(path.join(temporary, relative), bytes);
    const probe = probeProductionMedia({
      kind: "preview",
      mediaType: "image/png",
      bytes,
    });
    if (probe.kind !== "png")
      throw new Error(`Frame ${sample.globalFrame} did not decode as PNG.`);
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
  const encodedBytes = await encodePngFrames((consumeFrame) => {
    for (const frame of frameBytes) consumeFrame(frame);
  }, plan);
  const encodedPath = "chunk.mp4";
  writeFileAtomic(path.join(temporary, encodedPath), encodedBytes);
  const encodedProbe = probeProductionVideoMp4(encodedBytes);
  if (
    encodedProbe.kind !== "video" ||
    encodedProbe.frameCount !== chunk.frames.length ||
    encodedProbe.width !== plan.frameFormat.width ||
    encodedProbe.height !== plan.frameFormat.height ||
    Math.abs(encodedProbe.fps - plan.frameFormat.fps) > 1e-9
  )
    throw new Error(
      `Encoded chunk "${chunk.slot}" failed frame-count, raster, or frame-clock probe.`,
    );
  const receipt: IAutoMovieProductionRenderChunkReceipt = {
    version: 1,
    slot: chunk.slot,
    chunk: chunk.id,
    frames: frameReceipts,
    encoded: {
      path: encodedPath,
      digest: digestAutoMovieBytes(encodedBytes),
      bytes: encodedBytes.length,
    },
  };
  const published = publishRenderChunkSnapshot({
    chunk: chunk.id,
    receipt,
    root,
    scope: renderLivenessScope,
    tier: renderTier.kind,
    tree: temporary,
  });
  fs.rmSync(attemptPath(chunk), { force: true });
  return published.publication.receipt;
};

const failChunk = async (
  chunk: IAutoMovieProductionRenderChunk,
  correction: string,
): Promise<void> =>
  writeJsonAtomic(attemptPath(chunk), {
    slot: chunk.slot,
    chunk: chunk.id,
    state: "failed",
    correction,
    pid: process.pid,
  });

const releaseChunk = async (
  chunk: IAutoMovieProductionRenderChunk,
): Promise<void> => {
  const held = heldChunkLocks.get(chunk.slot);
  if (held === undefined) return;
  heldChunkLocks.delete(chunk.slot);
  releaseOwnedChunkClaim(
    chunk,
    held.snapshot.target,
    held.token,
    held.snapshot,
  );
};

const releaseOwnedChunkClaim = (
  chunk: IAutoMovieProductionRenderChunk,
  file: string,
  token: string,
  captured?: IRenderGcTargetSnapshot,
): void => {
  try {
    const snapshot = captured ?? captureRenderGcTarget(stateRoot, file);
    const owner = readCapturedRenderJson<IRenderChunkLockOwner>(
      snapshot,
      RENDER_LOCK_JSON_MAX_BYTES,
    );
    if (
      owner.chunk === chunk.id &&
      owner.pid === process.pid &&
      owner.token === token
    )
      removeCapturedRenderStateTarget(snapshot);
  } catch {
    // A missing, unreadable, or replaced claim is not proven to be ours.
  }
};

const finalize = async (plan: IAutoMovieProductionRenderJobPlan) => {
  renderProgress("finalize.start", { tier: plan.tier.kind });
  const inspection = inspectAutoMovieProduction(productionServices());
  const incompleteReviews = inspection.reviews.entries.filter(
    (entry) => entry.state !== "complete",
  );
  if (plan.tier.kind === "final" && incompleteReviews.length !== 0)
    throw new Error(
      `Final publication is review-blocked by ${incompleteReviews
        .map((entry) => `${reviewTargetLabel(entry.target)}:${entry.state}`)
        .join(", ")}. Run review:status and submit current evidence first.`,
    );
  const status = await renderStatus(plan);
  renderProgress("finalize.status.complete", { tier: plan.tier.kind });
  const project = AutoMovieProductionProject.open(root, productionId);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Production design disappeared before final publication.");
  if (plan.tier.kind === "final") assertMatchingProxyPublication(project, plan);
  const timeline =
    plan.tier.kind === "final" &&
    graph.production.visualDelivery === "repainted"
      ? readAutoMovieFilmTimeline(project, plan.compileFingerprint)
      : null;
  const renditionReceipts: Map<string, IAutoMovieRepaintReceipt> =
    timeline === null
      ? new Map()
      : new Map(
          project
            .verifiedRepaintRenditions([
              ...new Set(timeline.segments.map((segment) => segment.shot)),
            ])
            .map((receipt) => [receipt.shot, receipt] as const),
        );
  const requiredVideo = new Set(
    graph.production.deliverables
      .filter(
        (deliverable) =>
          deliverable.required &&
          (deliverable.kind === "feature" || deliverable.kind === "guide-pass"),
      )
      .map((deliverable) => deliverable.id),
  );
  if (
    status.some(
      (item) =>
        requiredVideo.has(
          plan.chunks.find((chunk) => chunk.slot === item.slot)!.deliverable,
        ) && item.status !== "complete",
    )
  )
    throw new Error(
      "Final publication requires every required current chunk complete. Run render status and run first.",
    );
  const completeSlots = new Set(
    status
      .filter((item) => item.status === "complete")
      .map((item) => item.slot),
  );
  const publication = new Map<string, Uint8Array>();
  const manifest: IAutoMovieProductionRenderManifest = {
    version: 1,
    compileFingerprint: plan.compileFingerprint,
    deliverables: [],
  };
  let soundPromise: Promise<IProductionSoundBundle> | undefined;
  const currentSound = (): Promise<IProductionSoundBundle> =>
    (soundPromise ??= (async () => {
      renderProgress("sound.start");
      const sound = await produceProductionSound(project, plan);
      renderProgress("sound.complete");
      return sound;
    })());
  const publicationSegment = renderPublicationFingerprint(plan).slice(7);
  for (const deliverable of graph.production.deliverables) {
    const owned = new Map<string, Uint8Array>();
    const deliverableChunks = plan.chunks.filter(
      (chunk) => chunk.deliverable === deliverable.id,
    );
    if (
      deliverableChunks.some((chunk) => completeSlots.has(chunk.slot) === false)
    ) {
      if (deliverable.required)
        throw new Error(
          `Required deliverable "${deliverable.id}" has incomplete current chunks.`,
        );
      continue;
    }
    let rendition: IAutoMovieProductionRenditionDelivery | undefined;
    if (deliverable.kind === "feature") {
      renderProgress("video.feature.encode.start", {
        deliverable: deliverable.id,
      });
      const video =
        timeline === null
          ? await encodeChunkFrames(plan, deliverableChunks)
          : conformProductionRenditionVideoMp4({
              timeline,
              clips: new Map(
                timeline.segments.map((segment) => {
                  const receipt = renditionReceipts.get(segment.shot);
                  if (receipt === undefined)
                    throw new Error(
                      `Repainted feature delivery is missing current receipt-bound output for shot "${segment.shot}".`,
                    );
                  return [
                    segment.shot,
                    project.readRenderFile(receipt.output.path),
                  ] as const;
                }),
              ),
            });
      renderProgress("video.feature.encode.complete", {
        deliverable: deliverable.id,
      });
      const sound = await currentSound();
      renderProgress("video.feature.mux.start", {
        deliverable: deliverable.id,
      });
      owned.set(
        "feature.mp4",
        muxProductionFeatureMp4({ video, audio: sound.audio }),
      );
      renderProgress("video.feature.mux.complete", {
        deliverable: deliverable.id,
      });
      if (timeline !== null) {
        const shots = [
          ...new Set(timeline.segments.map((segment) => segment.shot)),
        ];
        rendition = {
          kind: "repainted",
          shots: shots.map((shot) => {
            const receipt = renditionReceipts.get(shot);
            const sourceReview = project.review({ kind: "shot", id: shot });
            const renditionReview = project.review({
              kind: "rendition",
              id: shot,
            });
            if (
              receipt === undefined ||
              sourceReview === null ||
              sourceReview.complete === false ||
              sourceReview.fingerprint !== receipt.sourceReviewFingerprint ||
              renditionReview === null ||
              renditionReview.complete === false
            )
              throw new Error(
                `Repainted feature delivery requires current completed source and rendition reviews for shot "${shot}".`,
              );
            return {
              shot,
              path: receipt.output.path,
              digest: receipt.output.digest,
              receiptDigest: digestAutoMovieBytes(
                canonicalAutoMovieJsonBytes(receipt),
              ),
              sourceReviewFingerprint: sourceReview.fingerprint,
              renditionReviewFingerprint: renditionReview.fingerprint,
            };
          }),
          aggregateReviews: inspection.reviews.entries
            .flatMap((entry) => {
              if (
                (entry.target.kind !== "sequence" &&
                  entry.target.kind !== "film") ||
                entry.state !== "complete"
              )
                return [];
              const review = project.review(entry.target);
              if (review === null || review.complete === false)
                throw new Error(
                  `Repainted feature delivery lost current ${reviewTargetLabel(entry.target)} review.`,
                );
              return [
                {
                  kind: entry.target.kind,
                  id: entry.target.id,
                  fingerprint: review.fingerprint,
                },
              ];
            })
            .sort(
              (left, right) =>
                compareCodeUnits(left.kind, right.kind) ||
                compareCodeUnits(left.id, right.id),
            ),
        };
      }
    } else if (deliverable.kind === "guide-pass") {
      const passes = [...new Set(deliverableChunks.map((chunk) => chunk.pass))];
      if (passes.length !== 1)
        throw new Error(
          `Guide deliverable "${deliverable.id}" must own one declared pass, but owns ${passes.length}.`,
        );
      renderProgress("video.guide.encode.start", {
        deliverable: deliverable.id,
      });
      const video = await encodeChunkFrames(plan, deliverableChunks);
      renderProgress("video.guide.encode.complete", {
        deliverable: deliverable.id,
      });
      owned.set(`${passes[0]}.mp4`, video);
      for (const chunk of [...deliverableChunks].sort(
        (left, right) => left.frameStart - right.frameStart,
      )) {
        const current = await currentChunk(chunk);
        if (current === null)
          throw new Error(
            `Guide-pass chunk "${chunk.slot}" changed before control-frame publication.`,
          );
        consumeCurrentRenderChunkFrames(current, (frame) =>
          owned.set(
            `frames/${passes[0]}/frame_${String(
              frame.receipt.globalFrame,
            ).padStart(8, "0")}.png`,
            frame.bytes,
          ),
        );
      }
    } else if (deliverable.kind === "captions") {
      if (plan.tracks.captions.split("-->").length < 2) {
        if (deliverable.required)
          throw new Error("Required captions contain no timed compiler cue.");
      } else
        owned.set("captions.vtt", Buffer.from(plan.tracks.captions, "utf8"));
    } else if (deliverable.kind === "audio-mix") {
      const sound = await currentSound();
      owned.set("audio.mp4", sound.audio);
      owned.set("waveform.png", sound.waveform);
      owned.set("spectrogram.png", sound.spectrogram);
      owned.set(
        "evidence.json",
        Buffer.from(
          `${JSON.stringify(
            {
              version: 1,
              plan: sound.plan,
              analysis: sound.analysis,
              tts: sound.tts,
            },
            null,
            2,
          )}\n`,
          "utf8",
        ),
      );
    } else {
      const timeline = readAutoMovieFilmTimeline(
        project,
        plan.compileFingerprint,
      );
      const frame = sampleProductionRenderFrame(timeline, 0).layers.at(-1)!;
      const captured = await captureProductionFrame({
        projectRoot: root,
        productionId,
        compileFingerprint: plan.compileFingerprint,
        target: { kind: "shot", id: frame.shot },
        time: frame.sourceFrame / timeline.fps,
        pass: "beauty",
        width: plan.frameFormat.width,
        height: plan.frameFormat.height,
      });
      if (
        canonicalAutoMovieCaptureRuntimeIdentity(captured.runtimeIdentity) !==
        canonicalAutoMovieCaptureRuntimeIdentity(plan.runtimeIdentity.capture)
      )
        throw new Error(
          `Preview capture for "${deliverable.id}" used a different runtime identity. Replan before finalizing.`,
        );
      owned.set("preview.png", captured.bytes);
    }
    if (owned.size === 0) {
      if (deliverable.required)
        throw new Error(
          `Required deliverable "${deliverable.id}:${deliverable.kind}" produced no bytes.`,
        );
      continue;
    }
    const files: Array<{
      path: string;
      digest: AutoMovieContentDigest;
      bytes: number;
      mediaType: string;
      probe: ReturnType<typeof probeProductionMedia>;
    }> = [];
    for (const [name, bytes] of owned) {
      const relative = [
        "deliverables",
        plan.tier.kind,
        publicationSegment,
        encodeAutoMoviePathSegment(deliverable.id),
        name,
      ].join("/");
      const mediaType =
        deliverable.kind === "captions"
          ? "text/vtt"
          : name.endsWith(".json")
            ? "application/json"
            : deliverable.kind === "preview" || name.endsWith(".png")
              ? "image/png"
              : deliverable.kind === "audio-mix"
                ? "audio/mp4"
                : "video/mp4";
      const probe = probeProductionMedia({
        kind: deliverable.kind,
        mediaType,
        bytes,
      });
      assertDeliverableProbe(deliverable.kind, probe, plan);
      publication.set(relative, bytes);
      files.push({
        path: relative,
        digest: digestAutoMovieBytes(bytes),
        bytes: bytes.length,
        mediaType,
        probe,
      });
    }
    const video = files.find((file) => file.probe.kind === "video")?.probe;
    const audio = files.find((file) => file.probe.kind === "audio")?.probe;
    manifest.deliverables.push({
      id: deliverable.id,
      kind: deliverable.kind,
      files: files.map(({ probe: _probe, ...file }) => file),
      runtimeSeconds:
        deliverable.kind === "captions"
          ? plan.totalFrames / plan.frameFormat.fps
          : video?.kind === "video"
            ? video.runtimeSeconds
            : audio?.kind === "audio"
              ? audio.runtimeSeconds
              : null,
      frameCount: video?.kind === "video" ? video.frameCount : null,
      codec:
        video?.kind === "video"
          ? video.codec
          : audio?.kind === "audio"
            ? audio.codec
            : null,
      ...(rendition === undefined ? {} : { rendition }),
    });
  }
  if (plan.tier.kind === "proxy") {
    renderProgress("publication.proxy.start");
    const published = publishProxyTierBundle(
      plan,
      publication,
      manifest,
      project,
    );
    renderProgress("publication.proxy.complete");
    renderProgress("finalize.complete", { tier: plan.tier.kind });
    return published;
  }
  renderProgress("publication.final.start");
  const snapshot = productionPublicationInputFingerprint(project);
  const revision = project.commitProductionPublication({
    files: publication,
    manifest,
    inputCurrent: () =>
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(root, productionId),
      ) === snapshot,
    publicationCurrent: () => {
      const stagedProject = AutoMovieProductionProject.open(root, productionId);
      const statusCompiler = new AutoMovieProductionCompiler(stagedProject);
      const stagedReview = new AutoMovieProductionReviewService(
        stagedProject,
        () => statusCompiler.lint({ scope: "source" }),
      );
      const staged = new AutoMovieProductionCompiler(
        stagedProject,
        (status, compilerSnapshot) =>
          stagedReview.queue(status, compilerSnapshot),
      ).lint({ scope: "final" });
      if (staged.success === false)
        throw new Error(
          `Staged terminal publication failed the read-only final compiler gate: ${JSON.stringify(
            staged.diagnostics,
          )}`,
        );
    },
    expectedRevision: project.revision(),
  });
  const final = productionServices().compiler.compile({ scope: "final" });
  if (final.success === false)
    throw new Error(
      `Parser-verified publication committed at revision ${revision}, but final compilation rejected it: ${JSON.stringify(final.diagnostics)}`,
    );
  renderProgress("publication.final.complete");
  renderProgress("finalize.complete", { tier: plan.tier.kind });
  return { revision, manifest, final };
};

const publishProxyTierBundle = (
  plan: IAutoMovieProductionRenderJobPlan,
  publication: ReadonlyMap<string, Uint8Array>,
  manifest: IAutoMovieProductionRenderManifest,
  project: AutoMovieProductionProject,
) => {
  const renderRoot = project.renderRoot();
  const publicationSegment = renderPublicationFingerprint(plan).slice(7);
  const bundle = ["deliverables", "proxy", publicationSegment].join("/");
  const parent = ensureRenderPhysicalDirectory(
    renderRoot,
    "deliverables/proxy",
  );
  const target = path.join(parent, publicationSegment);
  const manifestBytes = Buffer.from(
    `${JSON.stringify(
      {
        version: 1,
        tier: plan.tier,
        publicationFingerprint: renderPublicationFingerprint(plan),
        compileFingerprint: plan.compileFingerprint,
        editFingerprint: plan.editFingerprint,
        frameFormat: plan.frameFormat,
        sourceFrameFormat: plan.sourceFrameFormat,
        totalFrames: plan.totalFrames,
        manifest,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const files = new Map<string, Uint8Array>([
    ["publication.json", manifestBytes],
  ]);
  for (const [relative, bytes] of publication) {
    if (relative.startsWith(`${bundle}/`) === false)
      throw new Error(
        `Proxy publication path "${relative}" escapes current bundle "${bundle}".`,
      );
    files.set(relative.slice(bundle.length + 1), bytes);
  }
  if (fs.existsSync(target)) {
    assertPublishedProxyBundle(target, files);
    return { published: true, reused: true, bundle, manifest };
  }
  const candidate = path.join(
    parent,
    `.${publicationSegment}.${randomUUID()}.candidate`,
  );
  fs.mkdirSync(candidate);
  try {
    for (const [relative, bytes] of files) {
      const destination = path.resolve(candidate, relative);
      if (
        destination.startsWith(`${path.resolve(candidate)}${path.sep}`) ===
        false
      )
        throw new Error(
          `Proxy bundle file "${relative}" escapes its candidate.`,
        );
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, bytes);
    }
    fs.renameSync(candidate, target);
  } catch (error) {
    if (fs.existsSync(target)) {
      assertPublishedProxyBundle(target, files);
      return { published: true, reused: true, bundle, manifest };
    }
    throw error;
  } finally {
    fs.rmSync(candidate, { force: true, recursive: true });
  }
  assertPublishedProxyBundle(target, files);
  return { published: true, reused: false, bundle, manifest };
};

const assertMatchingProxyPublication = (
  project: AutoMovieProductionProject,
  plan: IAutoMovieProductionRenderJobPlan,
): void => {
  const proxyRoot = path.join(project.renderRoot(), "deliverables", "proxy");
  if (fs.existsSync(proxyRoot) === false)
    throw new Error(
      "Final publication requires one immutable proxy publication of the same compiler-owned EDL. Finalize the proxy tier, review it, then finalize this plan.",
    );
  const matched = physicalFiles(proxyRoot)
    .filter((file) => path.basename(file) === "publication.json")
    .some((file) => {
      try {
        const receipt = inspectPublishedProxyBundle(
          project.renderRoot(),
          path.dirname(file),
        );
        return (
          receipt.compileFingerprint === plan.compileFingerprint &&
          receipt.editFingerprint === plan.editFingerprint &&
          isDeepStrictEqual(receipt.sourceFrameFormat, plan.sourceFrameFormat)
        );
      } catch {
        return false;
      }
    });
  if (matched === false)
    throw new Error(
      "No immutable proxy publication matches this final plan's compile fingerprint, EDL fingerprint, and source frame format. Replan and finalize proxy before final conform.",
    );
};

const encodeChunkFrames = async (
  plan: IAutoMovieProductionRenderJobPlan,
  chunks: IAutoMovieProductionRenderChunk[],
): Promise<Uint8Array> => {
  if (chunks.length === 0) throw new Error("No current chunks to encode.");
  return encodePngFrames(async (consumeFrame) => {
    let frameCount = 0;
    for (const chunk of chunks.sort(
      (left, right) => left.frameStart - right.frameStart,
    )) {
      const current = await currentChunk(chunk);
      if (current === null)
        throw new Error(
          `Chunk "${chunk.slot}" changed after final status verification. Reverify or rerender it before finalizing.`,
        );
      consumeCurrentRenderChunkFrames(current, (frame) => {
        consumeFrame(frame.bytes);
        frameCount += 1;
      });
    }
    if (frameCount !== plan.totalFrames)
      throw new Error(
        `Final encode has ${frameCount} frames; expected ${plan.totalFrames}.`,
      );
  }, plan);
};

const encodePngFrames = async (
  produceFrames: (
    consumeFrame: (frame: Uint8Array) => void,
  ) => void | Promise<void>,
  plan: IAutoMovieProductionRenderJobPlan,
): Promise<Uint8Array> => {
  if (
    isDeepStrictEqual(
      productionEncoderIdentity(plan.frameFormat.fps),
      plan.runtimeIdentity.encoder,
    ) === false
  )
    throw new Error(
      "The installed production encoder identity changed after render planning. Replan before encoding or finalizing.",
    );
  // `h264-mp4-encoder` ships CommonJS, and this script runs as ESM: depending
  // on the loader its factory arrives on the namespace or on `default`. Read
  // whichever one is callable instead of assuming the interop shape.
  const encoderModule = HME as typeof HME & {
    default?: Pick<typeof HME, "createH264MP4Encoder">;
  };
  const createEncoder =
    typeof encoderModule.createH264MP4Encoder === "function"
      ? encoderModule.createH264MP4Encoder
      : encoderModule.default?.createH264MP4Encoder;
  if (createEncoder === undefined)
    throw new Error(
      "The installed h264-mp4-encoder package exposes no createH264MP4Encoder factory. Reinstall the pinned encoder before rendering.",
    );
  const encoder = await createEncoder();
  let initialized = false;
  let finalizeAttempted = false;
  let failure: { error: unknown } | undefined;
  let output = new Uint8Array();
  try {
    encoder.width = plan.frameFormat.width;
    encoder.height = plan.frameFormat.height;
    encoder.frameRate = plan.frameFormat.fps;
    encoder.quantizationParameter =
      plan.runtimeIdentity.encoder.arguments.quantizationParameter;
    encoder.speed = plan.runtimeIdentity.encoder.arguments.speed;
    encoder.groupOfPictures =
      plan.runtimeIdentity.encoder.arguments.groupOfPictures;
    encoder.initialize();
    initialized = true;
    await produceFrames((frame) => {
      const png = PNG.sync.read(Buffer.from(frame));
      encoder.addFrameRgba(new Uint8Array(png.data));
    });
    finalizeAttempted = true;
    encoder.finalize();
    output = Uint8Array.from(encoder.FS.readFile(encoder.outputFilename));
  } catch (error) {
    failure = { error };
  }
  let cleanupFailure: { error: unknown } | undefined;
  if (initialized && finalizeAttempted === false)
    try {
      finalizeAttempted = true;
      encoder.finalize();
    } catch (error) {
      cleanupFailure = { error };
    }
  try {
    encoder.delete();
  } catch (error) {
    cleanupFailure ??= { error };
  }
  if (failure !== undefined) throw failure.error;
  if (cleanupFailure !== undefined) throw cleanupFailure.error;
  return output;
};

interface IProductionSoundBundle {
  plan: IAutoMovieProductionSoundPlan;
  analysis: IAutoMovieProductionSoundAnalysis;
  tts: IAutoMovieProductionTtsReceipt[];
  audio: Uint8Array;
  waveform: Uint8Array;
  spectrogram: Uint8Array;
}

interface IKokoroCacheRecord {
  version: 2;
  cacheKey: AutoMovieContentDigest;
  model: "onnx-community/Kokoro-82M-v1.0-ONNX";
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231";
  voice: string;
  sourceSampleRate: number;
  sourceSamples: number;
  pcmDigest: AutoMovieContentDigest;
  phonemes: string;
  phonemeChunks: IAutoMovieProductionTtsReceipt["phonemeChunks"];
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
}

interface IKokoroRuntime {
  stream(
    text: string,
    options: { voice: string; speed: number },
  ): AsyncIterable<{
    text: string;
    phonemes: string;
    audio: { audio: Float32Array; sampling_rate: number };
  }>;
}

interface IKokoroLoadedRuntime {
  runtime: IKokoroRuntime;
  runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
}

const produceProductionSound = async (
  project: AutoMovieProductionProject,
  renderPlan: IAutoMovieProductionRenderJobPlan,
): Promise<IProductionSoundBundle> => {
  const timeline = readAutoMovieFilmTimeline(
    project,
    renderPlan.compileFingerprint,
  );
  const graph = project.graph();
  const compiled = new Map<string, IAutoMovieCompiledShotSource>();
  for (const shot of new Set(timeline.segments.map((segment) => segment.shot)))
    compiled.set(
      shot,
      JSON.parse(
        Buffer.from(
          project.readGeneratedFile(
            `shots/${encodeAutoMoviePathSegment(shot)}.json`,
          ),
        ).toString("utf8"),
      ) as IAutoMovieCompiledShotSource,
    );
  const soundPlan = deriveProductionSoundPlan({
    timeline,
    contracts: graph.shots,
    compiled,
  });
  renderProgress("sound.plan.complete", {
    dialogueLines: soundPlan.dialogue.length,
  });
  if (
    soundPlan.totalFrames !== renderPlan.totalFrames ||
    soundPlan.fps !== renderPlan.frameFormat.fps
  )
    throw new Error(
      "Sound plan and render plan do not share the exact film frame clock.",
    );
  renderProgress("sound.synthesis.start");
  const synthesized = await synthesizeProductionDialogue(soundPlan);
  renderProgress("sound.synthesis.complete");
  renderProgress("sound.render.start");
  const rendered = renderProductionSound({
    plan: soundPlan,
    dialogue: synthesized.pcm,
  });
  renderProgress("sound.render.complete");
  if (
    rendered.analysis.clippingSamples !== 0 ||
    rendered.analysis.eventAlignment.some((event) => event.passed === false)
  )
    throw new Error(
      "Final sound failed clipping or semantic event/frame alignment gates.",
    );
  renderProgress("sound.evidence.render.start");
  const waveform = productionSoundWaveform(rendered.pcm);
  const spectrogram = productionSoundSpectrogram(rendered.pcm);
  renderProgress("sound.evidence.render.complete");
  renderProgress("sound.opus.encode.start");
  const audio = await encodeProductionOpus(rendered.pcm);
  renderProgress("sound.opus.encode.complete");
  renderProgress("sound.evidence.encode.start");
  const waveformBytes = encodeSoundRaster(waveform);
  const spectrogramBytes = encodeSoundRaster(spectrogram);
  renderProgress("sound.evidence.encode.complete");
  return {
    plan: soundPlan,
    analysis: rendered.analysis,
    tts: synthesized.receipts,
    audio,
    waveform: waveformBytes,
    spectrogram: spectrogramBytes,
  };
};

const synthesizeProductionDialogue = async (
  plan: IAutoMovieProductionSoundPlan,
): Promise<{
  pcm: Map<string, Float32Array>;
  receipts: IAutoMovieProductionTtsReceipt[];
}> => {
  const pcm = new Map<string, Float32Array>();
  const receipts: IAutoMovieProductionTtsReceipt[] = [];
  const cacheRoot = path.join(productionStateRoot, "audio-cache", "kokoro");
  const modelCacheRoot = path.join(
    productionStateRoot,
    "model-cache",
    "kokoro",
    KOKORO_MODEL_REVISION,
  );
  const baseRuntimeAssets = kokoroBaseRuntimeAssets();
  let runtime: Promise<IKokoroLoadedRuntime> | undefined;
  const currentRuntime = (): Promise<IKokoroLoadedRuntime> =>
    (runtime ??= loadPinnedKokoroRuntime(modelCacheRoot, baseRuntimeAssets));
  let runtimeAssets = [
    ...baseRuntimeAssets,
    ...kokoroModelCacheAssets(modelCacheRoot),
  ];
  if (
    plan.dialogue.length > 0 &&
    runtimeAssets.length === baseRuntimeAssets.length
  )
    runtimeAssets = (await currentRuntime()).runtimeAssets;
  for (const line of plan.dialogue) {
    renderProgress("sound.dialogue.start", { line: line.id });
    const cacheKey = digestAutoMovieBytes(
      Buffer.from(
        JSON.stringify({
          version: 2,
          model: KOKORO_MODEL,
          modelRevision: KOKORO_MODEL_REVISION,
          dtype: "q8",
          device: KOKORO_DEVICE,
          voice: KOKORO_VOICE,
          speed: 1,
          text: line.text.normalize("NFKC"),
          language: line.language.normalize("NFKC"),
          speaker: line.speaker?.normalize("NFKC") ?? null,
          runtimeAssets,
        }),
        "utf8",
      ),
    );
    const stem = cacheKey.slice(7);
    const pcmPath = path.join(cacheRoot, `${stem}.f32`);
    const receiptPath = path.join(cacheRoot, `${stem}.json`);
    let cached:
      | { record: IKokoroCacheRecord; samples: Float32Array }
      | undefined;
    try {
      if (fs.existsSync(pcmPath) && fs.existsSync(receiptPath)) {
        const record = readRendererJson<IKokoroCacheRecord>(
          productionStateRoot,
          receiptPath,
        );
        const bytes = readAutoMovieProductionOwnedFile({
          root: productionStateRoot,
          directory: cacheRoot,
          relative: path.basename(pcmPath),
        });
        if (
          record.version === 2 &&
          record.cacheKey === cacheKey &&
          record.model === KOKORO_MODEL &&
          record.modelRevision === KOKORO_MODEL_REVISION &&
          record.voice === KOKORO_VOICE &&
          isDeepStrictEqual(record.runtimeAssets, runtimeAssets) &&
          Number.isSafeInteger(record.sourceSampleRate) &&
          record.sourceSampleRate > 0 &&
          Number.isSafeInteger(record.sourceSamples) &&
          record.sourceSamples > 0 &&
          typeof record.phonemes === "string" &&
          validPhonemeChunks(record.phonemeChunks, record.sourceSamples) &&
          record.sourceSamples * Float32Array.BYTES_PER_ELEMENT ===
            bytes.length &&
          record.pcmDigest === digestAutoMovieBytes(bytes)
        )
          cached = {
            record,
            samples: new Float32Array(Uint8Array.from(bytes).buffer),
          };
      }
    } catch {
      cached = undefined;
    }
    if (cached === undefined) {
      const chunks: Float32Array[] = [];
      const phonemes: string[] = [];
      const phonemeChunks: IKokoroCacheRecord["phonemeChunks"] = [];
      let sourceSampleRate: number | undefined;
      let sourceOffset = 0;
      for await (const chunk of (await currentRuntime()).runtime.stream(
        line.text,
        {
          voice: KOKORO_VOICE,
          speed: 1,
        },
      )) {
        if (
          Number.isSafeInteger(chunk.audio.sampling_rate) === false ||
          chunk.audio.sampling_rate <= 0
        )
          throw new Error(
            `Kokoro line "${line.id}" returned an invalid PCM sample rate.`,
          );
        if (
          sourceSampleRate !== undefined &&
          sourceSampleRate !== chunk.audio.sampling_rate
        )
          throw new Error(
            `Kokoro line "${line.id}" changed PCM sample rate mid-stream.`,
          );
        sourceSampleRate = chunk.audio.sampling_rate;
        const audio = Float32Array.from(chunk.audio.audio);
        if (audio.length === 0)
          throw new Error(
            `Kokoro line "${line.id}" returned an empty PCM chunk.`,
          );
        chunks.push(audio);
        phonemes.push(chunk.phonemes);
        phonemeChunks.push({
          phonemes: chunk.phonemes,
          startSample: sourceOffset,
          endSample: sourceOffset + audio.length,
        });
        sourceOffset += audio.length;
      }
      if (sourceSampleRate === undefined || chunks.length === 0)
        throw new Error(`Kokoro synthesized no PCM for line "${line.id}".`);
      const samples = concatenateFloat32(chunks);
      const bytes = new Uint8Array(
        samples.buffer,
        samples.byteOffset,
        samples.byteLength,
      );
      const record: IKokoroCacheRecord = {
        version: 2,
        cacheKey,
        model: KOKORO_MODEL,
        modelRevision: KOKORO_MODEL_REVISION,
        voice: KOKORO_VOICE,
        sourceSampleRate,
        sourceSamples: samples.length,
        pcmDigest: digestAutoMovieBytes(bytes),
        phonemes: phonemes.join(""),
        phonemeChunks,
        runtimeAssets,
      };
      writeFileAtomic(pcmPath, bytes);
      writeJsonAtomic(receiptPath, record);
      cached = { record, samples };
    }
    pcm.set(line.id, cached.samples);
    receipts.push({
      ...cached.record,
      line: line.id,
      visemes: productionPhonemesToVisemes({
        chunks: cached.record.phonemeChunks,
        sourceSamples: cached.record.sourceSamples,
        startFrame: line.startFrame,
        endFrame: line.endFrame,
      }),
    });
    renderProgress("sound.dialogue.complete", { line: line.id });
  }
  return { pcm, receipts };
};

const loadPinnedKokoroRuntime = async (
  modelCacheRoot: string,
  baseRuntimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
): Promise<IKokoroLoadedRuntime> => {
  fs.mkdirSync(modelCacheRoot, { recursive: true });
  renderProgress("sound.model.load.start", {
    model: KOKORO_MODEL,
    revision: KOKORO_MODEL_REVISION,
  });
  const [{ KokoroTTS }, { env }] = await Promise.all([
    import("kokoro-js"),
    import("@huggingface/transformers"),
  ]);
  const previous = {
    cacheDir: env.cacheDir,
    fetch: globalThis.fetch,
  };
  const fetcher = globalThis.fetch.bind(globalThis);
  env.cacheDir = modelCacheRoot;
  globalThis.fetch = async (input, init) => {
    const source =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const marker = `huggingface.co/${KOKORO_MODEL}/resolve/`;
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) return fetcher(input, init);
    const suffix = source.slice(markerIndex + marker.length);
    const separator = suffix.indexOf("/");
    if (separator < 0)
      throw new Error(`Kokoro model URL has no asset path: ${source}`);
    const pinned =
      source.slice(0, markerIndex + marker.length) +
      KOKORO_MODEL_REVISION +
      suffix.slice(separator);
    const request =
      typeof input === "object" &&
      input !== null &&
      "url" in input &&
      input instanceof Request
        ? new Request(pinned, input)
        : pinned;
    return fetcher(request, init);
  };
  try {
    const loaded = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
      dtype: "q8",
      device: KOKORO_DEVICE,
    });
    const modelAssets = kokoroModelCacheAssets(modelCacheRoot);
    if (modelAssets.length === 0)
      throw new Error(
        "Pinned Kokoro load produced no revision-scoped model cache assets.",
      );
    renderProgress("sound.model.load.complete", {
      model: KOKORO_MODEL,
      revision: KOKORO_MODEL_REVISION,
    });
    return {
      runtime: loaded as unknown as IKokoroRuntime,
      runtimeAssets: [...baseRuntimeAssets, ...modelAssets],
    };
  } finally {
    env.cacheDir = previous.cacheDir;
    globalThis.fetch = previous.fetch;
  }
};

const kokoroBaseRuntimeAssets =
  (): IAutoMovieProductionTtsReceipt["runtimeAssets"] => {
    const voiceRelative = `voices/${KOKORO_VOICE}.bin`;
    const kokoro = resolvedPackageSnapshot("kokoro-js", [
      { kind: "file", relative: voiceRelative },
    ]);
    const transformers = resolvedPackageIdentity("@huggingface/transformers");
    const backend = onnxRuntimeNodeIdentity();
    const imageCapability = resolvedPackageIdentity("sharp");
    const voice = kokoro.assets.find((asset) => asset.path === voiceRelative);
    if (voice === undefined)
      throw new Error(`Kokoro voice asset is absent: ${voiceRelative}`);
    return [
      { path: "package:kokoro-js", digest: kokoro.entryDigest },
      {
        path: "package:@huggingface/transformers",
        digest: transformers.entryDigest,
      },
      {
        path: "package:onnxruntime-node",
        digest: backend.entryDigest,
      },
      ...backend.nativeAssets,
      {
        path: "package:sharp-capability-wall",
        digest: imageCapability.entryDigest,
      },
      {
        path: `voice:${KOKORO_VOICE}.bin`,
        digest: voice.digest,
      },
    ];
  };

const kokoroModelCacheAssets = (
  modelCacheRoot: string,
): IAutoMovieProductionTtsReceipt["runtimeAssets"] =>
  fs.existsSync(modelCacheRoot)
    ? listFiles(modelCacheRoot).map((file) => {
        const relative = path
          .relative(modelCacheRoot, file)
          .split(path.sep)
          .join("/");
        return {
          path: `model:${relative}`,
          digest: digestAutoMovieBytes(
            readAutoMovieProductionOwnedFile({
              root: modelCacheRoot,
              directory: modelCacheRoot,
              relative,
            }),
          ),
        };
      })
    : [];

const validPhonemeChunks = (
  chunks: unknown,
  sourceSamples: number,
): chunks is IKokoroCacheRecord["phonemeChunks"] =>
  Array.isArray(chunks) &&
  chunks.length > 0 &&
  chunks.every(
    (chunk, index) =>
      typeof chunk === "object" &&
      chunk !== null &&
      typeof chunk.phonemes === "string" &&
      Number.isSafeInteger(chunk.startSample) &&
      Number.isSafeInteger(chunk.endSample) &&
      chunk.startSample === (index === 0 ? 0 : chunks[index - 1]!.endSample) &&
      chunk.endSample > chunk.startSample,
  ) &&
  chunks.at(-1)!.endSample === sourceSamples;

const encodeProductionOpus = async (pcm: Float32Array): Promise<Uint8Array> => {
  if (pcm.length === 0 || pcm.length % 2 !== 0)
    throw new Error("Opus encoding requires non-empty interleaved stereo PCM.");
  const { createEncoder } = await import("libopus-wasm");
  const encoder = await createEncoder({
    bitrate: 128_000,
    complexity: 10,
    vbr: false,
  });
  if (
    encoder.frameSize !== 960 ||
    encoder.channels !== 2 ||
    encoder.sampleRate !== 48_000
  ) {
    encoder.free();
    throw new Error(
      "Pinned Opus runtime no longer exposes the required 48 kHz stereo 20 ms profile.",
    );
  }
  const primingSamples = encoder.getLookahead();
  if (
    Number.isSafeInteger(primingSamples) === false ||
    primingSamples < 0 ||
    primingSamples >= encoder.frameSize
  ) {
    encoder.free();
    throw new Error(
      "Pinned Opus runtime returned an invalid encoder lookahead.",
    );
  }
  const sampleFrames = pcm.length / 2;
  const codedSampleFrames =
    Math.ceil((sampleFrames + primingSamples) / encoder.frameSize) *
    encoder.frameSize;
  const packets: Array<{
    bytes: Uint8Array<ArrayBuffer>;
    duration: number;
    dts: number;
  }> = [];
  try {
    for (let dts = 0; dts < codedSampleFrames; dts += encoder.frameSize) {
      const frame = new Float32Array(encoder.frameSize * encoder.channels);
      frame.set(
        pcm.subarray(
          dts * encoder.channels,
          Math.min(pcm.length, (dts + encoder.frameSize) * encoder.channels),
        ),
      );
      packets.push({
        bytes: Uint8Array.from(encoder.encodeFloat(frame)),
        duration: encoder.frameSize,
        dts,
      });
    }
  } finally {
    encoder.free();
  }
  const description = new BoxParser.box.dOps();
  description.Version = 0;
  description.OutputChannelCount = 2;
  description.PreSkip = primingSamples;
  description.InputSampleRate = 48_000;
  description.OutputGain = 0;
  description.ChannelMappingFamily = 0;
  description.StreamCount = 1;
  description.CoupledCount = 1;
  description.ChannelMapping = [];
  const file = createFile();
  file.init({
    brands: ["isom", "iso2", "mp41", "Opus"],
    timescale: 48_000,
    duration: codedSampleFrames,
  });
  const track = file.addTrack({
    type: "Opus",
    hdlr: "soun",
    name: "AutoMovie deterministic Opus mix",
    timescale: 48_000,
    media_duration: codedSampleFrames,
    duration: codedSampleFrames,
    samplerate: 48_000,
    channel_count: 2,
    samplesize: 16,
    description_boxes: [description],
  });
  for (const packet of packets)
    file.addSample(track, packet.bytes, {
      duration: packet.duration,
      dts: packet.dts,
      cts: packet.dts,
      is_sync: true,
    });
  trimProductionAudioPresentation({
    file,
    track,
    mediaTimescale: 48_000,
    movieTimescale: 48_000,
    primingSamples,
    presentationSamples: sampleFrames,
  });
  return new Uint8Array(file.getBuffer().buffer);
};

const encodeSoundRaster = (raster: {
  width: number;
  height: number;
  rgba: Uint8Array;
}): Uint8Array => {
  const png = new PNG({ width: raster.width, height: raster.height });
  png.data = Buffer.from(raster.rgba);
  return PNG.sync.write(png);
};

const concatenateFloat32 = (chunks: readonly Float32Array[]): Float32Array => {
  const output = new Float32Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
};

const assertDeliverableProbe = (
  kind: IAutoMovieProductionDeliverable["kind"],
  probe: IAutoMovieProductionMediaProbe,
  plan: IAutoMovieProductionRenderJobPlan,
): void => {
  const runtimeSeconds = plan.totalFrames / plan.frameFormat.fps;
  if (kind === "feature" || kind === "guide-pass") {
    if (kind === "guide-pass" && probe.kind === "png") {
      if (
        probe.width !== plan.frameFormat.width ||
        probe.height !== plan.frameFormat.height
      )
        throw new Error(
          "Published guide frame does not match the tier raster.",
        );
      return;
    }
    if (
      probe.kind !== "video" ||
      probe.width !== plan.frameFormat.width ||
      probe.height !== plan.frameFormat.height ||
      probe.frameCount !== plan.totalFrames ||
      Math.abs(probe.fps - plan.frameFormat.fps) > 1e-9 ||
      Math.abs(probe.runtimeSeconds - runtimeSeconds) > 1e-9
    )
      throw new Error(
        `${kind} output does not match the exact production raster, frame count, frame clock, and runtime.`,
      );
    return;
  }
  if (kind === "preview") {
    if (
      probe.kind !== "png" ||
      probe.width !== plan.frameFormat.width ||
      probe.height !== plan.frameFormat.height
    )
      throw new Error("Preview output does not match the production raster.");
    return;
  }
  if (kind === "captions") {
    if (probe.kind !== "webvtt" || probe.lastCueSeconds > runtimeSeconds)
      throw new Error(
        "Caption output is empty, malformed, unordered, or outside the production timeline.",
      );
    return;
  }
  if (probe.kind === "png" || probe.kind === "sound-evidence") {
    if (
      probe.kind === "sound-evidence" &&
      (probe.clippingSamples !== 0 || probe.eventAlignmentPassed === false)
    )
      throw new Error(
        "Sound evidence reports clipping or a semantic event outside its frame gate.",
      );
    return;
  }
  if (
    probe.kind !== "audio" ||
    Math.abs(probe.runtimeSeconds - runtimeSeconds) > 1e-9
  )
    throw new Error(
      "Audio output does not contain one exact-runtime parser-verified track.",
    );
};

const composite = (
  layers: Array<{ image: PNG; weight: number }>,
  width: number,
  height: number,
): Uint8Array => {
  const output = new PNG({ width, height });
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

const hasVisiblePixelVariance = (png: PNG): boolean => {
  if (png.data.length < 8) return false;
  const alpha = png.data[3]!;
  const first = [
    png.data[0]! * alpha,
    png.data[1]! * alpha,
    png.data[2]! * alpha,
    alpha,
  ];
  for (let offset = 4; offset < png.data.length; offset += 4) {
    const currentAlpha = png.data[offset + 3]!;
    if (
      png.data[offset]! * currentAlpha !== first[0] ||
      png.data[offset + 1]! * currentAlpha !== first[1] ||
      png.data[offset + 2]! * currentAlpha !== first[2] ||
      currentAlpha !== first[3]
    )
      return true;
  }
  return false;
};

const productionApplication = (): AutoMovieApplication => {
  const app = new AutoMovieApplication({
    projectRoot: root,
    productionId,
    capture: captureProductionFrame,
  });
  app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
  app.getGuideDocument({ name: "CAPTURE_FRAME" });
  return app;
};

const productionServices = () =>
  openAutoMovieProduction({
    projectRoot: root,
    productionId,
    capture: captureProductionFrame,
  });

const readPlan = (): IAutoMovieProductionRenderJobPlan => {
  if (fs.existsSync(planPath) === false)
    throw new Error("No render plan exists. Run automovie render plan.");
  return readJson<IAutoMovieProductionRenderJobPlan>(planPath);
};

const currentStoredPlan =
  async (): Promise<IAutoMovieProductionRenderJobPlan> => {
    const plan = readPlan();
    if (sourceFingerprint() !== plan.compileFingerprint)
      throw new Error(
        "The stored render plan is stale. Run automovie render plan, then rerender only changed chunk identities.",
      );
    const inputs = await currentRenderPlanInputs(plan);
    if (
      isDeepStrictEqual(inputs.runtimeIdentity, plan.runtimeIdentity) === false
    )
      throw new Error(
        "The stored render runtime identity changed. Run automovie render plan, then rerender only changed chunk identities.",
      );
    verifyProductionRenderJobPlan({ plan, ...inputs });
    return plan;
  };

const stalePlanRows = (
  plan: IAutoMovieProductionRenderJobPlan,
  correction: string,
) =>
  plan.chunks.map((chunk) => ({
    slot: chunk.slot,
    chunk: chunk.id,
    status: "stale" as const,
    correction,
  }));

const currentRenderPlanInputs = async (
  plan: IAutoMovieProductionRenderJobPlan,
) => {
  const project = AutoMovieProductionProject.open(root, productionId);
  const graph = project.graph();
  const production = graph.production;
  if (production === null)
    throw new Error("Render runtime preflight requires a production design.");
  const timeline = readAutoMovieFilmTimeline(project, plan.compileFingerprint);
  const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1);
  if (first === undefined)
    throw new Error("Render runtime preflight requires one film video frame.");
  const runtimeIdentity = await renderRuntimeIdentity({
    project,
    compileFingerprint: plan.compileFingerprint,
    timeline,
    first,
    width: plan.frameFormat.width,
    height: plan.frameFormat.height,
    fps: plan.frameFormat.fps,
  });
  return {
    timeline,
    production,
    runtimeIdentity,
    sourceFingerprints: renderShotFingerprints(project, timeline),
    audioAssets: productionAudioAssets(project, timeline),
  };
};

const renderRuntimeIdentity = async (props: {
  project: AutoMovieProductionProject;
  compileFingerprint: AutoMovieContentDigest;
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
  first: { shot: string; sourceFrame: number };
  width: number;
  height: number;
  fps: number;
}): Promise<IAutoMovieProductionRenderRuntimeIdentity> => {
  const preflight = await captureProductionFrame({
    projectRoot: root,
    productionId,
    compileFingerprint: props.compileFingerprint,
    target: { kind: "shot", id: props.first.shot },
    time: props.first.sourceFrame / props.timeline.fps,
    pass: "beauty",
    width: props.width,
    height: props.height,
  });
  return {
    protocolVersion: "automovie.production-render-runtime.v1",
    sourceDigest: renderSourceDigest(props.project, props.timeline),
    capture: preflight.runtimeIdentity,
    encoder: productionEncoderIdentity(props.fps),
  };
};

const productionEncoderIdentity = (
  fps: number,
): IAutoMovieProductionEncoderIdentity => {
  const encoder = packageSnapshotIdentity(
    snapshotRuntimePackage({
      entry: require.resolve("h264-mp4-encoder"),
      packageName: "h264-mp4-encoder",
    }),
  );
  return {
    ...encoder,
    codec: "h264",
    arguments: {
      quantizationParameter: 24,
      speed: 10,
      groupOfPictures: fps,
    },
  };
};

const chunkDirectory = (digest: AutoMovieContentDigest): string =>
  renderChunkPublicationPath({
    chunk: digest,
    root,
    scope: renderLivenessScope,
    tier: renderTier.kind,
  });

const renderGarbageCollection = (apply: boolean) => {
  if (apply === false) return collectRenderGarbage(false);
  const lease = acquireRenderGcLease({
    coordinationRoot: root,
    pid: process.pid,
    processAlive,
    scope: renderLivenessScope,
  });
  try {
    assertNoLiveRenderWorkers();
    return collectRenderGarbage(true);
  } finally {
    releaseRenderLivenessLease(lease);
  }
};

const collectRenderGarbage = (apply: boolean) => {
  const currentCompileFingerprint = sourceFingerprint();
  const plans = (["proxy", "final"] as const).flatMap((tier) => {
    const file = path.join(renderJobRoot, tier, "plan.json");
    if (fs.existsSync(file) === false) return [];
    const plan = readRendererJson<IAutoMovieProductionRenderJobPlan>(
      renderJobRoot,
      file,
    );
    const currentTier =
      tier === "proxy" ? config.render.proxy : config.render.final;
    return plan.compileFingerprint === currentCompileFingerprint &&
      isDeepStrictEqual(plan.tier, currentTier)
      ? [plan]
      : [];
  });
  const project = AutoMovieProductionProject.open(root, productionId);
  const renderRoot = project.renderRoot();
  const reviewBundles = new Set(
    inspectAutoMovieProduction(productionServices()).reviews.entries.flatMap(
      (entry) => {
        const review = project.review(entry.target);
        return (
          review?.checks.flatMap((check) =>
            check.evidence.flatMap((evidence) =>
              evidence.kind === "frame" ? [evidence.bundle] : [],
            ),
          ) ?? []
        );
      },
    ),
  );
  const manifestPath = path.join(productionStateRoot, "render-manifest.json");
  const publicationPaths = new Set(
    fs.existsSync(manifestPath)
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
  for (const tier of ["proxy", "final"] as const) {
    const chunks = path.join(renderJobRoot, tier, "chunks");
    if (fs.existsSync(chunks))
      for (const entry of fs
        .readdirSync(chunks, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        if (
          entry.isDirectory() === false ||
          /^[0-9a-f]{64}$/u.test(entry.name) === false
        )
          continue;
        const target = path.join(chunks, entry.name);
        const candidate: IAutoMovieProductionRenderGcCandidate = {
          path: `${tier}/chunks/${entry.name}`,
          kind: "chunk",
          digest: `sha256:${entry.name}`,
          bytes: 0,
        };
        const snapshot = captureRenderGcTarget(renderJobRoot, target);
        candidate.bytes = snapshot.bytes;
        candidates.push(candidate);
        candidateSnapshots.set(gcCandidateKey(candidate), snapshot);
      }
    const quarantineRoot = path.join(renderJobRoot, tier, "quarantine");
    if (fs.existsSync(quarantineRoot))
      for (const entry of fs
        .readdirSync(quarantineRoot, { withFileTypes: true })
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        if (entry.isSymbolicLink()) continue;
        const target = path.join(quarantineRoot, entry.name);
        const candidate: IAutoMovieProductionRenderGcCandidate = {
          path: `${tier}/quarantine/${entry.name}`,
          kind: "quarantine",
          digest: null,
          bytes: 0,
        };
        const snapshot = captureRenderGcTarget(renderJobRoot, target);
        candidate.bytes = snapshot.bytes;
        candidates.push(candidate);
        candidateSnapshots.set(gcCandidateKey(candidate), snapshot);
      }
  }
  if (fs.existsSync(renderRoot))
    for (const file of physicalFiles(renderRoot)) {
      const relative = normalizeSlash(path.relative(renderRoot, file));
      if (isRenderGcPreservedPath(relative)) continue;
      if (
        [...reviewBundles].some(
          (bundle) => relative === bundle || relative.startsWith(`${bundle}/`),
        ) ||
        plans.some((plan) => {
          const segments = relative.split("/");
          return (
            segments[0] === "deliverables" &&
            segments[1] === plan.tier.kind &&
            segments[2] === renderPublicationFingerprint(plan).slice(7)
          );
        })
      )
        publicationPaths.add(`publication/${relative}`);
      const candidate: IAutoMovieProductionRenderGcCandidate = {
        path: `publication/${relative}`,
        kind: "publication",
        digest: null,
        bytes: 0,
      };
      const snapshot = captureRenderGcTarget(renderRoot, file);
      candidate.bytes = snapshot.bytes;
      candidates.push(candidate);
      candidateSnapshots.set(gcCandidateKey(candidate), snapshot);
    }
  const plan = planProductionRenderGc({
    plans,
    publicationPaths: [...publicationPaths],
    candidates,
  });
  if (apply) {
    const quarantines = new Map<string, string>();
    for (const candidate of plan.remove) {
      const target =
        candidate.kind === "publication"
          ? path.resolve(
              renderRoot,
              candidate.path.slice("publication/".length),
            )
          : path.resolve(renderJobRoot, candidate.path);
      const base =
        candidate.kind === "publication"
          ? path.resolve(renderRoot)
          : path.resolve(renderJobRoot);
      if (target.startsWith(`${base}${path.sep}`) === false)
        throw new Error(`GC target "${target}" escapes renderer ownership.`);
      const snapshot = candidateSnapshots.get(gcCandidateKey(candidate));
      if (
        snapshot === undefined ||
        snapshot.target !== target ||
        snapshot.base.path !== base
      )
        throw new Error(
          `GC target "${target}" has no matching inventory snapshot.`,
        );
      let quarantine = quarantines.get(base);
      if (quarantine === undefined) {
        quarantine = ensureRenderPhysicalDirectory(
          base,
          `${RENDER_GC_PRESERVED_PREFIX}${randomUUID()}`,
        );
        quarantines.set(base, quarantine);
      }
      const isolated = path.join(quarantine, randomUUID());
      removeCapturedRenderGcTarget({
        isolated,
        quarantine,
        snapshot,
      });
    }
    for (const quarantine of quarantines.values())
      if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
  }
  return { applied: apply, ...plan };
};

const gcCandidateKey = (
  candidate: Pick<IAutoMovieProductionRenderGcCandidate, "kind" | "path">,
): string => `${candidate.kind}\0${candidate.path}`;

const assertNoLiveRenderWorkers = (): void => {
  for (const tier of ["proxy", "final"] as const) {
    const tierRoot = path.join(renderJobRoot, tier);
    const locks = path.join(tierRoot, "locks");
    if (fs.existsSync(locks))
      for (const file of physicalFiles(locks).filter((candidate) =>
        candidate.endsWith(".lock"),
      )) {
        const snapshot = captureExistingRenderTarget(tierRoot, file);
        if (snapshot === null) continue;
        const owner = readCapturedRenderJson<IRenderChunkLockOwner>(
          snapshot,
          RENDER_LOCK_JSON_MAX_BYTES,
        );
        if (Number.isSafeInteger(owner.pid) && processAlive(owner.pid))
          throw new Error(
            `Render GC --apply refuses live ${tier} worker ${owner.pid} at "${file}". Wait for that worker or stop it explicitly.`,
          );
      }
    const attempts = path.join(tierRoot, "attempts");
    if (fs.existsSync(attempts))
      for (const file of physicalFiles(attempts).filter((candidate) =>
        candidate.endsWith(".json"),
      )) {
        const snapshot = captureExistingRenderTarget(tierRoot, file);
        if (snapshot === null) continue;
        const attempt = readCapturedRenderJson<{
          state?: string;
          pid?: number;
        }>(snapshot);
        if (
          attempt.state === "running" &&
          Number.isSafeInteger(attempt.pid) &&
          processAlive(attempt.pid!)
        )
          throw new Error(
            `Render GC --apply refuses live ${tier} attempt ${attempt.pid} at "${file}". Wait for that worker or stop it explicitly.`,
          );
      }
  }
};

const renderPublicationFingerprint = (
  plan: IAutoMovieProductionRenderJobPlan,
): AutoMovieContentDigest =>
  digestAutoMovieBytes(
    Buffer.from(
      JSON.stringify({
        protocol: "automovie.production-publication.v2",
        productionId: plan.productionId,
        compileFingerprint: plan.compileFingerprint,
        editFingerprint: plan.editFingerprint,
        runtimeIdentity: plan.runtimeIdentity,
        tier: plan.tier,
        sourceFrameFormat: plan.sourceFrameFormat,
        frameFormat: plan.frameFormat,
        totalFrames: plan.totalFrames,
        chunkFrames: plan.chunkFrames,
        chunks: plan.chunks.map((chunk) => ({
          slot: chunk.slot,
          id: chunk.id,
          pass: chunk.pass,
        })),
        tracks: plan.tracks,
      }),
      "utf8",
    ),
  );

const physicalFiles = (directory: string): string[] => {
  const output: string[] = [];
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Render GC refuses linked publication "${target}".`);
    if (entry.isDirectory()) output.push(...physicalFiles(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
};

const normalizeSlash = (value: string): string => value.replaceAll("\\", "/");

const recoverAbandonedTemporaryDirectories = (
  chunks: readonly IAutoMovieProductionRenderChunk[],
): void => {
  const currentChunks = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const locks = path.join(stateRoot, "locks");
  if (fs.existsSync(locks))
    for (const slot of fs
      .readdirSync(locks, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => compareCodeUnits(left.name, right.name)))
      for (const entry of fs
        .readdirSync(path.join(locks, slot.name), { withFileTypes: true })
        .filter((candidate) => candidate.name.endsWith(".candidate"))
        .sort((left, right) => compareCodeUnits(left.name, right.name))) {
        const target = path.join(locks, slot.name, entry.name);
        const match = /^claim\.(\d+)\.[^.]+\.lock\.candidate$/u.exec(
          entry.name,
        );
        const pid = Number(match?.[1]);
        const snapshot = captureAbandonedRenderStateTarget(target, pid);
        if (snapshot === null) continue;
        quarantine(target, "abandoned-lock-candidate", snapshot);
      }
  const directory = path.join(stateRoot, "tmp");
  if (fs.existsSync(directory) === false) return;
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const target = path.join(directory, entry.name);
    const pid = Number(entry.name.split(".").at(-1));
    const snapshot = captureAbandonedRenderStateTarget(target, pid);
    if (snapshot === null) continue;
    if (currentPublicationProtectsTree(currentChunks, entry.name, snapshot))
      continue;
    quarantine(target, "abandoned-partial", snapshot);
  }
};

const quarantineStaleSlotOutputs = (
  chunks: readonly IAutoMovieProductionRenderChunk[],
): void => {
  const currentIds = new Set(chunks.map((chunk) => chunk.id));
  const currentChunks = new Map(chunks.map((chunk) => [chunk.slot, chunk.id]));
  const pointerPrefix = `.automovie-chunk-${renderLivenessScope}.${renderTier.kind}.`;
  for (const name of fs
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
      pointerSnapshot = captureRenderGcTarget(root, pointer);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    let current = false;
    try {
      const publication =
        captureRenderChunkPublicationFromPointer(pointerSnapshot);
      current =
        currentIds.has(digest) &&
        publication.receipt.chunk === digest &&
        currentChunks.get(publication.receipt.slot) === digest;
    } catch {
      current = false;
    }
    if (current === false) removeCapturedRenderChunkPointer(pointerSnapshot);
  }
  const directory = path.join(stateRoot, "chunks");
  if (fs.existsSync(directory) === false) return;
  for (const entry of fs
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
    return captureRenderGcTarget(root, chunkDirectory(chunk.id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

const currentPublicationProtectsTree = (
  chunks: ReadonlyMap<AutoMovieContentDigest, IAutoMovieProductionRenderChunk>,
  candidateName: string,
  candidate: IRenderGcTargetSnapshot,
): boolean => {
  const match = /^([0-9a-f]{64})\.[^.]+\.\d+$/u.exec(candidateName);
  if (match === null) return false;
  const digest = `sha256:${match[1]}` as AutoMovieContentDigest;
  const chunk = chunks.get(digest);
  if (chunk === undefined) return false;
  const pointer = captureCurrentChunkPointer(chunk);
  if (pointer === null) return false;
  try {
    const publication = captureRenderChunkPublicationFromPointer(pointer);
    return (
      publication.receipt.chunk === digest &&
      publication.receipt.slot === chunk.slot &&
      renderChunkPublicationProtectsTree(publication, candidate)
    );
  } catch {
    // Only the complete exact canonical pointer protects a dead temp tree.
    return false;
  }
};

const attemptPath = (chunk: IAutoMovieProductionRenderChunk): string =>
  path.join(
    stateRoot,
    "attempts",
    `${encodeAutoMoviePathSegment(chunk.slot)}.json`,
  );

const legacyLockPath = (chunk: IAutoMovieProductionRenderChunk): string =>
  path.join(
    stateRoot,
    "locks",
    `${encodeAutoMoviePathSegment(chunk.slot)}.lock`,
  );

const chunkLockDirectory = (chunk: IAutoMovieProductionRenderChunk): string =>
  path.join(stateRoot, "locks", encodeAutoMoviePathSegment(chunk.slot));

const chunkLockClaims = (chunk: IAutoMovieProductionRenderChunk): string[] => {
  const directory = chunkLockDirectory(chunk);
  const claims = fs.existsSync(directory)
    ? fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".lock"))
        .map((entry) => path.join(directory, entry.name))
    : [];
  const legacy = legacyLockPath(chunk);
  if (fs.existsSync(legacy)) claims.push(legacy);
  return claims.sort(compareCodeUnits);
};

const readAllJson = <T>(directory: string, suffix: string): T[] =>
  fs.existsSync(directory)
    ? listFiles(directory)
        .filter((file) => file.endsWith(suffix))
        .flatMap((file) => {
          try {
            return [readJson<T>(file)];
          } catch {
            return [];
          }
        })
    : [];

const listFiles = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolute) : [absolute];
    });

const readRegularInside = (directory: string, relative: string): Uint8Array => {
  return readAutoMovieProductionOwnedFile({
    root: stateRoot,
    directory,
    relative,
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
    return captureRenderGcTarget(base, target);
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
  pid: number,
): IRenderGcTargetSnapshot | null => {
  const validPid = Number.isSafeInteger(pid) && pid > 0;
  if (validPid && processAlive(pid)) return null;
  let snapshot: IRenderGcTargetSnapshot | null;
  try {
    snapshot = captureExistingRenderStateTarget(target);
  } catch (error) {
    if (validPid && processAlive(pid)) return null;
    throw error;
  }
  if (validPid && processAlive(pid)) return null;
  return snapshot;
};

const readCapturedRenderJson = <T>(
  snapshot: IRenderGcTargetSnapshot,
  maximumBytes: number = snapshot.bytes,
): T =>
  JSON.parse(
    Buffer.from(readCapturedRenderGcFile(snapshot, maximumBytes)).toString(
      "utf8",
    ),
  ) as T;

const removeCapturedRenderStateTarget = (
  snapshot: IRenderGcTargetSnapshot,
): void => {
  const quarantine = ensureRenderPhysicalDirectory(
    stateRoot,
    `${RENDER_GC_PRESERVED_PREFIX}${randomUUID()}`,
  );
  try {
    removeCapturedRenderGcTarget({
      isolated: path.join(quarantine, randomUUID()),
      quarantine,
      snapshot,
    });
  } finally {
    if (fs.readdirSync(quarantine).length === 0) fs.rmdirSync(quarantine);
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
  const snapshot = captured ?? captureRenderGcTarget(stateRoot, absolute);
  if (snapshot.target !== absolute)
    throw new Error(`Render quarantine target "${target}" changed namespace.`);
  const directory = ensureRenderPhysicalDirectory(stateRoot, "quarantine");
  const preserved = ensureRenderPhysicalDirectory(
    stateRoot,
    `${RENDER_GC_PRESERVED_PREFIX}${randomUUID()}`,
  );
  try {
    quarantineCapturedRenderTarget({
      destination: path.join(
        directory,
        `${path.basename(target)}.${reason}.${Date.now()}.${process.pid}.${randomUUID()}`,
      ),
      isolated: path.join(preserved, randomUUID()),
      quarantine: preserved,
      snapshot,
    });
  } finally {
    if (fs.readdirSync(preserved).length === 0) fs.rmdirSync(preserved);
  }
};

const processAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const writeFileAtomic = (file: string, bytes: Uint8Array): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

const writeJsonAtomic = (file: string, value: unknown): void =>
  writeFileAtomic(file, Buffer.from(`${JSON.stringify(value, null, 2)}\n`));

const readJson = <T>(file: string): T =>
  JSON.parse(
    Buffer.from(
      readRegularInside(path.dirname(file), path.basename(file)),
    ).toString("utf8"),
  ) as T;

const readRendererJson = <T>(ownershipRoot: string, file: string): T =>
  JSON.parse(
    Buffer.from(
      readAutoMovieProductionOwnedFile({
        root: ownershipRoot,
        directory: path.dirname(file),
        relative: path.basename(file),
      }),
    ).toString("utf8"),
  ) as T;

const integerOption = (name: string, fallback: number): number => {
  const raw = stringOption(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (Number.isSafeInteger(parsed) === false || parsed <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

const stringOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`${name} requires a value.`);
  return value;
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** One review target as a stable operator-facing label. */
const reviewTargetLabel = (target: IAutoMovieReviewTarget): string =>
  target.kind === "design"
    ? `design:${target.design.kind}`
    : target.kind === "source"
      ? `source:${target.path}`
      : `${target.kind}:${target.id}`;

const output = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const renderProgress = (
  stage: string,
  details: Readonly<Record<string, number | string>> = {},
): void => {
  process.stderr.write(
    `[automovie:render] ${JSON.stringify({ stage, ...details })}\n`,
  );
};

try {
  await main();
} finally {
  await closeProductionFrameCapture();
}
