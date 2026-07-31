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
import os from "node:os";
import path from "node:path";

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
  TestValidator.predicate(
    "repaint conform preserves exact cut-only shot samples and rejects unsupported transitions",
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
  TestValidator.predicate(
    "proxy and final tiers preserve one edit while owning distinct clocks and chunks",
    proxyPlan.editFingerprint === renderPlan.editFingerprint &&
      proxyPlan.tier.kind === "proxy" &&
      proxyPlan.frameFormat.width === 8 &&
      proxyPlan.frameFormat.height === 8 &&
      proxyPlan.frameFormat.fps === 1 &&
      proxyPlan.totalFrames === 3 &&
      proxyPlan.chunks.every((chunk) =>
        chunk.slot.startsWith("render-film:proxy:"),
      ) &&
      proxyPlan.chunks[0]?.id !== renderPlan.chunks[0]?.id &&
      proxyPlan.chunks[0]?.frames[0]?.timelineFrame === 0 &&
      proxyPlan.chunks[0]?.frames[1]?.timelineFrame === 2 &&
      proxyPlan.chunks[1]?.frames[0]?.timelineFrame === 4 &&
      proxyPlan.chunks[1]?.frames[0]?.timeSeconds === 2 &&
      resolveProductionRenderTierFrameFormat(
        renderPlan.sourceFrameFormat,
        proxyPlan.tier,
      ).fps === 1,
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
  TestValidator.predicate(
    "structural passes select one semantic dissolve layer while beauty blends",
    productionRenderLayersForPass(dissolveMiddle, "beauty").length === 2 &&
      productionRenderLayersForPass(dissolveMiddle, "depth").length === 1 &&
      productionRenderLayersForPass(dissolveMiddle, "normal")[0]?.shot ===
        "incoming" &&
      productionRenderLayersForPass(dissolveMiddle, "normal")[0]?.weight ===
        1 &&
      productionRenderLayersForPass(dissolveStart, "pose")[0]?.shot ===
        "outgoing" &&
      productionRenderLayersForPass(fadedOut, "mask")[0]?.weight === 1,
  );

  const garbageCollection = planProductionRenderGc({
    plans: [renderPlan, proxyPlan],
    publicationPaths: ["publication/deliverables/final/current.mp4"],
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
        candidates,
      }),
    );
  const validChunk = {
    path: `final/chunks/${renderPlan.chunks[0]!.id.slice(7)}`,
    kind: "chunk" as const,
    digest: renderPlan.chunks[0]!.id,
    bytes: 1,
  };
  TestValidator.predicate(
    "render GC marks both current tiers and sweeps only unreferenced bytes",
    garbageCollection.keep.length === 3 &&
      garbageCollection.remove.map((candidate) => candidate.bytes).join() ===
        "30,40,60" &&
      garbageCollection.reclaimableBytes === 130 &&
      [
        [{ ...validChunk }, { ...validChunk }],
        [{ ...validChunk, bytes: -1 }],
        [{ ...validChunk, bytes: 1.5 }],
        [{ ...validChunk, digest: null }],
        [{ ...validChunk, digest: digest("f") }],
        [{ ...validChunk, path: "final/chunks/not-a-digest" }],
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
  TestValidator.predicate(
    "caption track becomes canonical WebVTT",
    captions.startsWith("WEBVTT render-film\n\n") &&
      captions.indexOf("earlier") < captions.indexOf("later") &&
      captions.includes("00:00:00.000 --> 00:00:01.000") &&
      captions.includes("<lang en><v sentinel>First.</v></lang>") &&
      captions.includes("\n<lang en>Second.</lang>\n") &&
      tiedCaptions.indexOf("\na\n") < tiedCaptions.indexOf("\nb\n") &&
      tiedCaptions.indexOf("\nb\n") < tiedCaptions.indexOf("\nc\n") &&
      longCaptions.includes("01:00:00.000 --> 01:00:01.000") &&
      escapedCaptions.startsWith("WEBVTT unsafe film\u2028\u2029--&gt;\n\n") &&
      escapedCaptions.match(/-->/gu)?.length === 1 &&
      escapedCaptions.includes("\nunsafe id --&gt;\n") &&
      escapedCaptions.includes(
        "<lang en><v sentinel&gt; voice>A &amp; &lt;B&gt; --&gt; C  D</v></lang>",
      ) &&
      escapedProbe.kind === "webvtt" &&
      escapedProbe.cueCount === 1 &&
      crOnlyProbe.kind === "webvtt" &&
      crOnlyProbe.cueCount === 1,
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
  const currentCalls: string[] = [];
  const RELEASE_FAILURE: unknown = "release failure";
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
        throw new Error("encoder failure");
      },
      fail: async () => {
        throw NON_ERROR_FAILURE;
      },
      release: async () => {
        releaseStarted = true;
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
      settledBeforeRelease === false &&
      fatalReason === NON_ERROR_FAILURE &&
      currentFatalReason === NON_ERROR_FAILURE,
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

  const ownedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-render-owned-"),
  );
  const outsideRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-render-outside-"),
  );
  try {
    const chunk = path.join(ownedRoot, "chunk");
    const frames = path.join(chunk, "frames");
    const direct = path.join(ownedRoot, "direct.json");
    const resident = path.join(frames, "resident.png");
    const outside = path.join(outsideRoot, "outside.png");
    fs.mkdirSync(frames, { recursive: true });
    fs.writeFileSync(direct, "direct");
    fs.writeFileSync(resident, "resident");
    fs.writeFileSync(outside, "outside");

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
    let replaced = false;
    fs.readFileSync = ((
      file: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ): unknown => {
      const bytes = Reflect.apply(nativeRead, fs, [file, ...args]) as unknown;
      if (
        replaced === false &&
        typeof file !== "number" &&
        path.resolve(file.toString()) === resident
      ) {
        replaced = true;
        fs.rmSync(resident);
        fs.renameSync(replacement, resident);
      }
      return bytes;
    }) as typeof fs.readFileSync;
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
    } finally {
      fs.readFileSync = nativeRead;
    }
  } finally {
    fs.rmSync(ownedRoot, { force: true, recursive: true });
    fs.rmSync(outsideRoot, { force: true, recursive: true });
  }
};
