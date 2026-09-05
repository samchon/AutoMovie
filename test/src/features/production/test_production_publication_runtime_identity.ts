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
  isPortableProductionPublicationPath,
  parseProductionRenderPublicationIdentity,
  probeProductionMedia,
  productionRenderPublicationIdentity,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";
import { productionPng } from "./productionMediaFixtures";
import { renderJobPlanFixture, repeatedDigest } from "./renderJobPlanFixtures";

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

const digest = repeatedDigest;
const plan = renderJobPlanFixture;

const resign = <T extends { fingerprint: AutoMovieContentDigest }>(
  identity: T,
): T => {
  const { fingerprint: _fingerprint, ...basis } = identity;
  return {
    ...basis,
    fingerprint: digestAutoMovieBytes(canonicalAutoMovieJsonBytes(basis)),
  } as T;
};

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
 *    publication, and so is a structurally valid identity no planner could
 *    have produced: blank production or encoder names, malformed digests, a
 *    blank capture identity field, a non-positive raster, an fps that
 *    contradicts its rational frame rate, a frame format that is not the tier
 *    projection of its source, a non-positive extent, a feature chunk on a
 *    structural pass, a duplicated slot, a broken partition, and a
 *    deliverable whose chunks stop short of the planned extent.
 * 4. A publication path has exactly one portable spelling: relative, forward
 *    slashes, normalized, with no NUL, root, drive, empty, `.`, or `..`
 *    segment.
 * 5. A semantic-mask JSON sidecar is parsed as its own media fact and a
 *    tampered palette digest or malformed bytes are refused.
 * 6. A proxy receipt, its ordinary media files, and its semantic sidecar are
 *    completely validated against the current plan before the immutable
 *    publisher is allowed to create its first file, and an inventory
 *    mismatch, escaping path, changed bytes, unknown receipt key, missing
 *    semantic receipt, or unscheduled semantic frame refuses the candidate.
 *    The receipt bytes enter through the production package's strict
 *    structured JSON ingress and manifest admission, so a duplicate member or
 *    a manifest that is not its schema is refused before any identity join,
 *    without the script owning a schema validator of its own.
 */
