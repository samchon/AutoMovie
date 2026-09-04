import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
} from "@automovie/interface";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Package-owned encoder identity fenced into every chunk.
 */
export interface IAutoMovieProductionEncoderIdentity {
  /**
   * Exact installed package name.
   */
  package: string;
  /**
   * Exact installed package version.
   */
  version: string;
  /**
   * Canonical digest of the complete installed executable closure.
   */
  closureDigest: AutoMovieContentDigest;
  /**
   * Closed codec family emitted by the foundation adapter.
   */
  codec: "h264";
  /**
   * Every encoder argument that can affect output bytes.
   */
  arguments: {
    /** Constant-rate-factor analogue accepted by the package encoder. */
    quantizationParameter: number;
    /** Package encoder speed setting. */
    speed: number;
    /** Key-frame period in frames. */
    groupOfPictures: number;
  };
}

/**
 * Capture and encoder identity for one homogeneous render job.
 */
export interface IAutoMovieProductionRenderRuntimeIdentity {
  /**
   * Render-runtime identity schema.
   */
  protocolVersion: "automovie.production-render-runtime.v3";
  /**
   * Digest of declared viewer, capture, asset, and package input bytes.
   */
  sourceDigest: AutoMovieContentDigest;
  /**
   * Final-byte dialogue and viseme runtime installed for every capture, or null
   * when the planned production is deliberately silent.
   *
   * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-freshness Identifies the current dialogue derivation required by every planned frame capture.
   * @evidence specifications/narrative-and-intent/budgets-continuity-and-deliverables.md#narrative-intent-deliverable-authority-gaps Carries the renderer input identity required to classify every derived capture as current or stale.
   */
  dialogueRuntimeIdentity: AutoMovieContentDigest | null;
  /**
   * Package-owned browser and graphics identity.
   */
  capture: IAutoMovieCaptureRuntimeIdentity;
  /**
   * Package-owned encoder binary and argument identity.
   */
  encoder: IAutoMovieProductionEncoderIdentity;
}

/**
 * Explicit cost/quality tier sharing one compiler-owned edit.
 */
export interface IAutoMovieProductionRenderTier {
  /**
   * Stable tier identity used in slots, chunks, and publication paths.
   */
  kind: "proxy" | "final";
  /**
   * Output raster multiplier in `(0, 1]`; final is exactly one.
   */
  resolutionScale: number;
  /**
   * Keep every Nth source frame; final is exactly one.
   */
  frameStep: number;
}

/**
 * One source image participating in a film-global output frame.
 */
export interface IAutoMovieProductionRenderLayer {
  /**
   * Compiler-owned shot id.
   */
  shot: string;
  /**
   * Exact shot-local integer source frame.
   */
  sourceFrame: number;
  /**
   * Linear compositing weight in `[0, 1]`.
   */
  weight: number;
}

/**
 * One exact film-global frame with transitions already resolved.
 */
export interface IAutoMovieProductionRenderFrame {
  /**
   * Exact zero-based output frame in this render tier.
   */
  globalFrame: number;
  /**
   * Exact frame on the compiler-owned full-rate film timeline.
   */
  timelineFrame: number;
  /**
   * Derived film time, never an accumulated clock.
   */
  timeSeconds: number;
  /**
   * One hard-cut/fade layer or two dissolve layers, back to front.
   */
  layers: IAutoMovieProductionRenderLayer[];
}

/**
 * One deterministic, independently lockable render/encode range.
 */
export interface IAutoMovieProductionRenderChunk {
  /**
   * Stable operational slot before content identity changes.
   */
  slot: string;
  /**
   * Content id over edit, pass, frame range, raster, and runtime.
   */
  id: AutoMovieContentDigest;
  /**
   * Production deliverable id that owns the completed range.
   */
  deliverable: string;
  /**
   * Final moving-image deliverable class that owns this video-only chunk.
   */
  kind: "feature" | "guide-pass";
  /**
   * Beauty or the one structural pass declared for this range.
   */
  pass: AutoMovieGuidePass;
  /**
   * Inclusive zero-based film frame.
   */
  frameStart: number;
  /**
   * Exclusive film-frame boundary.
   */
  frameEndExclusive: number;
  /**
   * Exact edit mapping for every frame in the range.
   */
  frames: IAutoMovieProductionRenderFrame[];
}

/**
 * Persisted plan reopened by every `automovie render` subcommand.
 */
