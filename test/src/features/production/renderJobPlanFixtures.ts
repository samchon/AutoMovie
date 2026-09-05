import type { AutoMovieContentDigest } from "@automovie/interface";
import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";

import { testCaptureRuntimeIdentity } from "./productionFixtures";

/** A syntactically valid content digest made of one repeated hex digit. */
export const repeatedDigest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

/**
 * One complete final or proxy render job plan for a 24-frame single-chunk
 * film, with the runtime identity that publication provenance is derived from.
 */
export const renderJobPlanFixture = (
  kind: "proxy" | "final",
  sourceDigest: AutoMovieContentDigest = repeatedDigest("1"),
  dialogueRuntimeIdentity: AutoMovieContentDigest | null = null,
): IAutoMovieProductionRenderJobPlan => ({
  version: 4,
  productionId: "publication-film",
  compileFingerprint: repeatedDigest("2"),
  editFingerprint: repeatedDigest("3"),
  runtimeIdentity: {
    protocolVersion: "automovie.production-render-runtime.v3",
    sourceDigest,
    dialogueRuntimeIdentity,
    capture: testCaptureRuntimeIdentity(),
    encoder: {
      package: "h264-mp4-encoder",
      version: "1.0.12",
      closureDigest: repeatedDigest("4"),
      codec: "h264",
      arguments: {
        quantizationParameter: 26,
        speed: 10,
        groupOfPictures: 24,
      },
    },
  },
  tier: {
    kind,
    resolutionScale: kind === "final" ? 1 : 0.5,
    frameStep: kind === "final" ? 1 : 2,
  },
  sourceFrameFormat: {
    width: 1920,
    height: 1080,
    fps: 24,
    frameRate: { numerator: 24, denominator: 1 },
    colorSpace: "srgb",
  },
  frameFormat: {
    width: kind === "final" ? 1920 : 960,
    height: kind === "final" ? 1080 : 540,
    fps: kind === "final" ? 24 : 12,
    frameRate: { numerator: kind === "final" ? 24 : 12, denominator: 1 },
    colorSpace: "srgb",
  },
  totalFrames: 24,
  chunkFrames: 12,
  chunks: [
    {
      slot: "feature-main/beauty/0-12",
      id: repeatedDigest("8"),
      deliverable: "feature-main",
      kind: "feature",
      pass: "beauty",
      frameStart: 0,
      frameEndExclusive: 12,
      frames: [],
    },
    {
      slot: "feature-main/beauty/12-24",
      id: repeatedDigest("9"),
      deliverable: "feature-main",
      kind: "feature",
      pass: "beauty",
      frameStart: 12,
      frameEndExclusive: 24,
      frames: [],
    },
  ],
  tracks: { captions: "WEBVTT\n", audio: [], audioAssets: [], effects: [] },
});
