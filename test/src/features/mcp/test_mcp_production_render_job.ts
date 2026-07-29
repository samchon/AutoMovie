import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  IAutoMovieProductionRenderChunkReceipt,
  IAutoMovieProductionRenderJobPlan,
  canonicalProductionWebVtt,
  planProductionRenderJob,
  productionRenderChunkStatuses,
  runProductionRenderJob,
  sampleProductionRenderFrame,
  verifyProductionRenderChunkReceipt,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  productionDesign,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

/** Whether one scheduler call refused its arguments instead of running. */
const rejects = async (task: Promise<unknown>): Promise<boolean> => {
  try {
    await task;
    return false;
  } catch {
    return true;
  }
};

/**
 * A host adapter may reject with anything, so the non-Error path needs a
 * witness the compiler cannot narrow back to `Error`.
 */
const NON_ERROR_FAILURE: unknown = "string failure";

const audioAssets = () => [
  {
    path: "public/audio/silent.json",
    digest: digest("a"),
    durationSeconds: 3,
    sampleRate: 48_000,
    channels: 2,
  },
];

const sourceFingerprints = () => ({
  outgoing: digest("6"),
  incoming: digest("7"),
});

const timeline = (): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "automovie.production.compiler.v5",
  inputFingerprint: digest("1"),
  sourceDigest: digest("2"),
  id: "render-film",
  fps: 2,
  totalFrames: 6,
  segments: [
    {
      shot: "outgoing",
      sourceInFrame: 0,
      sourceOutFrame: 4,
      startFrame: 0,
      endFrame: 4,
      headHandleFrames: 0,
      tailHandleFrames: 2,
      transitionIn: { kind: "fade", durationFrames: 2 },
      transitionOut: { kind: "dissolve", durationFrames: 2 },
    },
    {
      shot: "incoming",
      sourceInFrame: 0,
      sourceOutFrame: 4,
      startFrame: 2,
      endFrame: 6,
      headHandleFrames: 2,
      tailHandleFrames: 0,
      transitionIn: { kind: "dissolve", durationFrames: 2 },
      transitionOut: { kind: "fade", durationFrames: 2 },
    },
  ],
  omissions: [],
  tracks: {
    audio: [
      {
        id: "silent",
        asset: "public/audio/silent.json",
        sourceDurationFrames: 6,
        sourceOffsetFrame: 0,
        startFrame: 0,
        durationFrames: 6,
        gain: 0,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        bus: "ambience",
      },
    ],
    captions: [
      {
        id: "later",
        text: "Second.",
        language: "en",
        startFrame: 2,
        endFrame: 4,
      },
      {
        id: "earlier",
        text: "First.",
        language: "en",
        speaker: "sentinel",
        startFrame: 0,
        endFrame: 2,
      },
    ],
    effects: [],
  },
});

const plan = (
  sources: Readonly<
    Record<string, AutoMovieContentDigest>
  > = sourceFingerprints(),
): IAutoMovieProductionRenderJobPlan =>
  planProductionRenderJob({
    timeline: timeline(),
    audioAssets: audioAssets(),
    sourceFingerprints: sources,
    production: {
      ...productionDesign({
        id: "render-film",
        targetRuntimeSeconds: 3,
        frameFormat: {
          width: 16,
          height: 16,
          fps: 2,
          colorSpace: "srgb",
        },
      }),
      deliverables: [
        { id: "feature", kind: "feature", required: true },
        { id: "guides", kind: "guide-pass", required: true },
      ],
    },
    runtimeIdentity: {
      protocolVersion: "automovie.production-render-runtime.v1",
      sourceDigest: digest("8"),
      capture: testCaptureRuntimeIdentity(),
      encoder: {
        package: "h264-mp4-encoder",
        version: "1.0.12",
        entryDigest: digest("3"),
        codec: "h264",
        arguments: {
          quantizationParameter: 24,
          speed: 10,
          groupOfPictures: 2,
        },
      },
    },
    chunkFrames: 2,
  });

const receipt = (
  renderPlan: IAutoMovieProductionRenderJobPlan,
  index: number,
): IAutoMovieProductionRenderChunkReceipt => {
  const chunk = renderPlan.chunks[index]!;
  return {
    version: 1,
    slot: chunk.slot,
    chunk: chunk.id,
    frames: chunk.frames.map((frame, frameIndex) => ({
      globalFrame: frame.globalFrame,
      path: `frame_${frameIndex}.png`,
      digest: digest("4"),
      bytes: 64,
      width: renderPlan.frameFormat.width,
      height: renderPlan.frameFormat.height,
    })),
    encoded: {
      path: "chunk.mp4",
      digest: digest("5"),
      bytes: 128,
    },
  };
};

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};