export interface IAutoMovieProductionRenderJobPlan {
  /**
   * Plan schema.
   */
  version: 3;
  /**
   * Exact production namespace that owns every slot and output.
   */
  productionId: string;
  /**
   * Compiler source-input fingerprint used by all captures.
   */
  compileFingerprint: AutoMovieContentDigest;
  /**
   * Digest of the compiler-owned film edit.
   */
  editFingerprint: AutoMovieContentDigest;
  /**
   * Homogeneous capture and encoder identity.
   */
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  /**
   * Proxy/final cost policy; both retain the same edit fingerprint.
   */
  tier: IAutoMovieProductionRenderTier;
  /**
   * Compiler-owned full-quality clock and raster before tier sampling.
   */
  sourceFrameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact production raster and frame clock.
   */
  frameFormat: IAutoMovieProductionDesign["frameFormat"];
  /**
   * Exact total film frame count.
   */
  totalFrames: number;
  /**
   * Maximum frames assigned to one independently resumable chunk.
   */
  chunkFrames: number;
  /**
   * Content-addressed video ranges in deterministic order.
   */
  chunks: IAutoMovieProductionRenderChunk[];
  /**
   * Non-video compiler tracks used during terminal publication.
   */
  tracks: {
    /** Canonical WebVTT derived from the caption placements. */
    captions: string;
    /** Exact compiler-owned audio placements. */
    audio: IAutoMovieFilmTimeline["tracks"]["audio"];
    /** Byte, duration, and format identity for every referenced audio asset. */
    audioAssets: IAutoMovieProductionAudioAssetIdentity[];
  };
}

/**
 * Byte-exact PNG committed by one completed chunk.
 */
export interface IAutoMovieProductionRenderedFrameReceipt {
  /**
   * Exact zero-based film frame.
   */
  globalFrame: number;
  /**
   * Chunk-directory-relative PNG path.
   */
  path: string;
  /**
   * Digest of the resident PNG bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Positive resident PNG byte count.
   */
  bytes: number;
  /**
   * Decoded PNG width.
   */
  width: number;
  /**
   * Decoded PNG height.
   */
  height: number;
}

/**
 * Content-only completion facts; attempts and PIDs are deliberately absent.
 */
export interface IAutoMovieProductionRenderChunkReceipt {
  /**
   * Receipt schema.
   */
  version: 1;
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Exact current chunk content id.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Ordered byte facts for the full frame range.
   */
  frames: IAutoMovieProductionRenderedFrameReceipt[];
  /**
   * Parser-verified chunk MP4.
   */
  encoded: {
    /** Chunk-directory-relative MP4 path. */
    path: string;
    /** Digest of the resident MP4 bytes. */
    digest: AutoMovieContentDigest;
    /** Positive resident MP4 byte count. */
    bytes: number;
  };
}

/**
 * Ephemeral attempt state stored outside a completion receipt.
 */
export interface IAutoMovieProductionRenderAttempt {
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Chunk identity attempted by the process.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Non-content attempt state.
   */
  state: "running" | "failed";
  /**
   * Exact recovery action or failure message.
   */
  correction: string;
}

/**
 * One resumable status row with an exact next action.
 */
export interface IAutoMovieProductionRenderChunkStatus {
  /**
   * Stable operational slot.
   */
  slot: string;
  /**
   * Current planned content identity.
   */
  chunk: AutoMovieContentDigest;
  /**
   * Current completion/recovery classification.
   */
  status: "planned" | "running" | "complete" | "stale" | "failed";
  /**
   * Exact next action for this state.
   */
  correction: string;
}

/**
 * Parser/preflight identity for one compiler-declared audio source asset.
 */
export interface IAutoMovieProductionAudioAssetIdentity {
  /**
   * Project-relative compiler-declared asset path.
   */
  path: string;
  /**
   * Digest of the exact current asset bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Declared source duration.
   */
  durationSeconds: number;
  /**
   * Declared PCM clock used by the deterministic adapter.
   */
  sampleRate: number;
  /**
   * Declared channel count used by the deterministic adapter.
   */
  channels: number;
}

/**
 * Build content-addressed chunks from the compiler-owned film edit.
 */