export const test_production_publication_runtime_identity = (): void => {
  const finalPlan = plan("final");
  const proxyPlan = plan("proxy", digest("5"));
  const finalIdentity = productionRenderPublicationIdentity(finalPlan);
  const proxyIdentity = productionRenderPublicationIdentity(proxyPlan);
  const dialogueIdentity = productionRenderPublicationIdentity(
    plan("final", digest("1"), digest("d")),
  );
  TestValidator.equals(
    "each tier preserves and validates its own exact plan generation",
    {
      final: assertProductionRenderPublicationCurrent({
        identity: finalIdentity,
        plan: finalPlan,
      }),
      proxy: parseProductionRenderPublicationIdentity(proxyIdentity),
      dialogue:
        parseProductionRenderPublicationIdentity(dialogueIdentity)
          .runtimeIdentity.dialogueRuntimeIdentity,
      distinct: finalIdentity.fingerprint !== proxyIdentity.fingerprint,
    },
    {
      final: finalIdentity,
      proxy: proxyIdentity,
      dialogue: digest("d"),
      distinct: true,
    },
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
        "blankEncoder",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  runtimeIdentity: {
                    ...finalIdentity.runtimeIdentity,
                    encoder: {
                      ...finalIdentity.runtimeIdentity.encoder,
                      version: " 1.0.12",
                    },
                  },
                }),
              ),
            "blank production or encoder package",
          ),
      ],
      [
        "malformedDigest",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  compileFingerprint: "sha256:not-a-digest",
                }),
              ),
            "malformed content digest",
          ),
      ],
      [
        "malformedDialogue",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...dialogueIdentity,
                  runtimeIdentity: {
                    ...dialogueIdentity.runtimeIdentity,
                    dialogueRuntimeIdentity: "sha256:XYZ",
                  },
                }),
              ),
            "malformed content digest",
          ),
      ],
      [
        "blankCaptureField",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  runtimeIdentity: {
                    ...finalIdentity.runtimeIdentity,
                    capture: {
                      ...finalIdentity.runtimeIdentity.capture,
                      platform: { os: " ", arch: "test" },
                    },
                  },
                }),
              ),
            "text fields must be non-blank",
          ),
      ],
      [
        "zeroRaster",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  sourceFrameFormat: {
                    ...finalIdentity.sourceFrameFormat,
                    width: 0,
                  },
                }),
              ),
            "raster is not a positive integer size",
          ),
      ],
      [
        "fpsContradiction",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  frameFormat: {
                    ...finalIdentity.frameFormat,
                    frameRate: { numerator: 25, denominator: 1 },
                  },
                }),
              ),
            "does not equal its exact 25/1 frame-rate identity",
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
            "Render tier must be exact final",
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
            "not the tier projection of its source frame format",
          ),
      ],
      [
        "zeroExtent",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({ ...finalIdentity, totalFrames: 0, chunks: [] }),
              ),
            "frame or chunk extent is invalid",
          ),
      ],
      [
        "featureOnStructuralPass",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  chunks: [{ ...finalIdentity.chunks[0]!, pass: "mask" }],
                }),
              ),
            "pairs a deliverable kind with a foreign pass",
          ),
      ],
      [
        "brokenPartition",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  chunks: [{ ...finalIdentity.chunks[0]!, frameStart: 1 }],
                }),
              ),
            "does not continue one exact partition",
          ),
      ],
      [
        "truncatedDeliverable",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  chunks: [
                    { ...finalIdentity.chunks[0]!, frameEndExclusive: 12 },
                  ],
                }),
              ),
            "chunks stop at frame 12 of 24",
          ),
      ],
      [
        "shortChunkBeforeTheEnd",
        () =>
          throwsError(
            () =>
              parseProductionRenderPublicationIdentity(
                resign({
                  ...finalIdentity,
                  chunks: [
                    { ...finalIdentity.chunks[0]!, frameEndExclusive: 6 },
                    { ...finalIdentity.chunks[1]!, frameStart: 6 },
                  ],
                }),
              ),
            "does not continue one exact partition",
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
      blankEncoder: true,
      malformedDigest: true,
      malformedDialogue: true,
      blankCaptureField: true,
      zeroRaster: true,
      fpsContradiction: true,
      invalidTier: true,
      frameProjectionMismatch: true,
      zeroExtent: true,
      featureOnStructuralPass: true,
      brokenPartition: true,
      truncatedDeliverable: true,
      shortChunkBeforeTheEnd: true,
      duplicateChunk: true,
      missingRuntime: true,
      unknownField: true,
    },
  );

  TestValidator.equals(
    "a publication path has exactly one portable spelling",
    Object.fromEntries(
      (
        [
          ["portable", "deliverables/final/0f/feature-main/feature.mp4"],
          ["empty", ""],
          ["backslash", "deliverables\\final"],
          ["nul", "deliverables/\u0000final"],
          ["rooted", "/deliverables/final"],
          ["drive", "C:/deliverables/final"],
          ["doubledSeparator", "deliverables//final"],
          ["parentSegment", "../deliverables"],
          ["currentSegment", "./deliverables"],
          ["trailingSeparator", "deliverables/"],
          ["dot", "."],
        ] as const
      ).map(([name, value]) => [
        name,
        isPortableProductionPublicationPath(value),
      ]),
    ),
    {
      portable: true,
      empty: false,
      backslash: false,
      nul: false,
      rooted: false,
      drive: false,
      doubledSeparator: false,
      parentSegment: false,
      currentSegment: false,
      trailingSeparator: false,
      dot: false,
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
  const framePath = `${bundle}/mask-guide/frames/mask/frame_00000000.png`;
  const frameBytes = productionPng(16, 16);
  const semanticReceipt = (frame: number) =>
    createAutoMovieProductionSemanticMaskReceipt({
      frame,
      expectedShot: "opening",
      evidence: {
        version: 1,
        shot: "opening",
        mask,
        coverage: { unresolved: [], unaddressed: 0 },
      },
      sidecar: { path: semanticPath, bytes: maskBytes },
    });
  const proxyManifest = (semanticFrame: number) =>
    ({
      version: 2,
      compileFingerprint: semanticPlan.compileFingerprint,
      publication: semanticIdentity,
      deliverables: [
        {
          id: "mask-guide",
          kind: "guide-pass",
          files: [
            {
              path: framePath,
              digest: digestAutoMovieBytes(frameBytes),
              bytes: frameBytes.byteLength,
              mediaType: "image/png",
            },
            {
              path: semanticPath,
              digest: digestAutoMovieBytes(maskBytes),
              bytes: maskBytes.byteLength,
              mediaType: "application/vnd.automovie.semantic-mask+json",
              semanticMask: semanticReceipt(semanticFrame),
            },
          ],
          runtimeSeconds: null,
          frameCount: null,
          codec: null,
        },
      ],
    }) as const;
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
    manifest: proxyManifest(0),
  };
  const proxyBytes = (value: unknown): Buffer =>
    Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const expected = new Map<string, Uint8Array>([
    [framePath, frameBytes],
    [semanticPath, maskBytes],
  ]);
  const candidate = (overrides: {
    expected?: ReadonlyMap<string, Uint8Array>;
    receipt?: unknown;
  }): unknown =>
    assertProxyPublicationCandidate({
      bundle,
      expected: overrides.expected ?? expected,
      plan: semanticPlan,
      receipt: proxyBytes(overrides.receipt ?? proxyReceipt),
    });
  TestValidator.equals(
    "proxy preflight binds nested identity and semantic bytes before publish",
    namedFacts([
      [
        "currentCandidate",
        () => {
          candidate({});
          return true;
        },
      ],
      [
        "topLevelProjection",
        () =>
          throwsError(
            () =>
              candidate({
                receipt: {
                  ...proxyReceipt,
                  frameFormat: { ...proxyReceipt.frameFormat, width: 958 },
                },
              }),
            "invalid identity",
          ),
      ],
      [
        "unknownReceiptKey",
        () =>
          throwsError(
            () => candidate({ receipt: { ...proxyReceipt, attemptPid: 7 } }),
            "invalid identity",
          ),
      ],
      [
        "manifestSchema",
        () =>
          throwsError(
            () =>
              candidate({
                receipt: {
                  ...proxyReceipt,
                  manifest: { ...proxyManifest(0), attemptPid: 7 },
                },
              }),
            ["Proxy publication receipt manifest is invalid", "attemptPid"],
          ),
      ],
      [
        "duplicateReceiptMember",
        () =>
          throwsError(
            () =>
              assertProxyPublicationCandidate({
                bundle,
                expected,
                plan: semanticPlan,
                receipt: Buffer.from('{"version":1,"version":1}'),
              }),
            ["proxy-publication-receipt", "duplicate member"],
          ),
      ],
      [
        "inventoryMismatch",
        () =>
          throwsError(
            () => candidate({ expected: new Map([[semanticPath, maskBytes]]) }),
            "does not match its manifest inventory",
          ),
      ],
      [
        "escapingPath",
        () =>
          throwsError(
            () =>
              candidate({
                expected: new Map([
                  [framePath, frameBytes],
                  ["deliverables/proxy/elsewhere/frame.json", maskBytes],
                ]),
              }),
            "escapes",
          ),
      ],
      [
        "changedBytes",
        () =>
          throwsError(
            () =>
              candidate({
                expected: new Map([
                  [framePath, productionPng(16, 8)],
                  [semanticPath, maskBytes],
                ]),
              }),
            "differs from its manifest",
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
          delete changed.manifest.deliverables[0]!.files[1]!.semanticMask;
          return throwsError(
            () => candidate({ receipt: changed }),
            "has no semantic receipt",
          );
        },
      ],
      [
        "unscheduledSemanticFrame",
        () =>
          throwsError(
            () =>
              candidate({
                receipt: { ...proxyReceipt, manifest: proxyManifest(1) },
              }),
            "is not bound to a current mask frame 1",
          ),
      ],
    ]),
    {
      currentCandidate: true,
      topLevelProjection: true,
      unknownReceiptKey: true,
      manifestSchema: true,
      duplicateReceiptMember: true,
      inventoryMismatch: true,
      escapingPath: true,
      changedBytes: true,
      missingSemanticReceipt: true,
      unscheduledSemanticFrame: true,
    },
  );
};