/**
 * Production render jobs preserve the compiler-owned film clock while making
 * chunk completion resumable and runtime-addressed.
 *
 * Scenarios:
 *
 * 1. Feature and one declared structural guide pass split into deterministic
 *    2-frame chunks; preview/caption/audio-only designs produce zero chunks.
 * 2. Hard frames, fade weights, and a dissolve crossing a chunk boundary map to
 *    exact shot-local source frames without duplication or gaps.
 * 3. Caption placements canonicalize by frame/id into deterministic WebVTT with
 *    and without speaker tags.
 * 4. Planned, running, failed, stale, and complete status rows retain one slot
 *    while content ids change.
 * 5. Receipts require exact identity, ordered global frames, raster, non-empty
 *    byte counts, and SHA-256 facts.
 * 6. The worker scheduler reuses current chunks, skips busy locks, commits valid
 *    renders, records failures, releases every acquired lock, and rejects
 *    invalid worker/deliverable requests.
 * 7. Invalid chunk sizes, clock mismatches, out-of-range/gap frames, a first
 *    dissolve, invalid guide passes, and non-finite runtime identity fail
 *    closed.
 */
export const test_mcp_production_render_job = async (): Promise<void> => {
  const renderPlan = plan();
  const selectivelyChanged = plan({
    ...sourceFingerprints(),
    outgoing: digest("9"),
  });
  const nonVideoPlan = planProductionRenderJob({
    timeline: timeline(),
    audioAssets: audioAssets(),
    sourceFingerprints: sourceFingerprints(),
    production: {
      ...productionDesign({
        id: "render-film",
        targetRuntimeSeconds: 3,
        frameFormat: {
          width: 16,
          height: 16,
          fps: 2,
          colorSpace: "srgb",
        },
      }),
      deliverables: [
        { id: "preview", kind: "preview", required: true },
        { id: "captions", kind: "captions", required: true },
        { id: "audio", kind: "audio-mix", required: true },
      ],
    },
    runtimeIdentity: renderPlan.runtimeIdentity,
    chunkFrames: 2,
  });
  const partialPlan = planProductionRenderJob({
    timeline: timeline(),
    audioAssets: audioAssets(),
    sourceFingerprints: sourceFingerprints(),
    production: {
      ...productionDesign({
        id: "render-film",
        targetRuntimeSeconds: 3,
        frameFormat: {
          width: 16,
          height: 16,
          fps: 2,
          colorSpace: "srgb",
        },
      }),
      deliverables: [{ id: "feature", kind: "feature", required: true }],
    },
    runtimeIdentity: renderPlan.runtimeIdentity,
    chunkFrames: 4,
  });
  const explicitGuide = planProductionRenderJob({
    timeline: timeline(),
    audioAssets: audioAssets(),
    sourceFingerprints: sourceFingerprints(),
    production: {
      ...productionDesign({
        id: "render-film",
        targetRuntimeSeconds: 3,
        frameFormat: {
          width: 16,
          height: 16,
          fps: 2,
          colorSpace: "srgb",
        },
      }),
      deliverables: [{ id: "guides", kind: "guide-pass", required: true }],
    },
    runtimeIdentity: renderPlan.runtimeIdentity,
    chunkFrames: 6,
    guidePasses: ["mask", "mask"],
  });
  const booleanIdentityPlan = planProductionRenderJob({
    timeline: timeline(),
    audioAssets: audioAssets(),
    sourceFingerprints: sourceFingerprints(),
    production: {
      ...productionDesign({
        id: "render-film",
        targetRuntimeSeconds: 3,
        frameFormat: {
          width: 16,
          height: 16,
          fps: 2,
          colorSpace: "srgb",
        },
      }),
      deliverables: [{ id: "feature", kind: "feature", required: true }],
    },
    runtimeIdentity: {
      ...renderPlan.runtimeIdentity,
      deterministic: true,
      omitted: undefined,
    } as typeof renderPlan.runtimeIdentity,
    chunkFrames: 6,
  });
  TestValidator.predicate(
    "film edit becomes deterministic feature and guide chunks",
    renderPlan.totalFrames === 6 &&
      renderPlan.chunks.length === 6 &&
      renderPlan.chunks[0]?.frameStart === 0 &&
      renderPlan.chunks[0]?.frameEndExclusive === 2 &&
      renderPlan.chunks[1]?.frameStart === 2 &&
      renderPlan.chunks[1]?.frames[0]?.layers.length === 2 &&
      renderPlan.chunks[0]?.id === plan().chunks[0]?.id &&
      (() => {
        const changed = timeline();
        changed.inputFingerprint = digest("6");
        return (
          planProductionRenderJob({
            timeline: changed,
            audioAssets: audioAssets(),
            sourceFingerprints: sourceFingerprints(),
            production: {
              ...productionDesign({
                id: "render-film",
                targetRuntimeSeconds: 3,
                frameFormat: {
                  width: 16,
                  height: 16,
                  fps: 2,
                  colorSpace: "srgb",
                },
              }),
              deliverables: [
                { id: "feature", kind: "feature", required: true },
              ],
            },
            runtimeIdentity: renderPlan.runtimeIdentity,
            chunkFrames: 2,
          }).chunks[0]?.id === renderPlan.chunks[0]?.id
        );
      })() &&
      renderPlan.tracks.audio[0]?.asset === "public/audio/silent.json" &&
      renderPlan.tracks.audioAssets[0]?.digest === digest("a") &&
      nonVideoPlan.chunks.length === 0 &&
      partialPlan.chunks.length === 2 &&
      partialPlan.chunks[1]?.frameStart === 4 &&
      partialPlan.chunks[1]?.frameEndExclusive === 6 &&
      explicitGuide.chunks.length === 1 &&
      explicitGuide.chunks[0]?.pass === "mask" &&
      booleanIdentityPlan.chunks.length === 1,
  );
  TestValidator.predicate(
    "shot source identity invalidates only ranges that sample that shot",
    selectivelyChanged.chunks[0]?.id !== renderPlan.chunks[0]?.id &&
      selectivelyChanged.chunks[1]?.id !== renderPlan.chunks[1]?.id &&
      selectivelyChanged.chunks[2]?.id === renderPlan.chunks[2]?.id &&
      selectivelyChanged.chunks[3]?.id !== renderPlan.chunks[3]?.id &&
      selectivelyChanged.chunks[4]?.id !== renderPlan.chunks[4]?.id &&
      selectivelyChanged.chunks[5]?.id === renderPlan.chunks[5]?.id,
  );

  const fadedIn = sampleProductionRenderFrame(timeline(), 0);
  const opaque = sampleProductionRenderFrame(timeline(), 1);
  const dissolveStart = sampleProductionRenderFrame(timeline(), 2);
  const dissolveMiddle = sampleProductionRenderFrame(timeline(), 3);
  const fadedOut = sampleProductionRenderFrame(timeline(), 5);
  TestValidator.predicate(
    "film-global samples preserve fades and dissolve source frames",
    fadedIn.layers[0]?.weight === 0 &&
      opaque.layers[0]?.weight === 0.5 &&
      dissolveStart.layers[0]?.shot === "outgoing" &&
      dissolveStart.layers[0]?.sourceFrame === 2 &&
      dissolveStart.layers[0]?.weight === 1 &&
      dissolveStart.layers[1]?.shot === "incoming" &&
      dissolveStart.layers[1]?.sourceFrame === 0 &&
      dissolveStart.layers[1]?.weight === 0 &&
      dissolveMiddle.layers[0]?.weight === 0.5 &&
      dissolveMiddle.layers[1]?.weight === 0.5 &&
      fadedOut.layers[0]?.weight === 0.5,
  );

  const captions = canonicalProductionWebVtt(timeline());
  const tiedCaptionTimeline = timeline();
  tiedCaptionTimeline.tracks.captions = [
    {
      id: "b",
      text: "B",
      language: "en",
      startFrame: 0,
      endFrame: 2,
    },
    {
      id: "c",
      text: "C",
      language: "en",
      startFrame: 0,
      endFrame: 3,
    },
    {
      id: "a",
      text: "A",
      language: "en",
      startFrame: 0,
      endFrame: 2,
    },
  ];
  const tiedCaptions = canonicalProductionWebVtt(tiedCaptionTimeline);
  const longCaptionTimeline = timeline();
  longCaptionTimeline.tracks.captions = [
    {
      id: "hour",
      text: "Hour.",
      language: "en",
      startFrame: 7_200,
      endFrame: 7_202,
    },
  ];
  const longCaptions = canonicalProductionWebVtt(longCaptionTimeline);
  TestValidator.predicate(
    "caption track becomes canonical WebVTT",
    captions.startsWith("WEBVTT render-film\n\n") &&
      captions.indexOf("earlier") < captions.indexOf("later") &&
      captions.includes("00:00:00.000 --> 00:00:01.000") &&
      captions.includes("<v sentinel>First.") &&
      captions.includes("\nSecond.\n") &&
      tiedCaptions.indexOf("\na\n") < tiedCaptions.indexOf("\nb\n") &&
      tiedCaptions.indexOf("\nb\n") < tiedCaptions.indexOf("\nc\n") &&
      longCaptions.includes("01:00:00.000 --> 01:00:01.000"),
  );

  const complete = receipt(renderPlan, 0);
  const stale = { ...receipt(renderPlan, 3), chunk: digest("9") };
  const statuses = productionRenderChunkStatuses({
    plan: renderPlan,
    receipts: [complete, stale, { ...complete, chunk: digest("7") }],
    attempts: [
      {
        slot: renderPlan.chunks[1]!.slot,
        chunk: renderPlan.chunks[1]!.id,
        state: "running",
        correction: "",
      },
      {
        slot: renderPlan.chunks[2]!.slot,
        chunk: renderPlan.chunks[2]!.id,
        state: "failed",
        correction: "recapture",
      },
      {
        slot: renderPlan.chunks[4]!.slot,
        chunk: digest("8"),
        state: "failed",
        correction: "old",
      },
    ],
  });
  TestValidator.predicate(
    "status distinguishes every resume state",
    statuses[0]?.status === "complete" &&
      statuses[1]?.status === "running" &&
      statuses[2]?.status === "failed" &&
      statuses[2]?.correction === "recapture" &&
      statuses[3]?.status === "stale" &&
      statuses[4]?.status === "stale" &&
      statuses[5]?.status === "planned",
  );

  verifyProductionRenderChunkReceipt({
    plan: renderPlan,
    chunk: renderPlan.chunks[0]!,
    receipt: complete,
  });
  const badIdentity = { ...complete, chunk: digest("8") };
  const badVersion = { ...complete, version: 2 as 1 };
  const badSlot = { ...complete, slot: "other" };
  const badCount = { ...complete, frames: complete.frames.slice(1) };
  const badFrame = structuredClone(complete);
  badFrame.frames[0]!.globalFrame = 9;
  const badRaster = structuredClone(complete);
  badRaster.frames[0]!.width = 17;
  const badHeight = structuredClone(complete);
  badHeight.frames[0]!.height = 17;
  const badFrameDigest = structuredClone(complete);
  badFrameDigest.frames[0]!.digest = "sha256:no" as AutoMovieContentDigest;
  const badFrameBytes = structuredClone(complete);
  badFrameBytes.frames[0]!.bytes = 0;
  const badEncoded = structuredClone(complete);
  badEncoded.encoded.bytes = 0;
  const badEncodedDigest = structuredClone(complete);
  badEncodedDigest.encoded.digest = "sha256:no" as AutoMovieContentDigest;
  TestValidator.predicate(
    "receipt verification rejects every stale or partial fact",
    [
      badIdentity,
      badVersion,
      badSlot,
      badCount,
      badFrame,
      badRaster,
      badHeight,
      badFrameDigest,
      badFrameBytes,
      badEncoded,
      badEncodedDigest,
    ].every((candidate) =>
      throws(() =>
        verifyProductionRenderChunkReceipt({
          plan: renderPlan,
          chunk: renderPlan.chunks[0]!,
          receipt: candidate,
        }),
      ),
    ),
  );

  const acquired: string[] = [];
  const released: string[] = [];
  const failed: string[] = [];
  const scheduledPlan = {
    ...renderPlan,
    chunks: renderPlan.chunks.slice(0, 4),
  };
  const run = await runProductionRenderJob({
    plan: scheduledPlan,
    workers: 2,
    adapters: {
      current: async (chunk) =>
        chunk.slot === scheduledPlan.chunks[0]!.slot
          ? receipt(scheduledPlan, 0)
          : null,
      acquire: async (chunk) => {
        acquired.push(chunk.slot);
        return chunk.slot !== scheduledPlan.chunks[1]!.slot;
      },
      render: async (chunk) => {
        if (chunk.slot === scheduledPlan.chunks[3]!.slot)
          throw new Error("encoder failed");
        return receipt(scheduledPlan, scheduledPlan.chunks.indexOf(chunk));
      },
      fail: async (chunk, correction) => {
        failed.push(`${chunk.slot}:${correction}`);
      },
      release: async (chunk) => {
        released.push(chunk.slot);
      },
    },
  });
  TestValidator.predicate(
    "scheduler resumes, locks, records failure, and always releases",
    run.complete.length === 1 &&
      run.busy.length === 1 &&
      run.rendered.length === 1 &&
      run.failed[0]?.correction === "encoder failed" &&
      acquired.length === 3 &&
      released.length === 2 &&
      failed[0]?.endsWith(":encoder failed") === true,
  );
  TestValidator.predicate(
    "scheduler rejects invalid workers and missing deliverables",
    (
      await Promise.all([
        rejects(
          runProductionRenderJob({
            plan: renderPlan,
            workers: 0,
            adapters: {
              current: async () => null,
              acquire: async () => false,
              render: async () => complete,
              fail: async () => undefined,
              release: async () => undefined,
            },
          }),
        ),
        rejects(
          runProductionRenderJob({
            plan: renderPlan,
            workers: 1.5,
            adapters: {
              current: async () => null,
              acquire: async () => false,
              render: async () => complete,
              fail: async () => undefined,
              release: async () => undefined,
            },
          }),
        ),
        rejects(
          runProductionRenderJob({
            plan: renderPlan,
            workers: 1,
            deliverable: "absent",
            adapters: {
              current: async () => null,
              acquire: async () => false,
              render: async () => complete,
              fail: async () => undefined,
              release: async () => undefined,
            },
          }),
        ),
      ])
    ).every(Boolean),
  );
  const emptyRun = await runProductionRenderJob({
    plan: nonVideoPlan,
    workers: 2,
    adapters: {
      current: async () => null,
      acquire: async () => false,
      render: async () => complete,
      fail: async () => undefined,
      release: async () => undefined,
    },
  });
  const nonErrorPlan = {
    ...renderPlan,
    chunks: renderPlan.chunks.slice(0, 1),
  };
  const nonErrorRun = await runProductionRenderJob({
    plan: nonErrorPlan,
    workers: 1,
    adapters: {
      current: async () => null,
      acquire: async () => true,
      render: async () => {
        throw NON_ERROR_FAILURE;
      },
      fail: async () => undefined,
      release: async () => undefined,
    },
  });
  TestValidator.predicate(
    "scheduler handles an empty plan and non-Error adapter failure",
    emptyRun.complete.length === 0 &&
      emptyRun.rendered.length === 0 &&
      emptyRun.busy.length === 0 &&
      emptyRun.failed.length === 0 &&
      nonErrorRun.failed[0]?.correction === "string failure",
  );

  const rejectsAudioAssets = (
    assets: Parameters<typeof planProductionRenderJob>[0]["audioAssets"],
  ): boolean =>
    throws(() =>
      planProductionRenderJob({
        timeline: timeline(),
        audioAssets: assets,
        sourceFingerprints: sourceFingerprints(),
        production: {
          ...productionDesign({
            id: "render-film",
            targetRuntimeSeconds: 3,
            frameFormat: {
              width: 16,
              height: 16,
              fps: 2,
              colorSpace: "srgb",
            },
          }),
          deliverables: [{ id: "feature", kind: "feature", required: true }],
        },
        runtimeIdentity: renderPlan.runtimeIdentity,
        chunkFrames: 2,
      }),
    );
  const baseAudio = audioAssets()[0]!;
  TestValidator.predicate(
    "audio source preflight rejects missing, duplicate, or malformed identity",
    [
      [],
      [{ ...baseAudio, path: " " }],
      [baseAudio, { ...baseAudio }],
      [{ ...baseAudio, digest: "sha256:no" as AutoMovieContentDigest }],
      [{ ...baseAudio, durationSeconds: Number.NaN }],
      [{ ...baseAudio, durationSeconds: 0 }],
      [{ ...baseAudio, durationSeconds: 2 }],
      [{ ...baseAudio, sampleRate: 1.5 }],
      [{ ...baseAudio, sampleRate: 0 }],
      [{ ...baseAudio, channels: 1.5 }],
      [{ ...baseAudio, channels: 0 }],
    ].every(rejectsAudioAssets),
  );

  const badClock = timeline();
  badClock.fps = 3;
  const badFilmIdentity = timeline();
  badFilmIdentity.id = "other-film";
  const oddRaster = productionDesign({
    id: "render-film",
    targetRuntimeSeconds: 3,
    frameFormat: {
      width: 17,
      height: 16,
      fps: 2,
      colorSpace: "srgb",
    },
  });
  const oddHeight = {
    ...oddRaster,
    frameFormat: { ...oddRaster.frameFormat, width: 16, height: 17 },
  };
  const badRuntime = productionDesign({
    id: "render-film",
    targetRuntimeSeconds: 4,
    frameFormat: {
      width: 16,
      height: 16,
      fps: 2,
      colorSpace: "srgb",
    },
  });
  const gap = timeline();
  gap.segments = [];
  const firstDissolve = timeline();
  firstDissolve.segments = [
    {
      ...firstDissolve.segments[0]!,
      transitionIn: { kind: "dissolve", durationFrames: 1 },
    },
  ];
  TestValidator.predicate(
    "planner and sampler fail closed on invalid boundaries and identities",
    throws(() =>
      planProductionRenderJob({
        timeline: timeline(),
        audioAssets: audioAssets(),
        sourceFingerprints: sourceFingerprints(),
        production: productionDesign(),
        runtimeIdentity: renderPlan.runtimeIdentity,
        chunkFrames: 0,
      }),
    ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: productionDesign(),
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 1.5,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: badClock,
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: productionDesign({
            id: "render-film",
            targetRuntimeSeconds: 3,
          }),
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: oddRaster,
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: oddHeight,
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: badFilmIdentity,
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: productionDesign({
            id: "render-film",
            targetRuntimeSeconds: 3,
          }),
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: badRuntime,
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
        }),
      ) &&
      throws(() => sampleProductionRenderFrame(timeline(), -1)) &&
      throws(() => sampleProductionRenderFrame(timeline(), Number.NaN)) &&
      throws(() => sampleProductionRenderFrame(timeline(), 6)) &&
      throws(() => sampleProductionRenderFrame(gap, 0)) &&
      throws(() => sampleProductionRenderFrame(firstDissolve, 0)) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [
              { id: "guides", kind: "guide-pass", required: true },
            ],
          },
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
          guidePasses: ["beauty" as "depth"],
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [
              { id: "guides", kind: "guide-pass", required: true },
            ],
          },
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
          guidePasses: ["mask", "pose"],
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [
              { id: "guides", kind: "guide-pass", required: true },
            ],
          },
          runtimeIdentity: renderPlan.runtimeIdentity,
          chunkFrames: 2,
          guidePasses: [],
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [{ id: "feature", kind: "feature", required: true }],
          },
          runtimeIdentity: {
            ...renderPlan.runtimeIdentity,
            encoder: {
              ...renderPlan.runtimeIdentity.encoder,
              arguments: {
                ...renderPlan.runtimeIdentity.encoder.arguments,
                speed: Number.NaN,
              },
            },
          },
          chunkFrames: 2,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [{ id: "feature", kind: "feature", required: true }],
          },
          runtimeIdentity: {
            ...renderPlan.runtimeIdentity,
            encoder: {
              ...renderPlan.runtimeIdentity.encoder,
              package: (() => undefined) as unknown as string,
            },
          },
          chunkFrames: 2,
        }),
      ) &&
      throws(() => plan({ incoming: digest("7") })) &&
      throws(() =>
        plan({
          ...sourceFingerprints(),
          outgoing: "sha256:no" as AutoMovieContentDigest,
        }),
      ) &&
      throws(() =>
        planProductionRenderJob({
          timeline: timeline(),
          audioAssets: audioAssets(),
          sourceFingerprints: sourceFingerprints(),
          production: {
            ...productionDesign({
              id: "render-film",
              targetRuntimeSeconds: 3,
              frameFormat: {
                width: 16,
                height: 16,
                fps: 2,
                colorSpace: "srgb",
              },
            }),
            deliverables: [{ id: "feature", kind: "feature", required: true }],
          },
          runtimeIdentity: {
            ...renderPlan.runtimeIdentity,
            sourceDigest: "sha256:no" as AutoMovieContentDigest,
          },
          chunkFrames: 2,
        }),
      ),
  );
};
