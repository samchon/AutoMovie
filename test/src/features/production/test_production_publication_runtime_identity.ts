import type { AutoMovieContentDigest } from "@automovie/interface";
import {
  type IAutoMovieProductionRenderJobPlan,
  assertProductionRenderPublicationCurrent,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  parseProductionRenderPublicationIdentity,
  productionRenderPublicationIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import { testCaptureRuntimeIdentity } from "./productionFixtures";

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

const plan = (
  kind: "proxy" | "final",
  sourceDigest: AutoMovieContentDigest = digest("1"),
): IAutoMovieProductionRenderJobPlan => ({
  version: 4,
  productionId: "publication-film",
  compileFingerprint: digest("2"),
  editFingerprint: digest("3"),
  runtimeIdentity: {
    protocolVersion: "automovie.production-render-runtime.v3",
    sourceDigest,
    dialogueRuntimeIdentity: null,
    capture: testCaptureRuntimeIdentity(),
    encoder: {
      package: "h264-mp4-encoder",
      version: "1.0.12",
      closureDigest: digest("4"),
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
    colorSpace: "srgb",
  },
  frameFormat: {
    width: kind === "final" ? 1920 : 960,
    height: kind === "final" ? 1080 : 540,
    fps: kind === "final" ? 24 : 12,
    colorSpace: "srgb",
  },
  totalFrames: 24,
  chunkFrames: 12,
  chunks: [
    {
      slot: "feature-main/beauty/0-24",
      id: digest("8"),
      deliverable: "feature-main",
      kind: "feature",
      pass: "beauty",
      frameStart: 0,
      frameEndExclusive: 24,
      frames: [],
    },
  ],
  tracks: { captions: "WEBVTT\n", audio: [], audioAssets: [], effects: [] },
});

/**
 * Final publication provenance is a self-verifying projection of one exact
 * same-tier render plan rather than an opaque staging-directory name.
 *
 * Scenarios:
 *
 * 1. Final and proxy plans independently build, parse, and compare their own
 *    complete identity even though their tier runtime facts differ.
 * 2. A runtime-only change is stale despite equal compiler and media bytes.
 * 3. A forged digest, missing field, and unknown field are refused before
 *    publication.
 */
export const test_production_publication_runtime_identity = (): void => {
  const finalPlan = plan("final");
  const proxyPlan = plan("proxy", digest("5"));
  const finalIdentity = productionRenderPublicationIdentity(finalPlan);
  const proxyIdentity = productionRenderPublicationIdentity(proxyPlan);
  TestValidator.equals(
    "each tier preserves and validates its own exact plan generation",
    {
      final: assertProductionRenderPublicationCurrent({
        identity: finalIdentity,
        plan: finalPlan,
      }),
      proxy: parseProductionRenderPublicationIdentity(proxyIdentity),
      distinct: finalIdentity.fingerprint !== proxyIdentity.fingerprint,
    },
    { final: finalIdentity, proxy: proxyIdentity, distinct: true },
  );

  TestValidator.equals(
    "runtime drift and malformed stored identities fail closed",
    namedFacts([
      [
        "runtimeDrift",
        () =>
          throwsError(
            () =>
              assertProductionRenderPublicationCurrent({
                identity: finalIdentity,
                plan: plan("final", digest("6")),
              }),
            "does not match the current final render plan",
          ),
      ],
      [
        "chunkFrameDrift",
        () =>
          throwsError(() => {
            const changed = structuredClone(finalPlan);
            changed.chunks[0]!.frameEndExclusive = 23;
            assertProductionRenderPublicationCurrent({
              identity: finalIdentity,
              plan: changed,
            });
          }, "does not match the current final render plan"),
      ],
      [
        "effectDrift",
        () =>
          throwsError(() => {
            const { fingerprint: _fingerprint, ...basis } = finalIdentity;
            const changedBasis = {
              ...basis,
              tracks: { ...basis.tracks, effects: digest("9") },
            };
            const changed = {
              ...changedBasis,
              fingerprint: digestAutoMovieBytes(
                canonicalAutoMovieJsonBytes(changedBasis),
              ),
            };
            assertProductionRenderPublicationCurrent({
              identity: changed,
              plan: finalPlan,
            });
          }, "does not match the current final render plan"),
      ],
      [
        "forgedFingerprint",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity({
                ...finalIdentity,
                fingerprint: digest("7"),
              }),
            "does not match its canonical structured basis",
          ),
      ],
      [
        "missingRuntime",
        () =>
          throwsError(() => {
            const { runtimeIdentity: _runtimeIdentity, ...missing } =
              finalIdentity;
            parseProductionRenderPublicationIdentity(missing);
          }, "Invalid production publication identity"),
      ],
      [
        "unknownField",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity({
                ...finalIdentity,
                attemptPid: 7,
              }),
            "Invalid production publication identity",
          ),
      ],
    ]),
    {
      runtimeDrift: true,
      chunkFrameDrift: true,
      effectDrift: true,
      forgedFingerprint: true,
      missingRuntime: true,
      unknownField: true,
    },
  );
};
