import {
  digestAutoMovieSemanticMask,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import type {
  AutoMovieContentDigest,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  type IAutoMovieProductionRenderJobPlan,
  assertProductionRenderPublicationCurrent,
  canonicalAutoMovieJsonBytes,
  createAutoMovieProductionSemanticMaskReceipt,
  digestAutoMovieBytes,
  parseProductionRenderPublicationIdentity,
  probeProductionMedia,
  productionRenderPublicationIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";
import { testCaptureRuntimeIdentity } from "./productionFixtures";

const { assertProxyPublicationCandidate } = loadSourceModule<{
  assertProxyPublicationCandidate: (props: {
    bundle: string;
    expected: ReadonlyMap<string, Uint8Array>;
    plan: IAutoMovieProductionRenderJobPlan;
    receipt: Uint8Array;
  }) => unknown;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/assertProxyBundle.ts",
  ),
);

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

const resign = <T extends { fingerprint: AutoMovieContentDigest }>(
  identity: T,
): T => {
  const { fingerprint: _fingerprint, ...basis } = identity;
  return {
    ...basis,
    fingerprint: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(basis)),
  } as T;
};

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
 * 4. A semantic-mask JSON sidecar is parsed as its own media fact and a
 *    tampered palette digest is refused.
 * 5. A proxy receipt and semantic sidecar are completely validated before the
 *    immutable publisher is allowed to create its first file.
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
            const changed = resign({
              ...finalIdentity,
              tracks: { ...finalIdentity.tracks, effects: digest("9") },
            });
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
        "blankProduction",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({ ...finalIdentity, productionId: " " }),
              ),
            "blank production",
          ),
      ],
      [
        "invalidTier",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  tier: { kind: "final", resolutionScale: 0.5, frameStep: 1 },
                }),
              ),
            "tier identity is invalid",
          ),
      ],
      [
        "frameProjectionMismatch",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...proxyIdentity,
                  frameFormat: { ...proxyIdentity.frameFormat, width: 958 },
                }),
              ),
            "frame or chunk extent is invalid",
          ),
      ],
      [
        "duplicateChunk",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  chunks: [
                    ...finalIdentity.chunks,
                    { ...finalIdentity.chunks[0]!, id: digest("a") },
                  ],
                }),
              ),
            "chunk identity is malformed, duplicated",
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
      blankProduction: true,
      invalidTier: true,
      frameProjectionMismatch: true,
      duplicateChunk: true,
      missingRuntime: true,
      unknownField: true,
    },
  );

  const maskBasis: Omit<IAutoMovieSemanticMask, "digest"> = {
    version: 2,
    protocol: "automovie.semantic-mask.v2",
    background: "#000000",
    entries: [
      {
        id: "node:hero",
        kind: "node",
        label: null,
        color: "#123456",
        owner: null,
        nodes: ["hero"],
        slot: null,
      },
    ],
    unaddressed: [],
  };
  const mask: IAutoMovieSemanticMask = {
    ...maskBasis,
    digest: digestAutoMovieSemanticMask(maskBasis),
  };
  const maskBytes = Buffer.from(renderAutoMovieSemanticMaskSidecar(mask));
  TestValidator.equals(
    "semantic publication sidecars are parser-verified media facts",
    {
      probe: probeProductionMedia({
        kind: "guide-pass",
        mediaType: "application/vnd.automovie.semantic-mask+json",
        bytes: maskBytes,
      }),
      tampered: throwsError(
        () =>
          probeProductionMedia({
            kind: "guide-pass",
            mediaType: "application/vnd.automovie.semantic-mask+json",
            bytes: Buffer.from(
              renderAutoMovieSemanticMaskSidecar({
                ...mask,
                digest: digest("f"),
              }),
            ),
          }),
        "digest",
      ),
      malformed: throwsError(
        () =>
          probeProductionMedia({
            kind: "guide-pass",
            mediaType: "application/vnd.automovie.semantic-mask+json",
            bytes: Buffer.from("{not-json"),
          }),
        "strict UTF-8 JSON",
      ),
    },
    {
      probe: { kind: "semantic-mask", mask },
      tampered: true,
      malformed: true,
    },
  );

  const semanticPlan = structuredClone(proxyPlan);
  semanticPlan.totalFrames = 1;
  semanticPlan.chunkFrames = 1;
  semanticPlan.chunks = [
    {
      ...semanticPlan.chunks[0]!,
      deliverable: "mask-guide",
      kind: "guide-pass",
      pass: "mask",
      frameStart: 0,
      frameEndExclusive: 1,
      frames: [
        {
          globalFrame: 0,
          timelineFrame: 0,
          timeSeconds: 0,
          layers: [{ shot: "opening", sourceFrame: 0, weight: 1 }],
        },
      ],
    },
  ];
  const semanticIdentity = productionRenderPublicationIdentity(semanticPlan);
  const bundle = `deliverables/proxy/${semanticIdentity.fingerprint.slice(7)}`;
  const semanticPath = `${bundle}/mask-guide/frames/mask/frame_00000000.semantic.json`;
  const semanticReceipt = createAutoMovieProductionSemanticMaskReceipt({
    frame: 0,
    expectedShot: "opening",
    evidence: {
      version: 1,
      shot: "opening",
      mask,
      coverage: { unresolved: [], unaddressed: 0 },
    },
    sidecar: { path: semanticPath, bytes: maskBytes },
  });
  const proxyManifest = {
    version: 2,
    compileFingerprint: semanticPlan.compileFingerprint,
    publication: semanticIdentity,
    deliverables: [
      {
        id: "mask-guide",
        kind: "guide-pass",
        files: [
          {
            path: semanticPath,
            digest: digestAutoMovieBytes(maskBytes),
            bytes: maskBytes.byteLength,
            mediaType: "application/vnd.automovie.semantic-mask+json",
            semanticMask: semanticReceipt,
          },
        ],
        runtimeSeconds: null,
        frameCount: null,
        codec: null,
      },
    ],
  } as const;
  const proxyReceipt = {
    version: 1,
    tier: semanticPlan.tier,
    publicationFingerprint: semanticIdentity.fingerprint,
    publicationIdentity: semanticIdentity,
    compileFingerprint: semanticPlan.compileFingerprint,
    editFingerprint: semanticPlan.editFingerprint,
    frameFormat: semanticPlan.frameFormat,
    sourceFrameFormat: semanticPlan.sourceFrameFormat,
    totalFrames: semanticPlan.totalFrames,
    manifest: proxyManifest,
  };
  const proxyBytes = (value: unknown): Buffer =>
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  TestValidator.equals(
    "proxy preflight binds nested identity and semantic bytes before publish",
    namedFacts([
      [
        "currentCandidate",
        () => {
          assertProxyPublicationCandidate({
            bundle,
            expected: new Map([[semanticPath, maskBytes]]),
            plan: semanticPlan,
            receipt: proxyBytes(proxyReceipt),
          });
          return true;
        },
      ],
      [
        "topLevelProjection",
        () =>
          throwsError(
            () =>
              assertProxyPublicationCandidate({
                bundle,
                expected: new Map([[semanticPath, maskBytes]]),
                plan: semanticPlan,
                receipt: proxyBytes({
                  ...proxyReceipt,
                  frameFormat: { ...proxyReceipt.frameFormat, width: 958 },
                }),
              }),
            "invalid identity",
          ),
      ],
      [
        "missingSemanticReceipt",
        () => {
          const changed = structuredClone(proxyReceipt) as unknown as {
            manifest: {
              deliverables: Array<{
                files: Array<{ semanticMask?: unknown }>;
              }>;
            };
          };
          delete changed.manifest.deliverables[0]!.files[0]!.semanticMask;
          return throwsError(
            () =>
              assertProxyPublicationCandidate({
                bundle,
                expected: new Map([[semanticPath, maskBytes]]),
                plan: semanticPlan,
                receipt: proxyBytes(changed),
              }),
            "has no semantic receipt",
          );
        },
      ],
    ]),
    {
      currentCandidate: true,
      topLevelProjection: true,
      missingSemanticReceipt: true,
    },
  );
};