export const planProductionRenderJob = (props: {
  timeline: IAutoMovieFilmTimeline;
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  chunkFrames: number;
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
  /** Explicit proxy/final policy; omitted is the exact final tier. */
  tier?: IAutoMovieProductionRenderTier;
}): IAutoMovieProductionRenderJobPlan => {
  if (
    Number.isSafeInteger(props.chunkFrames) === false ||
    props.chunkFrames <= 0
  )
    throw new Error(
      `chunkFrames must be a positive safe integer, but was ${props.chunkFrames}.`,
    );
  if (validDigest(props.runtimeIdentity.sourceDigest) === false)
    throw new Error(
      "Render runtime sourceDigest must be one current SHA-256 content identity.",
    );
  if (
    props.runtimeIdentity.dialogueRuntimeIdentity !== null &&
    validDigest(props.runtimeIdentity.dialogueRuntimeIdentity) === false
  )
    throw new Error(
      "Render runtime dialogueRuntimeIdentity must be null or one current SHA-256 content identity.",
    );
  const tier = normalizeRenderTier(props.tier);
  const frameFormat = resolveProductionRenderTierFrameFormat(
    props.production.frameFormat,
    tier,
  );
  if (frameFormat.width % 2 !== 0 || frameFormat.height % 2 !== 0)
    throw new Error(
      "The production H.264 render adapter requires even width and height.",
    );
  if (
    props.timeline.id !== props.production.id ||
    props.timeline.fps !== props.production.frameFormat.fps ||
    props.timeline.totalFrames !==
      Math.round(
        props.production.targetRuntimeSeconds *
          props.production.frameFormat.fps,
      )
  )
    throw new Error(
      "The film edit differs from the production identity, frame clock, or runtime. Recompile before planning.",
    );
  if (props.timeline.totalFrames % tier.frameStep !== 0)
    throw new Error(
      `Render tier "${tier.kind}" frameStep ${tier.frameStep} does not divide the ${props.timeline.totalFrames}-frame edit. Choose a divisor so proxy and final have the same exact runtime.`,
    );
  const audioAssets = normalizeAudioAssets(props.audioAssets);
  for (const cue of props.timeline.tracks.audio) {
    const asset = audioAssets.find((candidate) => candidate.path === cue.asset);
    if (
      asset === undefined ||
      Math.round(asset.durationSeconds * props.timeline.fps) !==
        cue.sourceDurationFrames
    )
      throw new Error(
        `Audio cue "${cue.id}" lacks one digest-, format-, and duration-verified source asset.`,
      );
  }
  const legacyGuidePasses = normalizeGuidePasses(props.guidePasses ?? ["pose"]);
  const editFingerprint = digestJson({
    protocol: "automovie.production-render-edit.v1",
    id: props.timeline.id,
    fps: props.timeline.fps,
    totalFrames: props.timeline.totalFrames,
    segments: props.timeline.segments,
    omissions: props.timeline.omissions,
    tracks: props.timeline.tracks,
  });
  const frames = Array.from(
    { length: props.timeline.totalFrames / tier.frameStep },
    (_, outputFrame) => {
      const timelineFrame = outputFrame * tier.frameStep;
      return {
        ...sampleProductionRenderFrame(props.timeline, timelineFrame),
        globalFrame: outputFrame,
        timelineFrame,
        timeSeconds: outputFrame / frameFormat.fps,
      };
    },
  );
  const chunks: IAutoMovieProductionRenderChunk[] = [];
  for (const deliverable of props.production.deliverables) {
    // Only the two moving-image kinds carry chunks. Narrowing here rather than
    // resolving an empty pass list keeps the chunk's own `kind` exact, so a
    // caption or audio deliverable cannot reach a video parser probe.
    if (deliverable.kind !== "feature" && deliverable.kind !== "guide-pass")
      continue;
    const passes: readonly AutoMovieGuidePass[] =
      deliverable.kind === "feature"
        ? ["beauty"]
        : normalizeGuidePasses(
            deliverable.pass === undefined
              ? legacyGuidePasses
              : [deliverable.pass],
          );
    for (const pass of passes)
      for (
        let frameStart = 0, index = 0;
        frameStart < frames.length;
        frameStart += props.chunkFrames, ++index
      ) {
        const frameEndExclusive = Math.min(
          frameStart + props.chunkFrames,
          frames.length,
        );
        const range = frames.slice(frameStart, frameEndExclusive);
        const sources = [
          ...new Set(
            range.flatMap((frame) => frame.layers.map((layer) => layer.shot)),
          ),
        ]
          .sort(compareCodeUnits)
          .map((shot) => {
            const digest = props.sourceFingerprints[shot];
            if (digest === undefined || validDigest(digest) === false)
              throw new Error(
                `Render range references shot "${shot}" without one current compiler-owned source fingerprint.`,
              );
            return { shot, digest };
          });
        const slot = `${props.production.id}:${tier.kind}:${deliverable.id}:${pass}:${index}`;
        const identity = {
          protocol: "automovie.production-render-chunk.v3",
          production: props.production.id,
          tier,
          deliverable: deliverable.id,
          kind: deliverable.kind,
          editFingerprint,
          sourceFrameFormat: props.production.frameFormat,
          frameFormat,
          frameStart,
          frameEndExclusive,
          pass,
          runtimeIdentity: props.runtimeIdentity,
          sources,
        };
        chunks.push({
          slot,
          id: digestJson(identity),
          deliverable: deliverable.id,
          kind: deliverable.kind,
          pass,
          frameStart,
          frameEndExclusive,
          frames: range,
        });
      }
  }
  return {
    version: 3,
    productionId: props.production.id,
    compileFingerprint: props.timeline.inputFingerprint,
    editFingerprint,
    runtimeIdentity: props.runtimeIdentity,
    tier,
    sourceFrameFormat: structuredClone(props.production.frameFormat),
    frameFormat,
    totalFrames: frames.length,
    chunkFrames: props.chunkFrames,
    chunks,
    tracks: {
      captions: canonicalProductionWebVtt(props.timeline),
      audio: structuredClone(props.timeline.tracks.audio),
      audioAssets,
    },
  };
};

