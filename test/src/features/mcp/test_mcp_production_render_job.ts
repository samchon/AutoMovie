import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  IAutoMovieProductionRenderChunkReceipt,
  IAutoMovieProductionRenderJobPlan,
  assertProductionFeatureUsesRenditionClips,
  assertProductionFeatureUsesRenditionVideo,
  canonicalProductionWebVtt,
  conformProductionRenditionVideoMp4,
  planProductionRenderGc,
  planProductionRenderJob,
  probeProductionMedia,
  productionRenderChunkStatuses,
  productionRenderLayersForPass,
  readAutoMovieProductionOwnedFile,
  resolveProductionRenderTierFrameFormat,
  runProductionRenderJob,
  sampleProductionRenderFrame,
  verifyProductionRenderChunkReceipt,
  verifyProductionRenderJobPlan,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionDesign,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";
import { productionH264Mp4 } from "./productionMediaFixtures";

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

interface IRenderJobFixtureFailure {
  error: unknown;
}

interface IRenderJobFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class RenderJobFixtureCleanupError extends AggregateError {}

/** Attempt every acquired render-job fixture cleanup without hiding failure. */
export const preserveRenderJobFixtureCleanup = (
  failure: IRenderJobFixtureFailure | undefined,
  resources: readonly IRenderJobFixtureCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new RenderJobFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Render-job fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

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
  tier?: Parameters<typeof planProductionRenderJob>[0]["tier"],
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
    tier,
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
 * 3. Caption placements canonicalize by frame/id into deterministic WebVTT,
 *    preserving language and escaping authored plain text with or without a
 *    speaker tag.
 * 4. Planned, running, failed, stale, and complete status rows retain one slot
 *    while content ids change.
 * 5. A stored plan must reproduce exactly from current compiler-owned inputs.
 * 6. Receipts require exact identity, ordered global frames, raster, positive
 *    safe-integer byte counts, and SHA-256 facts.
 * 7. The worker scheduler reuses current chunks, skips busy locks, commits valid
 *    renders, records failures, releases every acquired lock, rejects invalid
 *    requests, and drains in-flight peers before propagating a fatal adapter
 *    failure.
 * 8. Invalid chunk sizes, clock mismatches, out-of-range/gap frames, a first
 *    dissolve, invalid guide passes, and non-finite runtime identity fail
 *    closed.
 * 9. Render-state reads accept only stable physical descendants: traversal, linked
 *    ancestors/files, non-files, and replacement races fail closed.
 */
export const test_mcp_production_render_job = async (): Promise<void> => {
  const repaintTimeline: IAutoMovieFilmTimeline = {
    ...timeline(),
    totalFrames: 4,
    segments: ["opening", "answer"].map((shot, index) => ({
      shot,
      sourceInFrame: 0,
      sourceOutFrame: 2,
      startFrame: index * 2,
      endFrame: index * 2 + 2,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" as const },
      transitionOut: { kind: "cut" as const },
    })),
  };
  const repaintClips = new Map<string, Uint8Array>([
    [
      "opening",
      await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 2,
        frameCount: 2,
      }),
    ],
    [
      "answer",
      await productionH264Mp4({
        width: 16,
        height: 16,
        fps: 2,
        frameCount: 2,
      }),
    ],
  ]);
  const conformedRepaint = conformProductionRenditionVideoMp4({
    timeline: repaintTimeline,
    clips: repaintClips,
  });
  const incompatibleAnswer = Buffer.from(repaintClips.get("answer")!);
  const avcConfiguration = incompatibleAnswer.indexOf("avcC");
  if (avcConfiguration < 0)
    throw new Error("H.264 fixture has no AVC decoder configuration box.");
  incompatibleAnswer[avcConfiguration + 6] ^= 1;
  const mismatchedRepaint = Buffer.from(conformedRepaint);
  const mediaData = mismatchedRepaint.indexOf("mdat");
  if (mediaData < 0)
    throw new Error("Conformed repaint has no media data box.");
  mismatchedRepaint[mediaData + 4] ^= 1;
  const nonSyncRendition = Buffer.from(conformedRepaint);
  const firstTrackRun = nonSyncRendition.indexOf("trun");
  if (firstTrackRun < 0)
    throw new Error(
      "Conformed repaint has no track-run sample flags for a dependency witness.",
    );
  const sampleFlags = firstTrackRun + 24;
  if (sampleFlags + 4 > nonSyncRendition.length)
    throw new Error("Conformed repaint has a truncated track-run sample.");
  const originalSampleFlags = nonSyncRendition.readUInt32BE(sampleFlags);
  if (originalSampleFlags !== 0x02000000 && originalSampleFlags !== 0x00010000)
    throw new Error(
      `Conformed repaint has unexpected canonical sample flags 0x${originalSampleFlags.toString(16)}.`,
    );
  nonSyncRendition.writeUInt32BE(0x00010000, sampleFlags);
  const nonSyncDependencyMismatch = Buffer.from(nonSyncRendition);
  nonSyncDependencyMismatch.writeUInt32BE(0x02010000, sampleFlags);
  let sampleDifference = "";
  try {
    assertProductionFeatureUsesRenditionClips({
      feature: mismatchedRepaint,
      timeline: repaintTimeline,
      clips: repaintClips,
    });
  } catch (error) {
    sampleDifference = error instanceof Error ? error.message : String(error);
  }
  const sampleDifferenceJson = sampleDifference.indexOf("{");
  const sampleDifferenceDetails =
    sampleDifferenceJson === -1
      ? null
      : (JSON.parse(sampleDifference.slice(sampleDifferenceJson)) as {
          timing: {
            actual: { duration: number; dts: number; cts: number };
            expected: { duration: number; dts: number; cts: number };
          };
          flags: {
            actual: { isSync: boolean; dependsOn: number };
            expected: { isSync: boolean; dependsOn: number };
            match: boolean;
          };
          sampleDescriptionMatches: boolean;
          payload: {
            actualBytes: number;
            expectedBytes: number;
            firstDifferingActualByte: number;
          };
        });
  TestValidator.predicate(
    "repaint conform preserves exact cut-only shot samples and rejects incompatible clips or transitions",
    probeProductionMedia({
      kind: "guide-pass",
      mediaType: "video/mp4",
      bytes: conformedRepaint,
    }).kind === "video" &&
      (() => {
        assertProductionFeatureUsesRenditionClips({
          feature: conformedRepaint,
          timeline: repaintTimeline,
          clips: repaintClips,
        });
        assertProductionFeatureUsesRenditionVideo({
          feature: conformedRepaint,
          renditionVideo: conformedRepaint,
        });
        return true;
      })() &&
      sampleDifferenceDetails !== null &&
      JSON.stringify(sampleDifferenceDetails.timing.actual) ===
        JSON.stringify(sampleDifferenceDetails.timing.expected) &&
      sampleDifferenceDetails.payload.actualBytes > 0 &&
      sampleDifferenceDetails.payload.actualBytes ===
        sampleDifferenceDetails.payload.expectedBytes &&
      sampleDifferenceDetails.flags.actual.isSync === true &&
      sampleDifferenceDetails.flags.actual.dependsOn === 2 &&
      sampleDifferenceDetails.flags.expected.isSync === true &&
      sampleDifferenceDetails.flags.expected.dependsOn === 0 &&
      sampleDifferenceDetails.flags.match === true &&
      sampleDifferenceDetails.sampleDescriptionMatches === true &&
      sampleDifferenceDetails.payload.firstDifferingActualByte === 0 &&
      throws(() =>
        assertProductionFeatureUsesRenditionVideo({
          feature: nonSyncDependencyMismatch,
          renditionVideo: nonSyncRendition,
        }),
      ) &&
      throws(() =>
        conformProductionRenditionVideoMp4({
          timeline: {
            ...repaintTimeline,
            segments: repaintTimeline.segments.map((segment, index) =>
              index === 0
                ? {
                    ...segment,
                    transitionOut: {
                      kind: "fade" as const,
                      durationFrames: 1,
                    },
                  }
                : segment,
            ),
          },
          clips: repaintClips,
        }),
      ) &&
      throws(() =>
        conformProductionRenditionVideoMp4({
          timeline: repaintTimeline,
          clips: new Map(repaintClips).set("answer", incompatibleAnswer),
        }),
      ),
  );
  const renderPlan = plan();
  const proxyPlan = planProductionRenderJob({
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
        { id: "feature", kind: "feature", required: true },
        { id: "guides", kind: "guide-pass", required: true },
      ],
    },
    runtimeIdentity: renderPlan.runtimeIdentity,
    chunkFrames: 2,
    tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
  });
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
  const typedGuides = planProductionRenderJob({
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
        {
          id: "depth-guide",
          kind: "guide-pass",
          pass: "depth",
          required: true,
        },
        {
          id: "normal-guide",
          kind: "guide-pass",
          pass: "normal",
          required: true,
        },
      ],
    },
    runtimeIdentity: renderPlan.runtimeIdentity,
    chunkFrames: 6,
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
    renderPlan.version === 3 &&
      renderPlan.productionId === "render-film" &&
      renderPlan.chunks.every((chunk) =>
        chunk.slot.startsWith("render-film:final:"),
      ) &&
      renderPlan.tier.kind === "final" &&
      renderPlan.sourceFrameFormat.fps === 2 &&
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
      typedGuides.chunks.some(
        (chunk) =>
          chunk.deliverable === "depth-guide" && chunk.pass === "depth",
      ) &&
      typedGuides.chunks.some(
        (chunk) =>
          chunk.deliverable === "normal-guide" && chunk.pass === "normal",
      ) &&
      booleanIdentityPlan.chunks.length === 1,
  );
  TestValidator.equals(
    "proxy and final tiers preserve one edit while owning distinct clocks and chunks",
    namedFacts([
      [
        "proxyPlanEditFingerprintRenderPlan",
        () => proxyPlan.editFingerprint === renderPlan.editFingerprint,
      ],
      ["proxyPlanTierKind", () => proxyPlan.tier.kind === "proxy"],
      ["proxyPlanFrameFormatWidth", () => proxyPlan.frameFormat.width === 8],
      ["proxyPlanFrameFormatHeight", () => proxyPlan.frameFormat.height === 8],
      ["proxyPlanFrameFormatFps", () => proxyPlan.frameFormat.fps === 1],
      ["proxyPlanTotalFrames", () => proxyPlan.totalFrames === 3],
      [
        "proxyPlanChunksChunk",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks.every((chunk) =>
            chunk.slot.startsWith("render-film:proxy:"),
          ),
      ],
      [
        "proxyPlanChunksId",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks[0]?.id !== renderPlan.chunks[0]?.id,
      ],
      [
        "proxyPlanChunksFrames",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks[0]?.frames[0]?.timelineFrame === 0,
      ],
      [
        "proxyPlanChunksFrames2",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks[0]?.frames[1]?.timelineFrame === 2,
      ],
      [
        "proxyPlanChunksFrames3",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks[1]?.frames[0]?.timelineFrame === 4,
      ],
      [
        "proxyPlanChunksFrames4",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          proxyPlan.chunks[1]?.frames[0]?.timeSeconds === 2,
      ],
      [
        "resolveProductionRenderTierFrameFormatRenderPlanSourceFrameFormat",
        () =>
          proxyPlan.tier.kind === "proxy" &&
          resolveProductionRenderTierFrameFormat(
            renderPlan.sourceFrameFormat,
            proxyPlan.tier,
          ).fps === 1,
      ],
    ]),
    {
      proxyPlanEditFingerprintRenderPlan: true,
      proxyPlanTierKind: true,
      proxyPlanFrameFormatWidth: true,
      proxyPlanFrameFormatHeight: true,
      proxyPlanFrameFormatFps: true,
      proxyPlanTotalFrames: true,
      proxyPlanChunksChunk: true,
      proxyPlanChunksId: true,
      proxyPlanChunksFrames: true,
      proxyPlanChunksFrames2: true,
      proxyPlanChunksFrames3: true,
      proxyPlanChunksFrames4: true,
      resolveProductionRenderTierFrameFormatRenderPlanSourceFrameFormat: true,
    },
  );
  TestValidator.predicate(
    "render tiers reject ambiguous quality policies and inexact proxy clocks",
    [
      { kind: "invalid", resolutionScale: 0.5, frameStep: 2 },
      { kind: "final", resolutionScale: 0.5, frameStep: 1 },
      { kind: "proxy", resolutionScale: 1, frameStep: 1 },
      { kind: "proxy", resolutionScale: 0, frameStep: 2 },
      { kind: "proxy", resolutionScale: 2, frameStep: 2 },
      { kind: "proxy", resolutionScale: Number.NaN, frameStep: 2 },
      { kind: "proxy", resolutionScale: 0.5, frameStep: 0 },
      { kind: "proxy", resolutionScale: 0.5, frameStep: 1.5 },
      { kind: "proxy", resolutionScale: 0.5, frameStep: 17 },
    ].every((tier) =>
      throws(() =>
        resolveProductionRenderTierFrameFormat(
          renderPlan.sourceFrameFormat,
          tier as Parameters<typeof resolveProductionRenderTierFrameFormat>[1],
        ),
      ),
    ) &&
      throws(() =>
        plan(sourceFingerprints(), {
          kind: "proxy",
          resolutionScale: 0.5,
          frameStep: 4,
        }),
      ),
  );
  TestValidator.equals(
    "shot source identity invalidates only ranges that sample that shot",
    namedFacts([
      [
        "selectivelyChangedChunksId",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[0]?.id !== renderPlan.chunks[0]?.id,
      ],
      [
        "selectivelyChangedChunksId2",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[1]?.id !== renderPlan.chunks[1]?.id,
      ],
      [
        "selectivelyChangedChunksId3",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[2]?.id === renderPlan.chunks[2]?.id,
      ],
      [
        "selectivelyChangedChunksId4",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[3]?.id !== renderPlan.chunks[3]?.id,
      ],
      [
        "selectivelyChangedChunksId5",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[4]?.id !== renderPlan.chunks[4]?.id,
      ],
      [
        "selectivelyChangedChunksId6",
        () =>
          chunk.slot !== scheduledPlan.chunks[3]!.slot &&
          selectivelyChanged.chunks[5]?.id === renderPlan.chunks[5]?.id,
      ],
    ]),
    {
      selectivelyChangedChunksId: true,
      selectivelyChangedChunksId2: true,
      selectivelyChangedChunksId3: true,
      selectivelyChangedChunksId4: true,
      selectivelyChangedChunksId5: true,
      selectivelyChangedChunksId6: true,
    },
  );

  const fadedIn = sampleProductionRenderFrame(timeline(), 0);
  const opaque = sampleProductionRenderFrame(timeline(), 1);
  const dissolveStart = sampleProductionRenderFrame(timeline(), 2);
  const dissolveMiddle = sampleProductionRenderFrame(timeline(), 3);
  const fadedOut = sampleProductionRenderFrame(timeline(), 5);
  TestValidator.equals(
    "film-global samples preserve fades and dissolve source frames",
    namedFacts([
      ["fadedInLayersWeight", () => fadedIn.layers[0]?.weight === 0],
      ["opaqueLayersWeight", () => opaque.layers[0]?.weight === 0.5],
      [
        "dissolveStartLayersShot",
        () => dissolveStart.layers[0]?.shot === "outgoing",
      ],
      [
        "dissolveStartLayersSourceFrame",
        () => dissolveStart.layers[0]?.sourceFrame === 2,
      ],
      [
        "dissolveStartLayersWeight",
        () => dissolveStart.layers[0]?.weight === 1,
      ],
      [
        "dissolveStartLayersShot2",
        () => dissolveStart.layers[1]?.shot === "incoming",
      ],
      [
        "dissolveStartLayersSourceFrame2",
        () => dissolveStart.layers[1]?.sourceFrame === 0,
      ],
      [
        "dissolveStartLayersWeight2",
        () => dissolveStart.layers[1]?.weight === 0,
      ],
      [
        "dissolveMiddleLayersWeight",
        () => dissolveMiddle.layers[0]?.weight === 0.5,
      ],
      [
        "dissolveMiddleLayersWeight2",
        () => dissolveMiddle.layers[1]?.weight === 0.5,
      ],
      ["fadedOutLayersWeight", () => fadedOut.layers[0]?.weight === 0.5],
    ]),
    {
      fadedInLayersWeight: true,
      opaqueLayersWeight: true,
      dissolveStartLayersShot: true,
      dissolveStartLayersSourceFrame: true,
      dissolveStartLayersWeight: true,
      dissolveStartLayersShot2: true,
      dissolveStartLayersSourceFrame2: true,
      dissolveStartLayersWeight2: true,
      dissolveMiddleLayersWeight: true,
      dissolveMiddleLayersWeight2: true,
      fadedOutLayersWeight: true,
    },
  );
  TestValidator.equals(
    "structural passes select one semantic dissolve layer while beauty blends",
    namedFacts([
      [
        "productionRenderLayersForPassDissolveMiddleBeauty",
        () =>
          cleanupFailures.length === 0 &&
          productionRenderLayersForPass(dissolveMiddle, "beauty").length === 2,
      ],
      [
        "productionRenderLayersForPassDissolveMiddleDepth",
        () =>
          cleanupFailures.length === 0 &&
          productionRenderLayersForPass(dissolveMiddle, "depth").length === 1,
      ],
      [
        "productionRenderLayersForPassDissolveMiddleNormal",
        () =>
          productionRenderLayersForPass(dissolveMiddle, "normal")[0]?.shot ===
          "incoming",
      ],
      [
        "productionRenderLayersForPassDissolveMiddleNormal2",
        () =>
          productionRenderLayersForPass(dissolveMiddle, "normal")[0]?.weight ===
          1,
      ],
      [
        "productionRenderLayersForPassDissolveStartPose",
        () =>
          productionRenderLayersForPass(dissolveStart, "pose")[0]?.shot ===
          "outgoing",
      ],
      [
        "productionRenderLayersForPassFadedOutMask",
        () => productionRenderLayersForPass(fadedOut, "mask")[0]?.weight === 1,
      ],
    ]),
    {
      productionRenderLayersForPassDissolveMiddleBeauty: true,
      productionRenderLayersForPassDissolveMiddleDepth: true,
      productionRenderLayersForPassDissolveMiddleNormal: true,
      productionRenderLayersForPassDissolveMiddleNormal2: true,
      productionRenderLayersForPassDissolveStartPose: true,
      productionRenderLayersForPassFadedOutMask: true,
    },
  );

  const retainedPointer = `final/pointers/${renderPlan.chunks[0]!.id.slice(7)}`;
  const retainedTree = `final/tmp/${renderPlan.chunks[0]!.id.slice(7)}.current.101`;
  const orphanTree = `final/tmp/${renderPlan.chunks[0]!.id.slice(7)}.orphan.102`;
  const stalePointer = `final/pointers/${digest("f").slice(7)}`;
  const staleTree = `final/tmp/${digest("f").slice(7)}.stale.103`;
  const garbageCollection = planProductionRenderGc({
    plans: [renderPlan, proxyPlan],
    publicationPaths: ["publication/deliverables/final/current.mp4"],
    retainedChunkPaths: [retainedPointer, retainedTree],
    candidates: [
      {
        path: `final/chunks/${renderPlan.chunks[0]!.id.slice(7)}`,
        kind: "chunk",
        digest: renderPlan.chunks[0]!.id,
        bytes: 10,
      },
      {
        path: `proxy/chunks/${proxyPlan.chunks[0]!.id.slice(7)}`,
        kind: "chunk",
        digest: proxyPlan.chunks[0]!.id,
        bytes: 20,
      },
      {
        path: `final/chunks/${digest("0").slice(7)}`,
        kind: "chunk",
        digest: digest("0"),
        bytes: 30,
      },
      {
        path: retainedPointer,
        kind: "chunk-pointer",
        digest: renderPlan.chunks[0]!.id,
        bytes: 5,
      },
      {
        path: retainedTree,
        kind: "chunk-tree",
        digest: renderPlan.chunks[0]!.id,
        bytes: 7,
      },
      {
        path: orphanTree,
        kind: "chunk-tree",
        digest: renderPlan.chunks[0]!.id,
        bytes: 11,
      },
      {
        path: stalePointer,
        kind: "chunk-pointer",
        digest: digest("f"),
        bytes: 13,
      },
      {
        path: staleTree,
        kind: "chunk-tree",
        digest: digest("f"),
        bytes: 17,
      },
      {
        path: "proxy/quarantine/old",
        kind: "quarantine",
        digest: null,
        bytes: 40,
      },
      {
        path: "publication/deliverables/final/current.mp4",
        kind: "publication",
        digest: null,
        bytes: 50,
      },
      {
        path: "publication/deliverables/proxy/stale.mp4",
        kind: "publication",
        digest: null,
        bytes: 60,
      },
    ],
  });
  const rejectsGcCandidates = (
    candidates: Parameters<typeof planProductionRenderGc>[0]["candidates"],
  ): boolean =>
    throws(() =>
      planProductionRenderGc({
        plans: [renderPlan],
        publicationPaths: [],
        retainedChunkPaths: [],
        candidates,
      }),
    );
  const validChunk = {
    path: `final/chunks/${renderPlan.chunks[0]!.id.slice(7)}`,
    kind: "chunk" as const,
    digest: renderPlan.chunks[0]!.id,
    bytes: 1,
  };
  const validPointer = {
    path: retainedPointer,
    kind: "chunk-pointer" as const,
    digest: renderPlan.chunks[0]!.id,
    bytes: 1,
  };
  const rejectsRetainedChunkPaths = [
    [retainedPointer, retainedPointer],
    [`final/pointers/${digest("e").slice(7)}`],
    [retainedPointer],
  ].every((retainedChunkPaths) =>
    throws(() =>
      planProductionRenderGc({
        plans: [renderPlan],
        publicationPaths: [],
        retainedChunkPaths,
        candidates: [validPointer],
      }),
    ),
  );
  const rejectsStaleRetainedPair = throws(() =>
    planProductionRenderGc({
      plans: [renderPlan],
      publicationPaths: [],
      retainedChunkPaths: [stalePointer, staleTree],
      candidates: [
        {
          path: stalePointer,
          kind: "chunk-pointer",
          digest: digest("f"),
          bytes: 1,
        },
        {
          path: staleTree,
          kind: "chunk-tree",
          digest: digest("f"),
          bytes: 1,
        },
      ],
    }),
  );
  TestValidator.predicate(
    "render GC marks both current tiers and sweeps only unreferenced bytes",
    garbageCollection.keep.length === 5 &&
      garbageCollection.keep.some(
        (candidate) => candidate.path === retainedPointer,
      ) &&
      garbageCollection.keep.some(
        (candidate) => candidate.path === retainedTree,
      ) &&
      garbageCollection.remove.some(
        (candidate) => candidate.path === orphanTree,
      ) &&
      garbageCollection.remove.some(
        (candidate) => candidate.path === stalePointer,
      ) &&
      garbageCollection.remove.some(
        (candidate) => candidate.path === staleTree,
      ) &&
      garbageCollection.reclaimableBytes === 171 &&
      rejectsRetainedChunkPaths &&
      rejectsStaleRetainedPair &&
      [
        [{ ...validChunk }, { ...validChunk }],
        [{ ...validChunk, bytes: -1 }],
        [{ ...validChunk, bytes: 1.5 }],
        [{ ...validChunk, digest: null }],
        [{ ...validChunk, digest: digest("f") }],
        [{ ...validChunk, path: "final/chunks/not-a-digest" }],
        [
          {
            ...validPointer,
            path: `final/pointer/${renderPlan.chunks[0]!.id.slice(7)}`,
          },
        ],
        [{ ...validPointer, digest: digest("f") }],
        [
          {
            path: `final/tmp/${renderPlan.chunks[0]!.id.slice(7)}.missing-pid`,
            kind: "chunk-tree" as const,
            digest: renderPlan.chunks[0]!.id,
            bytes: 1,
          },
        ],
        [
          {
            path: "final/quarantine/nested/old",
            kind: "quarantine" as const,
            digest: null,
            bytes: 1,
          },
        ],
        [
          {
            path: "final/quarantine/old",
            kind: "quarantine" as const,
            digest: digest("f"),
            bytes: 1,
          },
        ],
        [
          {
            path: "deliverables/stale.mp4",
            kind: "publication" as const,
            digest: null,
            bytes: 1,
          },
        ],
        [
          {
            path: "publication/stale.mp4",
            kind: "publication" as const,
            digest: digest("f"),
            bytes: 1,
          },
        ],
        ...[
          "",
          "../escape",
          "a\\b",
          "/absolute",
          "C:/drive",
          "a//b",
          "a/./b",
        ].map((path) => [
          {
            path,
            kind: "publication" as const,
            digest: null,
            bytes: 1,
          },
        ]),
        [
          {
            path: "publication/a",
            kind: "publication" as const,
            digest: null,
            bytes: Number.MAX_SAFE_INTEGER,
          },
          {
            path: "publication/b",
            kind: "publication" as const,
            digest: null,
            bytes: 1,
          },
        ],
      ].every(rejectsGcCandidates),
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
  const escapedCaptionTimeline = timeline();
  escapedCaptionTimeline.id = "unsafe\nfilm\u2028\u2029-->";
  escapedCaptionTimeline.tracks.captions = [
    {
      id: "unsafe\nid -->",
      text: "A & <B> --> C\n\nD",
      language: "en",
      speaker: "sentinel>\nvoice",
      startFrame: 0,
      endFrame: 2,
    },
  ];
  const escapedCaptions = canonicalProductionWebVtt(escapedCaptionTimeline);
  const escapedProbe = probeProductionMedia({
    kind: "captions",
    mediaType: "text/vtt",
    bytes: Buffer.from(escapedCaptions, "utf8"),
  });
  const crOnlyProbe = probeProductionMedia({
    kind: "captions",
    mediaType: "text/vtt",
    bytes: Buffer.from(escapedCaptions.replaceAll("\n", "\r"), "utf8"),
  });
  TestValidator.equals(
    "caption track becomes canonical WebVTT",
    namedFacts([
      [
        "captionsStartsWithWEBVTT",
        () => captions.startsWith("WEBVTT render-film\n\n"),
      ],
      [
        "captionsIndexOfEarlier",
        () => captions.indexOf("earlier") < captions.indexOf("later"),
      ],
      [
        "captionsIncludes",
        () => captions.includes("00:00:00.000 --> 00:00:01.000"),
      ],
      [
        "captionsIncludesLang",
        () => captions.includes("<lang en><v sentinel>First.</v></lang>"),
      ],
      [
        "captionsIncludesN",
        () => captions.includes("\n<lang en>Second.</lang>\n"),
      ],
      [
        "tiedCaptionsIndexOfNa",
        () => tiedCaptions.indexOf("\na\n") < tiedCaptions.indexOf("\nb\n"),
      ],
      [
        "tiedCaptionsIndexOfNb",
        () => tiedCaptions.indexOf("\nb\n") < tiedCaptions.indexOf("\nc\n"),
      ],
      [
        "longCaptionsIncludes",
        () => longCaptions.includes("01:00:00.000 --> 01:00:01.000"),
      ],
      [
        "escapedCaptionsStartsWithWEBVTT",
        () =>
          escapedCaptions.startsWith(
            "WEBVTT unsafe film\u2028\u2029--&gt;\n\n",
          ),
      ],
      [
        "escapedCaptionsMatchGu",
        () =>
          cleanupFailures.length === 0 &&
          escapedCaptions.match(/-->/gu)?.length === 1,
      ],
      [
        "escapedCaptionsIncludesNunsafe",
        () => escapedCaptions.includes("\nunsafe id --&gt;\n"),
      ],
      [
        "escapedCaptionsIncludesLang",
        () =>
          escapedCaptions.includes(
            "<lang en><v sentinel&gt; voice>A &amp; &lt;B&gt; --&gt; C  D</v></lang>",
          ),
      ],
      ["escapedProbeKindWebvtt", () => escapedProbe.kind === "webvtt"],
      [
        "escapedProbeCueCount",
        () => escapedProbe.kind === "webvtt" && escapedProbe.cueCount === 1,
      ],
      ["crOnlyProbeKindWebvtt", () => crOnlyProbe.kind === "webvtt"],
      [
        "crOnlyProbeCueCount",
        () => crOnlyProbe.kind === "webvtt" && crOnlyProbe.cueCount === 1,
      ],
    ]),
    {
      captionsStartsWithWEBVTT: true,
      captionsIndexOfEarlier: true,
      captionsIncludes: true,
      captionsIncludesLang: true,
      captionsIncludesN: true,
      tiedCaptionsIndexOfNa: true,
      tiedCaptionsIndexOfNb: true,
      longCaptionsIncludes: true,
      escapedCaptionsStartsWithWEBVTT: true,
      escapedCaptionsMatchGu: true,
      escapedCaptionsIncludesNunsafe: true,
      escapedCaptionsIncludesLang: true,
      escapedProbeKindWebvtt: true,
      escapedProbeCueCount: true,
      crOnlyProbeKindWebvtt: true,
      crOnlyProbeCueCount: true,
    },
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
  TestValidator.equals(
    "status distinguishes every resume state",
    namedFacts([
      ["statusesStatusComplete", () => statuses[0]?.status === "complete"],
      ["statusesStatusRunning", () => statuses[1]?.status === "running"],
      ["statusesStatusFailed", () => statuses[2]?.status === "failed"],
      [
        "statusesCorrectionRecapture",
        () => statuses[2]?.correction === "recapture",
      ],
      ["statusesStatusStale", () => statuses[3]?.status === "stale"],
      ["statusesStatusStale2", () => statuses[4]?.status === "stale"],
      ["statusesStatusPlanned", () => statuses[5]?.status === "planned"],
    ]),
    {
      statusesStatusComplete: true,
      statusesStatusRunning: true,
      statusesStatusFailed: true,
      statusesCorrectionRecapture: true,
      statusesStatusStale: true,
      statusesStatusStale2: true,
      statusesStatusPlanned: true,
    },
  );

  const production = {
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
      { id: "feature", kind: "feature" as const, required: true },
      { id: "guides", kind: "guide-pass" as const, required: true },
    ],
  };
  const currentPlanInputs = {
    timeline: timeline(),
    production,
    runtimeIdentity: renderPlan.runtimeIdentity,
    sourceFingerprints: sourceFingerprints(),
    audioAssets: audioAssets(),
  };
  verifyProductionRenderJobPlan({ plan: renderPlan, ...currentPlanInputs });
  const tamperedPlan = structuredClone(renderPlan);
  tamperedPlan.tracks.captions += "\nNOTE tampered\n";
  TestValidator.predicate(
    "stored plan verification rejects compiler-derived field tampering",
    throws(() =>
      verifyProductionRenderJobPlan({
        plan: tamperedPlan,
        ...currentPlanInputs,
      }),
    ),
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
  const badFrameFractionalBytes = structuredClone(complete);
  badFrameFractionalBytes.frames[0]!.bytes = 1.5;
  const badEncoded = structuredClone(complete);
  badEncoded.encoded.bytes = 0;
  const badEncodedUnsafeBytes = structuredClone(complete);
  badEncodedUnsafeBytes.encoded.bytes = Number.MAX_SAFE_INTEGER + 1;
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
      badFrameFractionalBytes,
      badEncoded,
      badEncodedUnsafeBytes,
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
  TestValidator.equals(
    "scheduler resumes, locks, records failure, and always releases",
    namedFacts([
      [
        "runComplete",
        () => cleanupFailures.length === 0 && run.complete.length === 1,
      ],
      ["runBusy", () => cleanupFailures.length === 0 && run.busy.length === 1],
      [
        "runRendered",
        () => cleanupFailures.length === 0 && run.rendered.length === 1,
      ],
      [
        "runFailedCorrection",
        () => run.failed[0]?.correction === "encoder failed",
      ],
      ["acquired", () => cleanupFailures.length === 0 && acquired.length === 3],
      ["released", () => cleanupFailures.length === 0 && released.length === 2],
      [
        "failedEndsWithEncoder",
        () => failed[0]?.endsWith(":encoder failed") === true,
      ],
    ]),
    {
      runComplete: true,
      runBusy: true,
      runRendered: true,
      runFailedCorrection: true,
      acquired: true,
      released: true,
      failedEndsWithEncoder: true,
    },
  );
  const lifecyclePlan = {
    ...renderPlan,
    chunks: renderPlan.chunks.slice(0, 1),
  };
  const ATTEMPT_FAILURE: unknown = { phase: "render attempt" };
  const FAILURE_RECORD_FAILURE: unknown = { phase: "failure record" };
  const RELEASE_FAILURE: unknown = { phase: "release" };
  const captureLifecycleFailure = async (props: {
    attempt?: unknown;
    failureRecord?: unknown;
    release?: unknown;
  }): Promise<{
    failure: unknown;
    failureRecordAttempts: number;
    releaseAttempts: number;
  }> => {
    let failure: unknown;
    let failureRecordAttempts = 0;
    let releaseAttempts = 0;
    try {
      await runProductionRenderJob({
        plan: lifecyclePlan,
        workers: 1,
        adapters: {
          current: async () => null,
          acquire: async () => true,
          render: async () => {
            if (props.attempt !== undefined) throw props.attempt as Error;
            return receipt(lifecyclePlan, 0);
          },
          fail: async () => {
            ++failureRecordAttempts;
            if (props.failureRecord !== undefined)
              throw props.failureRecord as Error;
          },
          release: async () => {
            ++releaseAttempts;
            if (props.release !== undefined) throw props.release as Error;
          },
        },
      });
    } catch (error) {
      failure = error;
    }
    return { failure, failureRecordAttempts, releaseAttempts };
  };
  const releaseOnlyFailure = await captureLifecycleFailure({
    release: RELEASE_FAILURE,
  });
  const attemptAndFailureRecord = await captureLifecycleFailure({
    attempt: ATTEMPT_FAILURE,
    failureRecord: FAILURE_RECORD_FAILURE,
  });
  const attemptAndRelease = await captureLifecycleFailure({
    attempt: ATTEMPT_FAILURE,
    release: RELEASE_FAILURE,
  });
  const drainingPlan = {
    ...renderPlan,
    chunks: renderPlan.chunks.slice(0, 3),
  };
  let resumePeer = (): void => undefined;
  const peerBarrier = new Promise<undefined>((resolve) => {
    resumePeer = () => {
      resolve(undefined);
    };
  });
  let resumeRelease = (): void => undefined;
  const releaseBarrier = new Promise<undefined>((resolve) => {
    resumeRelease = () => {
      resolve(undefined);
    };
  });
  const waitOneTurn = (): Promise<undefined> =>
    new Promise<undefined>((resolve) => {
      setImmediate(() => {
        resolve(undefined);
      });
    });
  let peerDrained = false;
  let releaseStarted = false;
  let drainingReleaseAttempts = 0;
  const currentCalls: string[] = [];
  const draining = runProductionRenderJob({
    plan: drainingPlan,
    workers: 2,
    adapters: {
      current: async (chunk) => {
        currentCalls.push(chunk.slot);
        const index = drainingPlan.chunks.indexOf(chunk);
        if (index === 0) return null;
        if (index === 1) {
          await peerBarrier;
          peerDrained = true;
        }
        return receipt(drainingPlan, index);
      },
      acquire: async () => true,
      render: async () => {
        throw ATTEMPT_FAILURE;
      },
      fail: async () => {
        throw FAILURE_RECORD_FAILURE;
      },
      release: async () => {
        releaseStarted = true;
        ++drainingReleaseAttempts;
        await releaseBarrier;
        throw RELEASE_FAILURE;
      },
    },
  });
  let schedulerSettled = false;
  void draining
    .then(() => {
      schedulerSettled = true;
    })
    .catch(() => {
      schedulerSettled = true;
    });
  await waitOneTurn();
  const settledBeforeDrain = schedulerSettled;
  resumePeer();
  await waitOneTurn();
  const thirdStartedBeforeRelease = currentCalls.includes(
    drainingPlan.chunks[2]!.slot,
  );
  const settledBeforeRelease = schedulerSettled;
  resumeRelease();
  let fatalReason: unknown;
  try {
    await draining;
  } catch (error) {
    fatalReason = error;
  }
  let currentFatalReason: unknown;
  try {
    await runProductionRenderJob({
      plan: {
        ...drainingPlan,
        chunks: drainingPlan.chunks.slice(0, 1),
      },
      workers: 1,
      adapters: {
        current: async () => {
          throw NON_ERROR_FAILURE;
        },
        acquire: async () => false,
        render: async () => receipt(drainingPlan, 0),
        fail: async () => undefined,
        release: async () => undefined,
      },
    });
  } catch (error) {
    currentFatalReason = error;
  }
  TestValidator.predicate(
    "scheduler drains in-flight peers before preserving fatal failures",
    settledBeforeDrain === false &&
      peerDrained &&
      thirdStartedBeforeRelease === false &&
      releaseStarted &&
      drainingReleaseAttempts === 1 &&
      settledBeforeRelease === false &&
      aggregateContainsExactly(fatalReason, [
        ATTEMPT_FAILURE,
        FAILURE_RECORD_FAILURE,
        RELEASE_FAILURE,
      ]) &&
      currentFatalReason === NON_ERROR_FAILURE,
  );
  TestValidator.predicate(
    "scheduler preserves acquired-chunk attempt, failure-record, and release failures in phase order",
    releaseOnlyFailure.failure === RELEASE_FAILURE &&
      releaseOnlyFailure.failureRecordAttempts === 0 &&
      releaseOnlyFailure.releaseAttempts === 1 &&
      aggregateContainsExactly(attemptAndFailureRecord.failure, [
        ATTEMPT_FAILURE,
        FAILURE_RECORD_FAILURE,
      ]) &&
      attemptAndFailureRecord.failureRecordAttempts === 1 &&
      attemptAndFailureRecord.releaseAttempts === 1 &&
      aggregateContainsExactly(attemptAndRelease.failure, [
        ATTEMPT_FAILURE,
        RELEASE_FAILURE,
      ]) &&
      attemptAndRelease.failureRecordAttempts === 1 &&
      attemptAndRelease.releaseAttempts === 1,
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
  TestValidator.equals(
    "planner and sampler fail closed on invalid boundaries and identities",
    namedFacts([
      [
        "throwsPlanProductionRenderJobTimeline",
        () =>
          throws(() =>
            planProductionRenderJob({
              timeline: timeline(),
              audioAssets: audioAssets(),
              sourceFingerprints: sourceFingerprints(),
              production: productionDesign(),
              runtimeIdentity: renderPlan.runtimeIdentity,
              chunkFrames: 0,
            }),
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline2",
        () =>
          throws(() =>
            planProductionRenderJob({
              timeline: timeline(),
              audioAssets: audioAssets(),
              sourceFingerprints: sourceFingerprints(),
              production: productionDesign(),
              runtimeIdentity: renderPlan.runtimeIdentity,
              chunkFrames: 1.5,
            }),
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline3",
        () =>
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline4",
        () =>
          throws(() =>
            planProductionRenderJob({
              timeline: timeline(),
              audioAssets: audioAssets(),
              sourceFingerprints: sourceFingerprints(),
              production: oddRaster,
              runtimeIdentity: renderPlan.runtimeIdentity,
              chunkFrames: 2,
            }),
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline5",
        () =>
          throws(() =>
            planProductionRenderJob({
              timeline: timeline(),
              audioAssets: audioAssets(),
              sourceFingerprints: sourceFingerprints(),
              production: oddHeight,
              runtimeIdentity: renderPlan.runtimeIdentity,
              chunkFrames: 2,
            }),
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline6",
        () =>
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline7",
        () =>
          throws(() =>
            planProductionRenderJob({
              timeline: timeline(),
              audioAssets: audioAssets(),
              sourceFingerprints: sourceFingerprints(),
              production: badRuntime,
              runtimeIdentity: renderPlan.runtimeIdentity,
              chunkFrames: 2,
            }),
          ),
      ],
      [
        "throwsSampleProductionRenderFrameTimeline",
        () => throws(() => sampleProductionRenderFrame(timeline(), -1)),
      ],
      [
        "throwsSampleProductionRenderFrameTimeline2",
        () => throws(() => sampleProductionRenderFrame(timeline(), Number.NaN)),
      ],
      [
        "throwsSampleProductionRenderFrameTimeline3",
        () => throws(() => sampleProductionRenderFrame(timeline(), 6)),
      ],
      [
        "throwsSampleProductionRenderFrameGap",
        () => throws(() => sampleProductionRenderFrame(gap, 0)),
      ],
      [
        "throwsSampleProductionRenderFrameFirstDissolve",
        () => throws(() => sampleProductionRenderFrame(firstDissolve, 0)),
      ],
      [
        "throwsPlanProductionRenderJobTimeline8",
        () =>
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline9",
        () =>
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline10",
        () =>
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline11",
        () =>
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
                  { id: "feature", kind: "feature", required: true },
                ],
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
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline12",
        () =>
          props.attempt === undefined &&
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
                  { id: "feature", kind: "feature", required: true },
                ],
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
          ),
      ],
      [
        "throwsPlanIncoming",
        () => throws(() => plan({ incoming: digest("7") })),
      ],
      [
        "throwsPlanSourceFingerprints",
        () =>
          throws(() =>
            plan({
              ...sourceFingerprints(),
              outgoing: "sha256:no" as AutoMovieContentDigest,
            }),
          ),
      ],
      [
        "throwsPlanProductionRenderJobTimeline13",
        () =>
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
                  { id: "feature", kind: "feature", required: true },
                ],
              },
              runtimeIdentity: {
                ...renderPlan.runtimeIdentity,
                sourceDigest: "sha256:no" as AutoMovieContentDigest,
              },
              chunkFrames: 2,
            }),
          ),
      ],
    ]),
    {
      throwsPlanProductionRenderJobTimeline: true,
      throwsPlanProductionRenderJobTimeline2: true,
      throwsPlanProductionRenderJobTimeline3: true,
      throwsPlanProductionRenderJobTimeline4: true,
      throwsPlanProductionRenderJobTimeline5: true,
      throwsPlanProductionRenderJobTimeline6: true,
      throwsPlanProductionRenderJobTimeline7: true,
      throwsSampleProductionRenderFrameTimeline: true,
      throwsSampleProductionRenderFrameTimeline2: true,
      throwsSampleProductionRenderFrameTimeline3: true,
      throwsSampleProductionRenderFrameGap: true,
      throwsSampleProductionRenderFrameFirstDissolve: true,
      throwsPlanProductionRenderJobTimeline8: true,
      throwsPlanProductionRenderJobTimeline9: true,
      throwsPlanProductionRenderJobTimeline10: true,
      throwsPlanProductionRenderJobTimeline11: true,
      throwsPlanProductionRenderJobTimeline12: true,
      throwsPlanIncoming: true,
      throwsPlanSourceFingerprints: true,
      throwsPlanProductionRenderJobTimeline13: true,
    },
  );

  const ownedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-render-owned-"),
  );
  let outsideRoot: string | undefined;
  let renderJobFixtureFailure: IRenderJobFixtureFailure | undefined;
  try {
    outsideRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-render-outside-"),
    );
    const chunk = path.join(ownedRoot, "chunk");
    const frames = path.join(chunk, "frames");
    const direct = path.join(ownedRoot, "direct.json");
    const resident = path.join(frames, "resident.png");
    const outside = path.join(outsideRoot, "outside.png");
    fs.mkdirSync(frames, { recursive: true });
    fs.writeFileSync(direct, "direct");
    fs.writeFileSync(resident, "resident");
    fs.writeFileSync(outside, "outside");

    const splitIdentity = path.join(ownedRoot, "split-identity.json");
    fs.writeFileSync(splitIdentity, "split identity");
    const mutableFs = createRequire(__filename)("node:fs") as {
      lstatSync: typeof fs.lstatSync;
    };
    const nativeLstat = mutableFs.lstatSync;
    mutableFs.lstatSync = ((target, options) => {
      const status = nativeLstat(target, options);
      if (path.resolve(target.toString()) !== path.resolve(splitIdentity))
        return status;
      return new Proxy(status as fs.BigIntStats, {
        get: (current, property, receiver): unknown =>
          property === "ino"
            ? current.ino + 1n
            : Reflect.get(current, property, receiver),
      });
    }) as typeof fs.lstatSync;
    const splitIdentityBytes = (() => {
      let splitIdentityFailure: IRenderJobFixtureFailure | undefined;
      try {
        return readAutoMovieProductionOwnedFile({
          root: ownedRoot,
          directory: ownedRoot,
          relative: "split-identity.json",
        });
      } catch (error) {
        splitIdentityFailure = { error };
        throw error;
      } finally {
        preserveRenderJobFixtureCleanup(splitIdentityFailure, [
          {
            resource: "split-identity lstat hook",
            cleanup: () => {
              mutableFs.lstatSync = nativeLstat;
            },
          },
        ]);
      }
    })();
    TestValidator.equals(
      "production-owned reads separate stable pathname and descriptor identity domains",
      Buffer.from(splitIdentityBytes).toString("utf8"),
      "split identity",
    );

    const directBytes = readAutoMovieProductionOwnedFile({
      root: ownedRoot,
      directory: ownedRoot,
      relative: "direct.json",
    });
    const residentBytes = readAutoMovieProductionOwnedFile({
      root: ownedRoot,
      directory: chunk,
      relative: "frames/resident.png",
    });
    exerciseProductionOwnedDescriptorCleanup({
      root: ownedRoot,
      directory: chunk,
      relative: "frames/resident.png",
    });
    const linkedDirectory = path.join(chunk, "linked");
    const linkedFile = path.join(chunk, "linked.png");
    const blockingFile = path.join(chunk, "blocking");
    fs.symlinkSync(outsideRoot, linkedDirectory, "junction");
    fs.symlinkSync(outside, linkedFile, "file");
    fs.writeFileSync(blockingFile, "not a directory");
    TestValidator.predicate(
      "render-state reads stay inside stable physical files",
      Buffer.from(directBytes).toString("utf8") === "direct" &&
        Buffer.from(residentBytes).toString("utf8") === "resident" &&
        [
          {
            root: ownedRoot,
            directory: outsideRoot,
            relative: "outside.png",
          },
          { root: ownedRoot, directory: chunk, relative: "../direct.json" },
          { root: ownedRoot, directory: chunk, relative: "." },
          {
            root: ownedRoot,
            directory: chunk,
            relative: "linked/outside.png",
          },
          { root: ownedRoot, directory: chunk, relative: "linked.png" },
          { root: ownedRoot, directory: chunk, relative: "frames" },
          {
            root: ownedRoot,
            directory: chunk,
            relative: "blocking/resident.png",
          },
        ].every((candidate) =>
          throws(() => readAutoMovieProductionOwnedFile(candidate)),
        ),
    );

    const replacement = path.join(frames, "replacement.png");
    fs.writeFileSync(replacement, "replacement");
    const nativeRead = fs.readFileSync;
    const preserved = path.join(frames, "preserved.png");
    let swapped = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      if (
        swapped === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === resident
      ) {
        swapped = true;
        fs.renameSync(resident, preserved);
        fs.renameSync(replacement, resident);
        let pathnameReadFailure: IRenderJobFixtureFailure | undefined;
        try {
          return Reflect.apply(nativeRead, fs, [file, ...args]) as unknown;
        } catch (error) {
          pathnameReadFailure = { error };
          throw error;
        } finally {
          preserveRenderJobFixtureCleanup(pathnameReadFailure, [
            {
              resource: "pathname replacement",
              cleanup: () => fs.renameSync(resident, replacement),
            },
            {
              resource: "pathname resident",
              cleanup: () => fs.renameSync(preserved, resident),
            },
          ]);
        }
      }
      return Reflect.apply(nativeRead, fs, [file, ...args]) as unknown;
    }) as typeof fs.readFileSync;
    let pathnameSwapFailure: IRenderJobFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "render-state reads bind bytes to the verified descriptor across a pathname swap",
        Buffer.from(
          readAutoMovieProductionOwnedFile({
            root: ownedRoot,
            directory: chunk,
            relative: "frames/resident.png",
          }),
        ).toString("utf8") === "resident" && swapped === false,
      );
    } catch (error) {
      pathnameSwapFailure = { error };
      throw error;
    } finally {
      preserveRenderJobFixtureCleanup(pathnameSwapFailure, [
        {
          resource: "pathname swap read hook",
          cleanup: () => {
            fs.readFileSync = nativeRead;
          },
        },
      ]);
    }

    let replaced = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const bytes = Reflect.apply(nativeRead, fs, [file, ...args]) as unknown;
      if (replaced === false) {
        replaced = true;
        fs.rmSync(resident);
        fs.renameSync(replacement, resident);
      }
      return bytes;
    }) as typeof fs.readFileSync;
    let replacementFailure: IRenderJobFixtureFailure | undefined;
    try {
      TestValidator.predicate(
        "render-state reads reject a physical file replacement after read",
        throws(() =>
          readAutoMovieProductionOwnedFile({
            root: ownedRoot,
            directory: chunk,
            relative: "frames/resident.png",
          }),
        ) && replaced,
      );
    } catch (error) {
      replacementFailure = { error };
      throw error;
    } finally {
      preserveRenderJobFixtureCleanup(replacementFailure, [
        {
          resource: "physical replacement read hook",
          cleanup: () => {
            fs.readFileSync = nativeRead;
          },
        },
      ]);
    }
  } catch (error) {
    renderJobFixtureFailure = { error };
    throw error;
  } finally {
    const completedOutsideRoot = outsideRoot;
    preserveRenderJobFixtureCleanup(renderJobFixtureFailure, [
      {
        resource: "owned fixture root",
        cleanup: () => fs.rmSync(ownedRoot, { force: true, recursive: true }),
      },
      ...(completedOutsideRoot === undefined
        ? []
        : [
            {
              resource: "outside fixture root",
              cleanup: () =>
                fs.rmSync(completedOutsideRoot, {
                  force: true,
                  recursive: true,
                }),
            },
          ]),
    ]);
  }
};

