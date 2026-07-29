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

/** Package-owned encoder identity fenced into every chunk. */
export interface IAutoMovieProductionEncoderIdentity {
  /** Exact installed package name. */
  package: string;
  /** Exact installed package version. */
  version: string;
  /** Digest of the resolved executable JavaScript entry. */
  entryDigest: AutoMovieContentDigest;
  /** Closed codec family emitted by the foundation adapter. */
  codec: "h264";
  /** Every encoder argument that can affect output bytes. */
  arguments: {
    /** Constant-rate-factor analogue accepted by the package encoder. */
    quantizationParameter: number;
    /** Package encoder speed setting. */
    speed: number;
    /** Key-frame period in frames. */
    groupOfPictures: number;
  };
}

/** Capture and encoder identity for one homogeneous render job. */
export interface IAutoMovieProductionRenderRuntimeIdentity {
  /** Render-runtime identity schema. */
  protocolVersion: "automovie.production-render-runtime.v1";
  /** Digest of declared viewer, capture, asset, and package input bytes. */
  sourceDigest: AutoMovieContentDigest;
  /** Package-owned browser and graphics identity. */
  capture: IAutoMovieCaptureRuntimeIdentity;
  /** Package-owned encoder binary and argument identity. */
  encoder: IAutoMovieProductionEncoderIdentity;
}

/** One source image participating in a film-global output frame. */
export interface IAutoMovieProductionRenderLayer {
  /** Compiler-owned shot id. */
  shot: string;
  /** Exact shot-local integer source frame. */
  sourceFrame: number;
  /** Linear compositing weight in `[0, 1]`. */
  weight: number;
}

/** One exact film-global frame with transitions already resolved. */
export interface IAutoMovieProductionRenderFrame {
  /** Exact zero-based film frame. */
  globalFrame: number;
  /** Derived film time, never an accumulated clock. */
  timeSeconds: number;
  /** One hard-cut/fade layer or two dissolve layers, back to front. */
  layers: IAutoMovieProductionRenderLayer[];
}

/** One deterministic, independently lockable render/encode range. */
export interface IAutoMovieProductionRenderChunk {
  /** Stable operational slot before content identity changes. */
  slot: string;
  /** Content id over edit, pass, frame range, raster, and runtime. */
  id: AutoMovieContentDigest;
  /** Production deliverable id that owns the completed range. */
  deliverable: string;
  /** Encoded moving-image class used by the parser probe. */
  kind: "feature" | "guide-pass";
  /** Beauty or the one structural pass declared for this range. */
  pass: AutoMovieGuidePass;
  /** Inclusive zero-based film frame. */
  frameStart: number;
  /** Exclusive film-frame boundary. */
  frameEndExclusive: number;
  /** Exact edit mapping for every frame in the range. */
  frames: IAutoMovieProductionRenderFrame[];
}

/** Persisted plan reopened by every `automovie render` subcommand. */
export interface IAutoMovieProductionRenderJobPlan {
  /** Plan schema. */
  version: 1;
  /** Compiler source-input fingerprint used by all captures. */
  compileFingerprint: AutoMovieContentDigest;
  /** Digest of the compiler-owned film edit. */
  editFingerprint: AutoMovieContentDigest;
  /** Homogeneous capture and encoder identity. */
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  /** Exact production raster and frame clock. */
  frameFormat: IAutoMovieProductionDesign["frameFormat"];
  /** Exact total film frame count. */
  totalFrames: number;
  /** Maximum frames assigned to one independently resumable chunk. */
  chunkFrames: number;
  /** Content-addressed video ranges in deterministic order. */
  chunks: IAutoMovieProductionRenderChunk[];
  /** Non-video compiler tracks used during terminal publication. */
  tracks: {
    /** Canonical WebVTT derived from the caption placements. */
    captions: string;
    /** Exact compiler-owned audio placements. */
    audio: IAutoMovieFilmTimeline["tracks"]["audio"];
    /** Byte, duration, and format identity for every referenced audio asset. */
    audioAssets: IAutoMovieProductionAudioAssetIdentity[];
  };
}