/**
 * Prove a persisted plan is exactly reproducible from current compiler inputs.
 */
export const verifyProductionRenderJobPlan = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  timeline: IAutoMovieFilmTimeline;
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
}): void => {
  const expected = planProductionRenderJob({
    timeline: props.timeline,
    production: props.production,
    runtimeIdentity: props.runtimeIdentity,
    sourceFingerprints: props.sourceFingerprints,
    audioAssets: props.audioAssets,
    chunkFrames: props.plan.chunkFrames,
    guidePasses: props.guidePasses,
    tier: props.plan.tier,
  });
  if (canonicalJson(props.plan) !== canonicalJson(expected))
    throw new Error(
      "Stored render plan differs from the current compiler-owned timeline and render inputs. Run automovie render plan, then rerender only changed chunk identities.",
    );
};

/**
 * Resolve one global frame, including exact dissolve and fade weights.
 */
export const sampleProductionRenderFrame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
): IAutoMovieProductionRenderFrame => {
  if (
    Number.isSafeInteger(globalFrame) === false ||
    globalFrame < 0 ||
    globalFrame >= timeline.totalFrames
  )
    throw new Error(
      `Film-global frame ${globalFrame} is outside 0..${timeline.totalFrames - 1}.`,
    );
  const active = timeline.segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment }) =>
        segment.startFrame <= globalFrame && globalFrame < segment.endFrame,
    );
  const current = active.at(-1);
  if (current === undefined)
    throw new Error(
      `Film-global frame ${globalFrame} has no compiler-owned video segment.`,
    );
  const offset = globalFrame - current.segment.startFrame;
  const incoming: IAutoMovieProductionRenderLayer = {
    shot: current.segment.shot,
    sourceFrame: current.segment.sourceInFrame + offset,
    weight: 1,
  };
  if (
    current.segment.transitionIn.kind === "dissolve" &&
    offset < current.segment.transitionIn.durationFrames
  ) {
    const previous = timeline.segments[current.index - 1];
    if (previous === undefined)
      throw new Error(
        `Segment "${current.segment.shot}" dissolves without an outgoing segment.`,
      );
    const alpha = offset / current.segment.transitionIn.durationFrames;
    return frame(timeline, globalFrame, [
      {
        shot: previous.shot,
        sourceFrame:
          previous.sourceOutFrame -
          current.segment.transitionIn.durationFrames +
          offset,
        weight: 1 - alpha,
      },
      { ...incoming, weight: alpha },
    ]);
  }
  const fadeIn =
    current.segment.transitionIn.kind === "fade" &&
    offset < current.segment.transitionIn.durationFrames
      ? offset / current.segment.transitionIn.durationFrames
      : 1;
  const remaining = current.segment.endFrame - globalFrame;
  const fadeOut =
    current.segment.transitionOut.kind === "fade" &&
    remaining <= current.segment.transitionOut.durationFrames
      ? remaining / current.segment.transitionOut.durationFrames
      : 1;
  return frame(timeline, globalFrame, [
    { ...incoming, weight: Math.min(fadeIn, fadeOut) },
  ]);
};

/**
 * Resolve pass-specific transition inputs.
 *
 * Beauty is alpha composited. Structural guide passes are classifications or
 * geometric fields, so linearly blending their pixels invents invalid values;
 * they select the dominant shot layer instead (incoming wins an exact tie).
 */
export const productionRenderLayersForPass = (
  frame: IAutoMovieProductionRenderFrame,
  pass: AutoMovieGuidePass,
): IAutoMovieProductionRenderLayer[] => {
  if (pass === "beauty") return structuredClone(frame.layers);
  const selected = frame.layers.reduce((selected, candidate) =>
    candidate.weight >= selected.weight ? candidate : selected,
  );
  return [
    {
      ...structuredClone(selected),
      weight: 1,
    },
  ];
};

/**
 * Canonical WebVTT derived only from compiled caption placements.
 */