type ProductionOwnedDescriptorFailureMode =
  | "combined-resident"
  | "combined-source"
  | "nested"
  | "primary-only"
  | "standalone-resident-close"
  | "standalone-source-close";

interface IProductionOwnedDescriptorFailureEvidence {
  caught: unknown;
  primaryFailure: Error;
  residentCloseFailure: Error;
  sourceCloseFailure: Error;
}

const captureProductionOwnedDescriptorFailure = (
  props: { root: string; directory: string; relative: string },
  mode: ProductionOwnedDescriptorFailureMode,
): IProductionOwnedDescriptorFailureEvidence => {
  const target = path.resolve(props.directory, props.relative);
  const primaryFailure = new Error(`${mode} primary failure`);
  const residentCloseFailure = new Error(`${mode} resident close failure`);
  const sourceCloseFailure = new Error(`${mode} source close failure`);
  const nativeOpen = fs.openSync;
  const nativeFstat = fs.fstatSync;
  const nativeClose = fs.closeSync;
  let sourceDescriptor: number | undefined;
  let failedResidentDescriptor: number | undefined;
  fs.openSync = ((file, ...args: unknown[]): number => {
    const descriptor = Reflect.apply(nativeOpen, fs, [file, ...args]) as number;
    if (
      sourceDescriptor === undefined &&
      path.resolve(file.toString()) === target
    )
      sourceDescriptor = descriptor;
    return descriptor;
  }) as typeof fs.openSync;
  fs.fstatSync = ((
    descriptor,
    ...args: unknown[]
  ): fs.Stats | fs.BigIntStats => {
    if (
      descriptor === sourceDescriptor &&
      (mode === "primary-only" || mode === "combined-source")
    )
      throw primaryFailure;
    if (
      sourceDescriptor !== undefined &&
      descriptor !== sourceDescriptor &&
      failedResidentDescriptor === undefined &&
      (mode === "combined-resident" || mode === "nested")
    ) {
      failedResidentDescriptor = descriptor;
      throw primaryFailure;
    }
    return Reflect.apply(nativeFstat, fs, [descriptor, ...args]) as
      | fs.Stats
      | fs.BigIntStats;
  }) as typeof fs.fstatSync;
  fs.closeSync = ((descriptor): void => {
    if (
      sourceDescriptor !== undefined &&
      descriptor !== sourceDescriptor &&
      failedResidentDescriptor === undefined &&
      mode === "standalone-resident-close"
    )
      failedResidentDescriptor = descriptor;
    nativeClose(descriptor);
    if (
      descriptor === failedResidentDescriptor &&
      (mode === "combined-resident" ||
        mode === "nested" ||
        mode === "standalone-resident-close")
    )
      throw residentCloseFailure;
    if (
      descriptor === sourceDescriptor &&
      (mode === "combined-source" ||
        mode === "nested" ||
        mode === "standalone-source-close")
    )
      throw sourceCloseFailure;
  }) as typeof fs.closeSync;
  let caught: unknown;
  let descriptorReadFailure: IRenderJobFixtureFailure | undefined;
  try {
    readAutoMovieProductionOwnedFile(props);
  } catch (error) {
    caught = error;
    descriptorReadFailure = { error };
  } finally {
    preserveRenderJobFixtureCleanup(descriptorReadFailure, [
      {
        resource: "owned-descriptor open hook",
        cleanup: () => {
          fs.openSync = nativeOpen;
        },
      },
      {
        resource: "owned-descriptor fstat hook",
        cleanup: () => {
          fs.fstatSync = nativeFstat;
        },
      },
      {
        resource: "owned-descriptor close hook",
        cleanup: () => {
          fs.closeSync = nativeClose;
        },
      },
    ]);
  }
  return {
    caught,
    primaryFailure,
    residentCloseFailure,
    sourceCloseFailure,
  };
};