/** Byte-exact PNG committed by one completed chunk. */
export interface IAutoMovieProductionRenderedFrameReceipt {
  /** Exact zero-based film frame. */
  globalFrame: number;
  /** Chunk-directory-relative PNG path. */
  path: string;
  /** Digest of the resident PNG bytes. */
  digest: AutoMovieContentDigest;
  /** Positive resident PNG byte count. */
  bytes: number;
  /** Decoded PNG width. */
  width: number;
  /** Decoded PNG height. */
  height: number;
}

/** Content-only completion facts; attempts and PIDs are deliberately absent. */
export interface IAutoMovieProductionRenderChunkReceipt {
  /** Receipt schema. */
  version: 1;
  /** Stable operational slot. */
  slot: string;
  /** Exact current chunk content id. */
  chunk: AutoMovieContentDigest;
  /** Ordered byte facts for the full frame range. */
  frames: IAutoMovieProductionRenderedFrameReceipt[];
  /** Parser-verified chunk MP4. */
  encoded: {
    /** Chunk-directory-relative MP4 path. */
    path: string;
    /** Digest of the resident MP4 bytes. */
    digest: AutoMovieContentDigest;
    /** Positive resident MP4 byte count. */
    bytes: number;
  };
}

/** Ephemeral attempt state stored outside a completion receipt. */
export interface IAutoMovieProductionRenderAttempt {
  /** Stable operational slot. */
  slot: string;
  /** Chunk identity attempted by the process. */
  chunk: AutoMovieContentDigest;
  /** Non-content attempt state. */
  state: "running" | "failed";
  /** Exact recovery action or failure message. */
  correction: string;
}

/** One resumable status row with an exact next action. */
export interface IAutoMovieProductionRenderChunkStatus {
  /** Stable operational slot. */
  slot: string;
  /** Current planned content identity. */
  chunk: AutoMovieContentDigest;
  /** Current completion/recovery classification. */
  status: "planned" | "running" | "complete" | "stale" | "failed";
  /** Exact next action for this state. */
  correction: string;
}

/** Parser/preflight identity for one compiler-declared audio source asset. */
export interface IAutoMovieProductionAudioAssetIdentity {
  /** Project-relative compiler-declared asset path. */
  path: string;
  /** Digest of the exact current asset bytes. */
  digest: AutoMovieContentDigest;
  /** Declared source duration. */
  durationSeconds: number;
  /** Declared PCM clock used by the deterministic adapter. */
  sampleRate: number;
  /** Declared channel count used by the deterministic adapter. */
  channels: number;
}

/** Build content-addressed chunks from the compiler-owned film edit. */
export const planProductionRenderJob = (props: {
  timeline: IAutoMovieFilmTimeline;
  production: IAutoMovieProductionDesign;
  runtimeIdentity: IAutoMovieProductionRenderRuntimeIdentity;
  sourceFingerprints: Readonly<Record<string, AutoMovieContentDigest>>;
  audioAssets: readonly IAutoMovieProductionAudioAssetIdentity[];
  chunkFrames: number;
  guidePasses?: readonly Exclude<AutoMovieGuidePass, "beauty">[];
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
    props.production.frameFormat.width % 2 !== 0 ||
    props.production.frameFormat.height % 2 !== 0
  )
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
  const guidePasses = normalizeGuidePasses(props.guidePasses ?? ["pose"]);
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
    { length: props.timeline.totalFrames },
    (_, frame) => sampleProductionRenderFrame(props.timeline, frame),
  );
  const chunks: IAutoMovieProductionRenderChunk[] = [];
  for (const deliverable of props.production.deliverables) {
    // Only the two moving-image kinds carry chunks. Narrowing here rather than
    // resolving an empty pass list keeps the chunk's own `kind` exact, so a
    // caption or audio deliverable cannot reach a video parser probe.
    if (deliverable.kind !== "feature" && deliverable.kind !== "guide-pass")
      continue;
    const passes: readonly AutoMovieGuidePass[] =
      deliverable.kind === "feature" ? ["beauty"] : guidePasses;
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
        const slot = `${deliverable.id}:${pass}:${index}`;
        const identity = {
          protocol: "automovie.production-render-chunk.v1",
          deliverable: deliverable.id,
          kind: deliverable.kind,
          editFingerprint,
          frameFormat: props.production.frameFormat,
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
    version: 1,
    compileFingerprint: props.timeline.inputFingerprint,
    editFingerprint,
    runtimeIdentity: props.runtimeIdentity,
    frameFormat: props.production.frameFormat,
    totalFrames: props.timeline.totalFrames,
    chunkFrames: props.chunkFrames,
    chunks,
    tracks: {
      captions: canonicalProductionWebVtt(props.timeline),
      audio: structuredClone(props.timeline.tracks.audio),
      audioAssets,
    },
  };
};