export const canonicalProductionWebVtt = (
  timeline: IAutoMovieFilmTimeline,
): string => {
  const cues = [...timeline.tracks.captions].sort(
    (left, right) =>
      left.startFrame - right.startFrame ||
      left.endFrame - right.endFrame ||
      compareCodeUnits(left.id, right.id),
  );
  return [
    `WEBVTT ${webVttPlainText(timeline.id)}`,
    "",
    ...cues.flatMap((cue) => [
      webVttPlainText(cue.id),
      `${webVttTime(cue.startFrame / timeline.fps)} --> ${webVttTime(
        cue.endFrame / timeline.fps,
      )}`,
      `<lang ${webVttPlainText(cue.language)}>${
        cue.speaker === undefined
          ? webVttPlainText(cue.text)
          : `<v ${webVttPlainText(cue.speaker)}>${webVttPlainText(
              cue.text,
            )}</v>`
      }</lang>`,
      "",
    ]),
  ].join("\n");
};

/**
 * Classify current identities without treating an old slot as current.
 */
export const productionRenderChunkStatuses = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  receipts: readonly IAutoMovieProductionRenderChunkReceipt[];
  attempts: readonly IAutoMovieProductionRenderAttempt[];
}): IAutoMovieProductionRenderChunkStatus[] => {
  return props.plan.chunks.map((chunk) => {
    const slotReceipts = props.receipts.filter(
      (item) => item.slot === chunk.slot,
    );
    const receipt =
      slotReceipts.find((item) => item.chunk === chunk.id) ??
      slotReceipts.at(-1);
    const slotAttempts = props.attempts.filter(
      (item) => item.slot === chunk.slot,
    );
    const attempt =
      slotAttempts.find((item) => item.chunk === chunk.id) ??
      slotAttempts.at(-1);
    if (receipt?.chunk === chunk.id)
      return status(
        chunk,
        "complete",
        "Verify current bytes, then reuse this chunk.",
      );
    if (attempt?.chunk === chunk.id)
      return status(
        chunk,
        attempt.state,
        attempt.state === "running"
          ? "Wait for its lock owner or recover the abandoned attempt."
          : attempt.correction,
      );
    if (receipt !== undefined || attempt !== undefined)
      return status(
        chunk,
        "stale",
        "Quarantine prior slot output and render only this current chunk.",
      );
    return status(
      chunk,
      "planned",
      "Acquire its lock, render, encode, verify, and commit.",
    );
  });
};

/**
 * Verify completion identity, exact range coverage, raster, and byte facts.
 */
export const verifyProductionRenderChunkReceipt = (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  chunk: IAutoMovieProductionRenderChunk;
  receipt: IAutoMovieProductionRenderChunkReceipt;
}): void => {
  const { plan, chunk, receipt } = props;
  if (
    receipt.version !== 1 ||
    receipt.slot !== chunk.slot ||
    receipt.chunk !== chunk.id
  )
    throw new Error(`Chunk receipt "${receipt.slot}" is stale.`);
  if (receipt.frames.length !== chunk.frames.length)
    throw new Error(
      `Chunk "${chunk.slot}" has ${receipt.frames.length} frame receipts; expected ${chunk.frames.length}.`,
    );
  receipt.frames.forEach((frameReceipt, index) => {
    const expected = chunk.frames[index]!.globalFrame;
    if (
      frameReceipt.globalFrame !== expected ||
      frameReceipt.width !== plan.frameFormat.width ||
      frameReceipt.height !== plan.frameFormat.height ||
      validByteFact(frameReceipt) === false
    )
      throw new Error(
        `Chunk "${chunk.slot}" frame ${index} does not prove global frame ${expected} at the production raster.`,
      );
  });
  if (validByteFact(receipt.encoded) === false)
    throw new Error(`Chunk "${chunk.slot}" has no verified encoded output.`);
};

interface IProductionRenderChunkFailure {
  error: unknown;
}

class ProductionRenderChunkLifecycleError extends AggregateError {}

/** Preserve one acquired chunk's complete fatal lifecycle in phase order. */
const productionRenderChunkLifecycleFailure = (
  attempt: IProductionRenderChunkFailure | undefined,
  failureRecord: IProductionRenderChunkFailure | undefined,
  release: IProductionRenderChunkFailure | undefined,
): unknown => {
  const failures = [attempt, failureRecord, release].filter(
    (failure): failure is IProductionRenderChunkFailure =>
      failure !== undefined,
  );
  if (failures.length === 1) return failures[0]!.error;
  return new ProductionRenderChunkLifecycleError(
    failures.map((failure) => failure.error),
    "Production render chunk cleanup failed after the render attempt failed.",
  );
};

/**
 * Schedule only non-current chunks through host-owned lock/byte adapters.
 */
