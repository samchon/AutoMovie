import type {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMoviePreviewFrameOutput,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionMediaProbe,
  IAutoMovieProductionRenderManifest,
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
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderRuntimeIdentity,
  canonicalAutoMovieCaptureRuntimeIdentity,
  digestAutoMovieBytes,
  encodeAutoMoviePathSegment,
  planProductionRenderJob,
  probeProductionMedia,
  productionPublicationInputFingerprint,
  productionRenderChunkStatuses,
  readAutoMovieFilmTimeline,
  runProductionRenderJob,
  sampleProductionRenderFrame,
  selectAutoMovieFilmReviewFrames,
  verifyProductionRenderChunkReceipt,
} from "@automovie/mcp";
import * as HME from "h264-mp4-encoder";
import { createFile } from "mp4box";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { PNG } from "pngjs";

import { captureProductionFrame, closeProductionFrameCapture } from "./capture";

const root = process.cwd();
const stateRoot = path.join(root, ".automovie", "render-job");
const planPath = path.join(stateRoot, "plan.json");
const action = process.argv[2] ?? "all";
const require = createRequire(import.meta.url);
const heldChunkLocks = new Map<string, { path: string; token: string }>();

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
    action !== "finalize"
  )
    throw new Error(
      `Unknown render action "${action}". Use plan, run, status, verify, or finalize.`,
    );
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
      const runtimeIdentity = await currentRenderRuntimeIdentity(plan);
      output(
        isDeepStrictEqual(runtimeIdentity, plan.runtimeIdentity)
          ? await renderStatus(plan)
          : stalePlanRows(
              plan,
              "Capture, graphics, render-source, or encoder identity changed. Run automovie render plan, then rerender only the new chunk identities.",
            ),
      );
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
    recoverAbandonedTemporaryDirectories();
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
      },
      result,
      chunks: await renderStatus(current),
    });
    if (result.failed.length !== 0 || result.busy.length !== 0)
      process.exitCode = 1;
    if (action === "run" || process.exitCode === 1) return;
  }
  output(await finalize(current));
};

const sourceFingerprint = (): AutoMovieContentDigest => {
  const checked = new AutoMovieProductionCompiler(
    AutoMovieProductionProject.open(root),
  ).lint({ scope: "source" });
  if (checked.success === false)
    throw new Error(
      `Source lint failed while checking render status: ${JSON.stringify(
        checked.diagnostics,
      )}`,
    );
  return checked.compiler.inputFingerprint;
};

const captureReviewEvidence = async (): Promise<
  IAutoMoviePreviewFrameOutput[]