/** Resolve one global frame, including exact dissolve and fade weights. */
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

/** Canonical WebVTT derived only from compiled caption placements. */
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

/** Classify current identities without treating an old slot as current. */
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

/** Verify completion identity, exact range coverage, raster, and byte facts. */
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

/** Schedule only non-current chunks through host-owned lock/byte adapters. */
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
  const worker = async (): Promise<void> => {
    while (cursor < queue.length) {
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
      try {
        const receipt = await props.adapters.render(chunk);
        verifyProductionRenderChunkReceipt({
          plan: props.plan,
          chunk,
          receipt,
        });
        output.rendered.push(chunk.slot);
      } catch (error) {
        const correction =
          error instanceof Error ? error.message : String(error);
        await props.adapters.fail(chunk, correction);
        output.failed.push({ slot: chunk.slot, correction });
      } finally {
        await props.adapters.release(chunk);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(props.workers, Math.max(1, queue.length)) },
      worker,
    ),
  );
  const order = new Map(queue.map((chunk, index) => [chunk.slot, index]));
  output.complete.sort((left, right) => order.get(left)! - order.get(right)!);
  output.rendered.sort((left, right) => order.get(left)! - order.get(right)!);
  output.busy.sort((left, right) => order.get(left)! - order.get(right)!);
  output.failed.sort(
    (left, right) => order.get(left.slot)! - order.get(right.slot)!,
  );
  return output;
};

/**
 * Read one render-state file without following a link in its owned namespace.
 *
 * The returned bytes come from one regular file whose complete ancestry is a
 * physical descendant of `root`. Every directory and the file are identified
 * before the read and rechecked afterwards, so a replacement cannot turn a
 * verified content-addressed path into different resident bytes.
 */
export const readAutoMovieProductionOwnedFile = (props: {
  /** Physical render-state ownership root. */
  root: string;
  /** Physical directory that owns the relative file. */
  directory: string;
  /** Strict descendant path below `directory`. */
  relative: string;
}): Uint8Array => {
  const root = path.resolve(props.root);
  const directory = path.resolve(props.directory);
  const target = path.resolve(directory, props.relative);
  if (
    `${directory}${path.sep}`.startsWith(`${root}${path.sep}`) === false ||
    target.startsWith(`${directory}${path.sep}`) === false
  )
    throw new Error(
      `Render-state path "${props.relative}" escapes its owned directory.`,
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
      directory: true,
      identity: productionOwnedDirectoryIdentity(file),
    }),
  );
  identities.push({
    file: target,
    directory: false,
    identity: productionOwnedFileIdentity(target),
  });
  const bytes = fs.readFileSync(target);
  const changed = identities.find(
    (expected) =>
      expected.identity !==
      (expected.directory
        ? productionOwnedDirectoryIdentity(expected.file)
        : productionOwnedFileIdentity(expected.file)),
  );
  if (changed !== undefined)
    throw new Error(
      `Render-state path "${changed.file}" changed physical identity while it was read.`,
    );
  return bytes;
};

const frame = (
  timeline: IAutoMovieFilmTimeline,
  globalFrame: number,
  layers: IAutoMovieProductionRenderLayer[],
): IAutoMovieProductionRenderFrame => ({
  globalFrame,
  timeSeconds: globalFrame / timeline.fps,
  layers,
});

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
  fact.bytes > 0 && validDigest(fact.digest);

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
  directory: boolean;
  identity: string;
}

const productionOwnedDirectoryIdentity = (directory: string): string => {
  const linked = fs.lstatSync(directory, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(
      `Render-state directory "${directory}" is not a physical directory.`,
    );
  return `${linked.dev}\0${linked.ino}`;
};

const productionOwnedFileIdentity = (file: string): string => {
  const linked = fs.lstatSync(file, { bigint: true });
  if (linked.isSymbolicLink() || linked.isFile() === false)
    throw new Error(`Render-state path "${file}" is not a physical file.`);
  return `${linked.dev}\0${linked.ino}`;
};