export const runProductionRenderJob = async (props: {
  plan: IAutoMovieProductionRenderJobPlan;
  workers: number;
  deliverable?: string;
  adapters: {
    current(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt | null>;
    acquire(chunk: IAutoMovieProductionRenderChunk): Promise<boolean>;
    render(
      chunk: IAutoMovieProductionRenderChunk,
    ): Promise<IAutoMovieProductionRenderChunkReceipt>;
    fail(
      chunk: IAutoMovieProductionRenderChunk,
      correction: string,
    ): Promise<void>;
    release(chunk: IAutoMovieProductionRenderChunk): Promise<void>;
  };
}): Promise<{
  complete: string[];
  rendered: string[];
  busy: string[];
  failed: Array<{ slot: string; correction: string }>;
}> => {
  if (Number.isSafeInteger(props.workers) === false || props.workers <= 0)
    throw new Error(
      `workers must be a positive safe integer, but was ${props.workers}.`,
    );
  const queue = props.plan.chunks.filter(
    (chunk) =>
      props.deliverable === undefined ||
      chunk.deliverable === props.deliverable,
  );
  if (
    props.deliverable !== undefined &&
    props.plan.chunks.some(
      (chunk) => chunk.deliverable === props.deliverable,
    ) === false
  )
    throw new Error(
      `Render plan has no video chunks for deliverable "${props.deliverable}".`,
    );
  const output = {
    complete: [] as string[],
    rendered: [] as string[],
    busy: [] as string[],
    failed: [] as Array<{ slot: string; correction: string }>,
  };
  let cursor = 0;
  const fatalFailures: IProductionRenderChunkFailure[] = [];
  const reserveFatalFailure = (): IProductionRenderChunkFailure | undefined => {
    if (fatalFailures.length !== 0) return undefined;
    const failure: IProductionRenderChunkFailure = { error: undefined };
    fatalFailures.push(failure);
    return failure;
  };
  const recordFatalFailure = (error: unknown): void => {
    const failure = reserveFatalFailure();
    if (failure !== undefined) failure.error = error;
  };
  const worker = async (): Promise<void> => {
    try {
      while (fatalFailures.length === 0 && cursor < queue.length) {
        const chunk = queue[cursor++]!;
        const current = await props.adapters.current(chunk);
        if (current !== null) {
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt: current,
          });
          output.complete.push(chunk.slot);
          continue;
        }
        if ((await props.adapters.acquire(chunk)) === false) {
          output.busy.push(chunk.slot);
          continue;
        }
        let attemptFailure: IProductionRenderChunkFailure | undefined;
        let failureRecordFailure: IProductionRenderChunkFailure | undefined;
        let releaseFailure: IProductionRenderChunkFailure | undefined;
        let fatalFailure: IProductionRenderChunkFailure | undefined;
        try {
          const receipt = await props.adapters.render(chunk);
          verifyProductionRenderChunkReceipt({
            plan: props.plan,
            chunk,
            receipt,
          });
          output.rendered.push(chunk.slot);
        } catch (error) {
          attemptFailure = { error };
          const correction =
            error instanceof Error ? error.message : String(error);
          try {
            await props.adapters.fail(chunk, correction);
            output.failed.push({ slot: chunk.slot, correction });
          } catch (failure) {
            failureRecordFailure = { error: failure };
            fatalFailure = reserveFatalFailure();
          }
        } finally {
          try {
            await props.adapters.release(chunk);
          } catch (failure) {
            releaseFailure = { error: failure };
            fatalFailure ??= reserveFatalFailure();
          }
          if (fatalFailure !== undefined)
            fatalFailure.error = productionRenderChunkLifecycleFailure(
              attemptFailure,
              failureRecordFailure,
              releaseFailure,
            );
        }
      }
    } catch (error) {
      recordFatalFailure(error);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(props.workers, Math.max(1, queue.length)) },
      worker,
    ),
  );
  if (fatalFailures.length !== 0) throw fatalFailures[0]!.error;
  const order = new Map(queue.map((chunk, index) => [chunk.slot, index]));
  output.complete.sort((left, right) => order.get(left)! - order.get(right)!);
  output.rendered.sort((left, right) => order.get(left)! - order.get(right)!);
  output.busy.sort((left, right) => order.get(left)! - order.get(right)!);
  output.failed.sort(
    (left, right) => order.get(left.slot)! - order.get(right.slot)!,
  );
  return output;
};

interface IProductionOwnedDescriptorFailure {
  error: unknown;
}

class ProductionOwnedDescriptorCleanupError extends AggregateError {}

/** Close one production-owned descriptor without losing earlier failures. */
const closeProductionOwnedDescriptor = (
  descriptor: number,
  failure: IProductionOwnedDescriptorFailure | undefined,
  target: string,
): void => {
  try {
    fs.closeSync(descriptor);
  } catch (closeFailure) {
    if (failure === undefined) throw closeFailure;
    throw new ProductionOwnedDescriptorCleanupError(
      [
        ...(failure.error instanceof ProductionOwnedDescriptorCleanupError
          ? failure.error.errors
          : [failure.error]),
        closeFailure,
      ],
      `Production-owned descriptor cleanup failed after the read failed: ${target}.`,
    );
  }
};