const aggregateContainsExactly = (
  error: unknown,
  expected: unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const exerciseProductionOwnedDescriptorCleanup = (props: {
  root: string;
  directory: string;
  relative: string;
}): void => {
  const standalone = captureProductionOwnedDescriptorFailure(
    props,
    "standalone-source-close",
  );
  const standaloneResident = captureProductionOwnedDescriptorFailure(
    props,
    "standalone-resident-close",
  );
  const primaryOnly = captureProductionOwnedDescriptorFailure(
    props,
    "primary-only",
  );
  const combinedResident = captureProductionOwnedDescriptorFailure(
    props,
    "combined-resident",
  );
  const combinedSource = captureProductionOwnedDescriptorFailure(
    props,
    "combined-source",
  );
  const nested = captureProductionOwnedDescriptorFailure(props, "nested");
  TestValidator.predicate(
    "production-owned descriptor cleanup preserves every operation and resource failure",
    standalone.caught === standalone.sourceCloseFailure &&
      standaloneResident.caught === standaloneResident.residentCloseFailure &&
      primaryOnly.caught === primaryOnly.primaryFailure &&
      aggregateContainsExactly(combinedResident.caught, [
        combinedResident.primaryFailure,
        combinedResident.residentCloseFailure,
      ]) &&
      aggregateContainsExactly(combinedSource.caught, [
        combinedSource.primaryFailure,
        combinedSource.sourceCloseFailure,
      ]) &&
      aggregateContainsExactly(nested.caught, [
        nested.primaryFailure,
        nested.residentCloseFailure,
        nested.sourceCloseFailure,
      ]),
  );
};