> => {
  const app = productionApplication();
  const compiled = app.compileProject({ scope: "source" });
  if (compiled.success === false)
    throw new Error(
      `Source compilation failed before review capture: ${JSON.stringify(
        compiled.diagnostics,
      )}`,
    );
  const project = AutoMovieProductionProject.open(root);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Review capture requires a production design.");
  const timeline = readAutoMovieFilmTimeline(
    project,
    compiled.compiler.inputFingerprint,
  );
  const frames: IAutoMoviePreviewFrameOutput[] = [];
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
          await app.previewFrame({
            target: { kind: "shot", id: segment.shot },
            time: request.time,
            pass,
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
  const app = productionApplication();
  const compiled = app.compileProject({ scope: "source" });
  if (compiled.success === false)
    throw new Error(
      `Source compilation failed before render planning: ${JSON.stringify(
        compiled.diagnostics,
      )}`,
    );
  const project = AutoMovieProductionProject.open(root);
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
  const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1)!;
  const runtimeIdentity = await renderRuntimeIdentity({
    project,
    compileFingerprint: compiled.compiler.inputFingerprint,
    timeline,
    first,
    width: graph.production.frameFormat.width,
    height: graph.production.frameFormat.height,
  });
  const planned = planProductionRenderJob({
    timeline,
    production: graph.production,
    audioAssets: productionAudioAssets(project, timeline),
    runtimeIdentity,
    sourceFingerprints: renderShotFingerprints(project, timeline),
    chunkFrames: integerOption("--chunk-frames", 48),
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
      JSON.stringify(
        project
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
      ),
      "utf8",
    ),
  );

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
  const receipts = readAllJson<IAutoMovieProductionRenderChunkReceipt>(
    path.join(stateRoot, "chunks"),
    "receipt.json",
  );
  const attempts = readAllJson<{
    slot: string;
    chunk: AutoMovieContentDigest;
    state: "running" | "failed";
    correction: string;
  }>(path.join(stateRoot, "attempts"), ".json");
  const rows = productionRenderChunkStatuses({ plan, receipts, attempts });
  return Promise.all(
    rows.map(async (row, index) => {
      if (row.status !== "complete") return row;
      const current = await currentReceipt(plan.chunks[index]!);
      return current === null
        ? {
            ...row,
            status: "failed" as const,
            correction:
              "Receipt bytes are partial, corrupt, or parser-inconsistent. Quarantine and rerender this chunk.",
          }
        : row;
    }),
  );
};

const currentReceipt = async (
  chunk: IAutoMovieProductionRenderChunk,
): Promise<IAutoMovieProductionRenderChunkReceipt | null> => {
  const directory = chunkDirectory(chunk.id);
  const receiptFile = path.join(directory, "receipt.json");
  if (fs.existsSync(receiptFile) === false) return null;
  try {
    const plan = readPlan();
    const receipt =
      readJson<IAutoMovieProductionRenderChunkReceipt>(receiptFile);
    verifyProductionRenderChunkReceipt({ plan, chunk, receipt });
    for (const frame of receipt.frames) {
      const bytes = readRegularInside(directory, frame.path);
      const probe = probeProductionMedia({
        kind: "preview",
        mediaType: "image/png",
        bytes,
      });
      if (
        digestAutoMovieBytes(bytes) !== frame.digest ||
        bytes.length !== frame.bytes ||
        probe.kind !== "png" ||
        probe.width !== frame.width ||
        probe.height !== frame.height
      )
        return null;
    }
    const encoded = readRegularInside(directory, receipt.encoded.path);
    const video = probeProductionMedia({
      kind: chunk.kind,
      mediaType: "video/mp4",
      bytes: encoded,
    });
    if (
      digestAutoMovieBytes(encoded) !== receipt.encoded.digest ||
      encoded.length !== receipt.encoded.bytes ||
      video.kind !== "video" ||
      video.width !== plan.frameFormat.width ||
      video.height !== plan.frameFormat.height ||
      video.frameCount !== chunk.frames.length ||
      Math.abs(video.fps - plan.frameFormat.fps) > 1e-9
    )
      return null;
    return receipt;
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
      try {
        owner = readJson<IRenderChunkLockOwner>(file);
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
        quarantine(file, "abandoned-lock");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const owner = readJson<IRenderChunkLockOwner>(claim);
    if (
      owner.chunk !== chunk.id ||
      owner.pid !== process.pid ||
      owner.token !== token
    )
      throw new Error(
        `Chunk lock claim "${claim}" changed before rendering began.`,
      );
    heldChunkLocks.set(chunk.slot, { path: claim, token });
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
  quarantineStaleSlotOutputs(chunk);
  const temporary = path.join(
    stateRoot,
    "tmp",
    `${chunk.id.slice(7)}.${process.pid}`,
  );
  if (fs.existsSync(temporary)) quarantine(temporary, "partial");
  fs.mkdirSync(temporary, { recursive: true });
  writeJsonAtomic(attemptPath(chunk), {
    slot: chunk.slot,
    chunk: chunk.id,
    state: "running",
    correction: "",
    pid: process.pid,
  });
  const frameReceipts: IAutoMovieProductionRenderChunkReceipt["frames"] = [];
  for (const sample of chunk.frames) {
    const images: Array<{ image: PNG; weight: number }> = [];
    for (const layer of sample.layers) {
      const captured = await captureProductionFrame({
        projectRoot: root,
        compileFingerprint: plan.compileFingerprint,
        target: { kind: "shot", id: layer.shot },
        time: layer.sourceFrame / plan.frameFormat.fps,
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
    frameReceipts.push({
      globalFrame: sample.globalFrame,
      path: relative,
      digest: digestAutoMovieBytes(bytes),
      bytes: bytes.length,
      width: probe.width,
      height: probe.height,
    });
  }
  const encodedBytes = await encodePngFrames(
    frameReceipts.map((frame) => path.join(temporary, frame.path)),
    plan,
  );
  const encodedPath = "chunk.mp4";
  writeFileAtomic(path.join(temporary, encodedPath), encodedBytes);
  const encodedProbe = probeProductionMedia({
    kind: chunk.kind,
    mediaType: "video/mp4",
    bytes: encodedBytes,
  });
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
  writeJsonAtomic(path.join(temporary, "receipt.json"), receipt);
  const destination = chunkDirectory(chunk.id);
  if (fs.existsSync(destination)) quarantine(destination, "replaced");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(temporary, destination);
  fs.rmSync(attemptPath(chunk), { force: true });
  return receipt;
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
  releaseOwnedChunkClaim(chunk, held.path, held.token);
};

const releaseOwnedChunkClaim = (
  chunk: IAutoMovieProductionRenderChunk,
  file: string,
  token: string,
): void => {
  try {
    const owner = readJson<IRenderChunkLockOwner>(file);
    if (
      owner.chunk === chunk.id &&
      owner.pid === process.pid &&
      owner.token === token
    )
      fs.rmSync(file, { force: true });
  } catch {
    // A missing, unreadable, or replaced claim is not proven to be ours.
  }
};

const finalize = async (plan: IAutoMovieProductionRenderJobPlan) => {
  const app = productionApplication();
  const inspection = app.inspectProject({});
  const incompleteReviews = inspection.reviews.entries.filter(
    (entry) => entry.state !== "complete",
  );
  if (incompleteReviews.length !== 0)
    throw new Error(
      `Final publication is review-blocked by ${incompleteReviews
        .map((entry) => `${reviewTargetLabel(entry.target)}:${entry.state}`)
        .join(", ")}. Run review:status and submit current evidence first.`,
    );
  const status = await renderStatus(plan);
  const project = AutoMovieProductionProject.open(root);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Production design disappeared before final publication.");
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
    if (deliverable.kind === "feature") {
      owned.set(
        "feature.mp4",
        await encodeChunkFrames(plan, deliverableChunks),
      );
    } else if (deliverable.kind === "guide-pass") {
      const passes = [...new Set(deliverableChunks.map((chunk) => chunk.pass))];
      if (passes.length !== 1)
        throw new Error(
          `Guide deliverable "${deliverable.id}" must own one declared pass, but owns ${passes.length}.`,
        );
      owned.set(
        `${passes[0]}.mp4`,
        await encodeChunkFrames(plan, deliverableChunks),
      );
    } else if (deliverable.kind === "captions") {
      if (plan.tracks.captions.split("-->").length < 2) {
        if (deliverable.required)
          throw new Error("Required captions contain no timed compiler cue.");
      } else
        owned.set("captions.vtt", Buffer.from(plan.tracks.captions, "utf8"));
    } else if (deliverable.kind === "audio-mix") {
      if (plan.tracks.audio.some((cue) => cue.gain !== 0))
        throw new Error(
          "The scaffold audio adapter currently accepts zero-gain guide stems only. Supply a package-owned PCM/AAC adapter before requiring audible mix output.",
        );
      owned.set("audio.mp4", deterministicSilentAudio(plan));
    } else {
      const timeline = readAutoMovieFilmTimeline(
        project,
        plan.compileFingerprint,
      );
      const frame = sampleProductionRenderFrame(timeline, 0).layers.at(-1)!;
      const captured = await captureProductionFrame({
        projectRoot: root,
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
        encodeAutoMoviePathSegment(deliverable.id),
        plan.editFingerprint.slice(7),
        name,
      ].join("/");
      const mediaType =
        deliverable.kind === "captions"
          ? "text/vtt"
          : deliverable.kind === "preview"
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
    });
  }
  const snapshot = productionPublicationInputFingerprint(project);
  const revision = project.commitProductionPublication({
    files: publication,
    manifest,
    inputCurrent: () =>
      productionPublicationInputFingerprint(
        AutoMovieProductionProject.open(root),
      ) === snapshot,
    publicationCurrent: () => {
      const stagedProject = AutoMovieProductionProject.open(root);
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
  const final = productionApplication().compileProject({ scope: "final" });
  if (final.success === false)
    throw new Error(
      `Parser-verified publication committed at revision ${revision}, but final compilation rejected it: ${JSON.stringify(final.diagnostics)}`,
    );
  return { revision, manifest, final };
};

const encodeChunkFrames = async (
  plan: IAutoMovieProductionRenderJobPlan,
  chunks: IAutoMovieProductionRenderChunk[],
): Promise<Uint8Array> => {
  if (chunks.length === 0) throw new Error("No current chunks to encode.");
  const paths: string[] = [];
  for (const chunk of chunks.sort(
    (left, right) => left.frameStart - right.frameStart,
  )) {
    const receipt = (await currentReceipt(chunk))!;
    for (const frame of receipt.frames)
      paths.push(path.join(chunkDirectory(chunk.id), frame.path));
  }
  if (paths.length !== plan.totalFrames)
    throw new Error(
      `Final encode has ${paths.length} frames; expected ${plan.totalFrames}.`,
    );
  return encodePngFrames(paths, plan);
};

const encodePngFrames = async (
  files: string[],
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
    for (const file of files) {
      const png = PNG.sync.read(fs.readFileSync(file));
      encoder.addFrameRgba(new Uint8Array(png.data));
    }
    encoder.finalize();
    return Uint8Array.from(encoder.FS.readFile(encoder.outputFilename));
  } finally {
    encoder.delete();
  }
};

const deterministicSilentAudio = (
  plan: IAutoMovieProductionRenderJobPlan,
): Uint8Array => {
  // Raw AAC-LC silence access units at 48 kHz stereo. The container duration is
  // exact even when the final access unit is shorter than 1024 samples.
  const sampleRate = 48_000;
  const total = Math.round(
    (plan.totalFrames / plan.frameFormat.fps) * sampleRate,
  );
  const file = createFile();
  file.init({
    brands: ["isom", "iso2", "mp41"],
    timescale: sampleRate,
    duration: total,
  });
  const track = file.addTrack({
    type: "mp4a",
    hdlr: "soun",
    name: "AutoMovie deterministic silence",
    timescale: sampleRate,
    media_duration: total,
    duration: total,
    samplerate: sampleRate,
    channel_count: 2,
    samplesize: 16,
  });
  for (let dts = 0; dts < total; dts += 1_024)
    file.addSample(
      track,
      Uint8Array.from([0x21, 0x10, 0x04, 0x60, 0x8c, 0x1c]),
      {
        duration: Math.min(1_024, total - dts),
        dts,
        cts: dts,
        is_sync: true,
      },
    );
  return new Uint8Array(file.getBuffer().buffer);
};

const assertDeliverableProbe = (
  kind: IAutoMovieProductionDeliverable["kind"],
  probe: IAutoMovieProductionMediaProbe,
  plan: IAutoMovieProductionRenderJobPlan,
): void => {
  const runtimeSeconds = plan.totalFrames / plan.frameFormat.fps;
  if (kind === "feature" || kind === "guide-pass") {
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
    capture: captureProductionFrame,
  });
  app.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
  app.getGuideDocument({ name: "COMPILATION" });
  app.getGuideDocument({ name: "PRODUCTION_RENDER" });
  app.openProject({ root });
  return app;
};

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
    const runtimeIdentity = await currentRenderRuntimeIdentity(plan);
    if (isDeepStrictEqual(runtimeIdentity, plan.runtimeIdentity) === false)
      throw new Error(
        "The stored render runtime identity changed. Run automovie render plan, then rerender only changed chunk identities.",
      );
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

const currentRenderRuntimeIdentity = async (
  plan: IAutoMovieProductionRenderJobPlan,
): Promise<IAutoMovieProductionRenderRuntimeIdentity> => {
  const project = AutoMovieProductionProject.open(root);
  const graph = project.graph();
  if (graph.production === null)
    throw new Error("Render runtime preflight requires a production design.");
  const timeline = readAutoMovieFilmTimeline(project, plan.compileFingerprint);
  const first = sampleProductionRenderFrame(timeline, 0).layers.at(-1);
  if (first === undefined)
    throw new Error("Render runtime preflight requires one film video frame.");
  return renderRuntimeIdentity({
    project,
    compileFingerprint: plan.compileFingerprint,
    timeline,
    first,
    width: graph.production.frameFormat.width,
    height: graph.production.frameFormat.height,
  });
};

const renderRuntimeIdentity = async (props: {
  project: AutoMovieProductionProject;
  compileFingerprint: AutoMovieContentDigest;
  timeline: ReturnType<typeof readAutoMovieFilmTimeline>;
  first: { shot: string; sourceFrame: number };
  width: number;
  height: number;
}): Promise<IAutoMovieProductionRenderRuntimeIdentity> => {
  const preflight = await captureProductionFrame({
    projectRoot: root,
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
    encoder: productionEncoderIdentity(props.timeline.fps),
  };
};

const productionEncoderIdentity = (
  fps: number,
): IAutoMovieProductionEncoderIdentity => {
  const encoderEntry = require.resolve("h264-mp4-encoder");
  const encoderPackage = JSON.parse(
    fs.readFileSync(require.resolve("h264-mp4-encoder/package.json"), "utf8"),
  ) as { version: string };
  return {
    package: "h264-mp4-encoder",
    version: encoderPackage.version,
    entryDigest: digestAutoMovieBytes(fs.readFileSync(encoderEntry)),
    codec: "h264",
    arguments: {
      quantizationParameter: 24,
      speed: 10,
      groupOfPictures: fps,
    },
  };
};

const chunkDirectory = (digest: AutoMovieContentDigest): string =>
  path.join(stateRoot, "chunks", digest.slice(7));

const recoverAbandonedTemporaryDirectories = (): void => {
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
        if (
          entry.isFile() === false ||
          Number.isSafeInteger(pid) === false ||
          pid <= 0 ||
          processAlive(pid) === false
        )
          quarantine(target, "abandoned-lock-candidate");
      }
  const directory = path.join(stateRoot, "tmp");
  if (fs.existsSync(directory) === false) return;
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const target = path.join(directory, entry.name);
    const pid = Number(entry.name.split(".").at(-1));
    if (
      entry.isDirectory() === false ||
      Number.isSafeInteger(pid) === false ||
      pid <= 0 ||
      processAlive(pid) === false
    )
      quarantine(target, "abandoned-partial");
  }
};

const quarantineStaleSlotOutputs = (
  chunk: IAutoMovieProductionRenderChunk,
): void => {
  const directory = path.join(stateRoot, "chunks");
  if (fs.existsSync(directory) === false) return;
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((candidate) => candidate.isDirectory())
    .sort((left, right) => compareCodeUnits(left.name, right.name))) {
    const target = path.join(directory, entry.name);
    const receiptFile = path.join(target, "receipt.json");
    let receipt: IAutoMovieProductionRenderChunkReceipt;
    try {
      receipt = readJson<IAutoMovieProductionRenderChunkReceipt>(receiptFile);
    } catch {
      // An unreadable unrelated directory has no trustworthy slot ownership.
      continue;
    }
    if (receipt.slot === chunk.slot && receipt.chunk !== chunk.id)
      quarantine(target, "stale-slot");
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
  const absolute = path.resolve(directory, relative);
  const prefix = `${path.resolve(directory)}${path.sep}`;
  if (
    absolute.startsWith(prefix) === false ||
    fs.lstatSync(absolute).isFile() === false ||
    fs.lstatSync(absolute).isSymbolicLink()
  )
    throw new Error(
      `Chunk path "${relative}" is not a contained regular file.`,
    );
  return fs.readFileSync(absolute);
};

const quarantine = (target: string, reason: string): void => {
  const absolute = path.resolve(target);
  const prefix = `${path.resolve(stateRoot)}${path.sep}`;
  if (absolute.startsWith(prefix) === false)
    throw new Error(
      `Refusing to quarantine path outside render state: ${target}`,
    );
  const directory = path.join(stateRoot, "quarantine");
  fs.mkdirSync(directory, { recursive: true });
  fs.renameSync(
    absolute,
    path.join(
      directory,
      `${path.basename(target)}.${reason}.${Date.now()}.${process.pid}`,
    ),
  );
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
  JSON.parse(fs.readFileSync(file, "utf8")) as T;

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

try {
  await main();
} finally {
  await closeProductionFrameCapture();
}