/**
 * Read one production-owned file without following a link in its namespace.
 *
 * The returned bytes come from one regular file whose complete ancestry is a
 * physical descendant of `root`. Every directory and the file are identified
 * before the read and rechecked afterwards, so a replacement cannot turn a
 * verified content-addressed path into different resident bytes.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
  /** Return `null` only when the first target observation is absent. */
  optional: true;
}): Uint8Array | null;
/**
 * Read one required production-owned file without following a link in its
 * namespace.
 */
export function readAutoMovieProductionOwnedFile(props: {
  /** Physical production ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
}): Uint8Array;
/**
 * Execute the production-owned read with an explicit optionality policy.
 */
export function readAutoMovieProductionOwnedFile(props: {
  root: string;
  directory: string;
  relative: string;
  optional?: boolean;
}): Uint8Array | null {
  const root = path.resolve(props.root);
  const directory = path.resolve(props.directory);
  const target = path.resolve(directory, props.relative);
  if (
    `${directory}${path.sep}`.startsWith(`${root}${path.sep}`) === false ||
    target.startsWith(`${directory}${path.sep}`) === false
  )
    throw new Error(
      `Production-owned path "${props.relative}" escapes its owned directory.`,
    );

  const relativeParent = path.relative(root, path.dirname(target));
  const components =
    relativeParent.length === 0 ? [] : relativeParent.split(path.sep);
  const directories = [root];
  for (const component of components)
    directories.push(path.join(directories.at(-1)!, component));

  const identities: IProductionOwnedPathIdentity[] = directories.map(
    (file) => ({
      file,
      identity: productionOwnedDirectoryIdentity(file),
    }),
  );
  const assertResidentDirectories = (): void => {
    const changed = identities.find(
      (expected) =>
        expected.identity !== productionOwnedDirectoryIdentity(expected.file),
    );
    if (changed !== undefined)
      throw new Error(
        `Production-owned path "${changed.file}" changed physical identity while it was read.`,
      );
  };
  let linkedIdentity: string;
  try {
    linkedIdentity = productionOwnedFileIdentity(target);
  } catch (error) {
    if (
      props.optional === true &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      assertResidentDirectories();
      return null;
    }
    throw error;
  }
  const descriptor = fs.openSync(target, "r");
  let failure: IProductionOwnedDescriptorFailure | undefined;
  try {
    const openedIdentity = productionOwnedDescriptorIdentity(
      target,
      descriptor,
    );
    const assertResidentFile = (): void => {
      assertResidentDirectories();
      if (productionOwnedFileIdentity(target) !== linkedIdentity)
        throw new Error(
          `Production-owned path "${target}" changed physical identity while it was read.`,
        );
      const residentDescriptor = fs.openSync(target, "r");
      let residentFailure: IProductionOwnedDescriptorFailure | undefined;
      try {
        if (
          productionOwnedDescriptorIdentity(target, residentDescriptor) !==
          openedIdentity
        )
          throw new Error(
            `Production-owned path "${target}" changed physical identity while it was read.`,
          );
      } catch (error) {
        residentFailure = { error };
        throw error;
      } finally {
        closeProductionOwnedDescriptor(
          residentDescriptor,
          residentFailure,
          target,
        );
      }
    };
    assertResidentFile();
    const bytes = fs.readFileSync(descriptor);
    assertResidentFile();
    return bytes;
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    closeProductionOwnedDescriptor(descriptor, failure, target);
  }
}

const frame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
  layers: IAutoMovieProductionRenderLayer[],
): IAutoMovieProductionRenderFrame => ({
  globalFrame,
  timelineFrame: globalFrame,
  timeSeconds: globalFrame / timeline.fps,
  layers,
});

const normalizeRenderTier = (
  tier: IAutoMovieProductionRenderTier | undefined,
): IAutoMovieProductionRenderTier => {
  const value = tier ?? {
    kind: "final",
    resolutionScale: 1,
    frameStep: 1,
  };
  if (
    (value.kind !== "proxy" && value.kind !== "final") ||
    Number.isFinite(value.resolutionScale) === false ||
    value.resolutionScale <= 0 ||
    value.resolutionScale > 1 ||
    Number.isSafeInteger(value.frameStep) === false ||
    value.frameStep <= 0 ||
    value.frameStep > 16 ||
    (value.kind === "final" &&
      (value.resolutionScale !== 1 || value.frameStep !== 1)) ||
    (value.kind === "proxy" &&
      value.resolutionScale === 1 &&
      value.frameStep === 1)
  )
    throw new Error(
      "Render tier must be exact final (scale 1, step 1) or a bounded cheaper proxy (scale in (0, 1], integer step 1..16, with at least one reduction).",
    );
  return structuredClone(value);
};

/**
 * Derive the exact even raster and frame clock for one render tier.
 */
export const resolveProductionRenderTierFrameFormat = (
  source: IAutoMovieProductionDesign["frameFormat"],
  tier: IAutoMovieProductionRenderTier,
): IAutoMovieProductionDesign["frameFormat"] => {
  const normalized = normalizeRenderTier(tier);
  if (normalized.kind === "final") return structuredClone(source);
  const even = (value: number): number =>
    Math.max(2, Math.floor((value * normalized.resolutionScale) / 2) * 2);
  return {
    width: even(source.width),
    height: even(source.height),
    fps: source.fps / normalized.frameStep,
    colorSpace: source.colorSpace,
    ...(source.crop === undefined
      ? {}
      : { crop: structuredClone(source.crop) }),
  };
};

const status = (
  chunk: IAutoMovieProductionRenderChunk,
  state: IAutoMovieProductionRenderChunkStatus["status"],
  correction: string,
): IAutoMovieProductionRenderChunkStatus => ({
  slot: chunk.slot,
  chunk: chunk.id,
  status: state,
  correction,
});

const normalizeGuidePasses = (
  passes: readonly Exclude<AutoMovieGuidePass, "beauty">[],
): Exclude<AutoMovieGuidePass, "beauty">[] => {
  const valid = new Set<AutoMovieGuidePass>([
    "depth",
    "mask",
    "normal",
    "outline",
    "pose",
  ]);
  const output: Exclude<AutoMovieGuidePass, "beauty">[] = [];
  for (const pass of passes) {
    if (valid.has(pass) === false)
      throw new Error(`Guide-pass render cannot use "${pass}".`);
    if (output.includes(pass) === false) output.push(pass);
  }
  if (output.length !== 1)
    throw new Error(
      `A guide-pass deliverable requires exactly one declared pass, but received ${output.length}. Declare separate deliverables when the production contract gains per-pass ownership.`,
    );
  return output;
};

const normalizeAudioAssets = (
  assets: readonly IAutoMovieProductionAudioAssetIdentity[],
): IAutoMovieProductionAudioAssetIdentity[] => {
  const paths = new Set<string>();
  const output = [...assets]
    .sort((left, right) => compareCodeUnits(left.path, right.path))
    .map((asset) => {
      if (
        asset.path.trim().length === 0 ||
        paths.has(asset.path) ||
        validByteFact({ digest: asset.digest, bytes: 1 }) === false ||
        Number.isFinite(asset.durationSeconds) === false ||
        asset.durationSeconds <= 0 ||
        Number.isSafeInteger(asset.sampleRate) === false ||
        asset.sampleRate <= 0 ||
        Number.isSafeInteger(asset.channels) === false ||
        asset.channels <= 0
      )
        throw new Error(
          `Audio asset "${asset.path}" has invalid identity, duration, sample rate, channels, or duplicate ownership.`,
        );
      paths.add(asset.path);
      return structuredClone(asset);
    });
  return output;
};

const webVttTime = (seconds: number): string => {
  const milliseconds = Math.round(seconds * 1_000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const remainder = Math.floor((milliseconds % 60_000) / 1_000);
  const fraction = milliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(remainder).padStart(2, "0")}.${String(fraction).padStart(
    3,
    "0",
  )}`;
};

/** Escape one authored plain-text field into a single WebVTT content line. */
const webVttPlainText = (value: string): string =>
  value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const validByteFact = (fact: { digest: string; bytes: number }): boolean =>
  Number.isSafeInteger(fact.bytes) &&
  fact.bytes > 0 &&
  validDigest(fact.digest);

const validDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/.test(value);

const digestJson = (value: unknown): AutoMovieContentDigest =>
  `sha256:${createHash("sha256")
    .update(Buffer.from(canonicalJson(value), "utf8"))
    .digest("hex")}`;

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (Number.isFinite(value) === false)
      throw new Error("Render identity refuses non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Render identity requires JSON-compatible values.");
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

interface IProductionOwnedPathIdentity {
  file: string;
  identity: string;
}

const productionOwnedDirectoryIdentity = (directory: string): string => {
  const linked = fs.lstatSync(directory, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Production-owned directory "${directory}" is not a physical directory.`,
    );
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedFileIdentity = (file: string): string => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedDescriptorIdentity = (
  file: string,
  descriptor: number,
): string => {
  const opened = fs.fstatSync(descriptor, { bigint: true });
  if (opened.isFile() === false)
    throw new Error(`Production-owned path "${file}" is not a physical file.`);
  return `${opened.dev}\0${opened.ino}`;
};
