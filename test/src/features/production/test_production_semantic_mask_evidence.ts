import {
  digestAutoMovieSemanticMask,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import {
  AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
  IAutoMovieProductionRenderChunk,
  IAutoMovieProductionRenderChunkReceipt,
  IAutoMovieProductionRenderJobPlan,
  IAutoMovieProductionSemanticMaskEvidence,
  IAutoMovieProductionSemanticMaskReceipt,
  assertAutoMovieProductionDeliverableSemanticMask,
  classifyAutoMovieProductionDeliverableSemanticMask,
  classifyAutoMovieProductionSemanticMaskEvidence,
  createAutoMovieProductionSemanticMaskReceipt,
  probeProductionMedia,
  productionRenderChunkStatuses,
  productionRenderPlanOwnsSemanticMaskReceipt,
  verifyAutoMovieProductionSemanticMaskEvidence,
  verifyAutoMovieProductionSemanticMaskReceipt,
  verifyProductionRenderChunkReceipt,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { throwsError } from "../internal/predicates";
import { productionPng, productionWebVtt } from "./productionMediaFixtures";

/**
 * Semantic palette, runtime coverage, and resident sidecar bytes form one
 * current receipt rather than three independently trusted facts.
 *
 * Scenarios:
 *
 * 1. A valid current palette with exact shot and zero runtime gaps classifies
 *    complete and round-trips through a content-addressed receipt.
 * 2. Unresolved ids and unnamed meshes remain distinct incomplete causes.
 * 3. Not-run, unsupported, foreign, malformed, and tampered observations keep
 *    distinct statuses and messages.
 * 4. Evidence refuses non-exact keys, blank or unsorted ids, duplicate ids, and
 *    negative, fractional, or unsafe unnamed-mesh counts.
 * 5. Receipt creation refuses foreign-shot evidence, a malformed frame,
 *    escaping path, or bytes that do not equal the canonical current sidecar.
 * 6. Reopening refuses historical schema, foreign frame/pass/shot/path,
 *    changed resident bytes, and stale semantic digest or coverage.
 * 7. Repeating the same shot and palette at another frame yields a separate
 *    frame record while retaining the same semantic and sidecar digests.
 * 8. A delivered ledger file classifies as plain media, a current semantic
 *    sidecar, an unreceipted sidecar, a receipt unbound by owner kind, bytes,
 *    path, frame, shot, deliverable, or pass, a stale reopen, or incomplete
 *    runtime coverage, and the assert form throws only for the refusals.
 */
export const test_production_semantic_mask_evidence = (): void => {
  const evidence = validEvidence();
  const sidecarBytes = bytes(renderAutoMovieSemanticMaskSidecar(evidence.mask));
  const observation = { status: "available", value: evidence } as const;
  const complete = classifyAutoMovieProductionSemanticMaskEvidence({
    observation,
    expectedShot: "opening",
  });
  const receipt = createAutoMovieProductionSemanticMaskReceipt({
    frame: 0,
    expectedShot: "opening",
    evidence,
    sidecar: { path: "semantic/opening.mask.json", bytes: sidecarBytes },
  });
  TestValidator.equals(
    "current zero-gap evidence is complete and receipt-bound",
    {
      status: complete.status,
      verified: verifyAutoMovieProductionSemanticMaskReceipt({
        receipt,
        expectedFrame: 0,
        expectedShot: "opening",
        evidence,
        resident: {
          path: "semantic/opening.mask.json",
          bytes: sidecarBytes,
        },
      }),
      receipt,
    },
    {
      status: "complete",
      verified: undefined,
      receipt: {
        version: 1,
        frame: 0,
        pass: "mask",
        shot: "opening",
        sidecar: {
          path: "semantic/opening.mask.json",
          digest: `sha256:${createHash("sha256")
            .update(sidecarBytes)
            .digest("hex")}`,
          bytes: sidecarBytes.byteLength,
        },
        semanticDigest: evidence.mask.digest,
        coverage: { unresolved: [], unaddressed: 0 },
      },
    },
  );

  const unresolved = withCoverage(evidence, {
    unresolved: ["node:missing"],
    unaddressed: 0,
  });
  const unnamed = withCoverage(evidence, {
    unresolved: [],
    unaddressed: 2,
  });
  TestValidator.equals(
    "the two runtime gap directions remain separate incomplete facts",
    [unresolved, unnamed].map((value) => {
      const result = classifyAutoMovieProductionSemanticMaskEvidence({
        observation: { status: "available", value },
        expectedShot: "opening",
      });
      return {
        status: result.status,
        reason: "reason" in result ? result.reason : null,
        coverage: "evidence" in result ? result.evidence.coverage : null,
      };
    }),
    [
      {
        status: "incomplete",
        reason:
          'semantic mask for shot "opening" has 1 unresolved ids and 0 unaddressed meshes',
        coverage: { unresolved: ["node:missing"], unaddressed: 0 },
      },
      {
        status: "incomplete",
        reason:
          'semantic mask for shot "opening" has 0 unresolved ids and 2 unaddressed meshes',
        coverage: { unresolved: [], unaddressed: 2 },
      },
    ],
  );

  const historicalMask = {
    ...evidence.mask,
    version: 1,
    protocol: "automovie.semantic-mask.v1",
  } as unknown as IAutoMovieSemanticMask;
  const classifications = {
    notRun: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: { status: "not-run", reason: "host lacked mask hook" },
      expectedShot: "opening",
    }),
    blankNotRun: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: { status: "not-run", reason: "  " },
      expectedShot: "opening",
    }),
    unsupported: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: {
        status: "available",
        value: { ...evidence, mask: historicalMask },
      },
      expectedShot: "opening",
    }),
    unsupportedEnvelope: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: {
        status: "available",
        value: { ...evidence, version: 2 } as never,
      },
      expectedShot: "opening",
    }),
    invalidCoverage: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: {
        status: "available",
        value: withCoverage(evidence, {
          unresolved: ["node:z", "node:a"],
          unaddressed: 0,
        }),
      },
      expectedShot: "opening",
    }),
    foreign: classifyAutoMovieProductionSemanticMaskEvidence({
      observation,
      expectedShot: "closing",
    }),
    blankShot: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: {
        status: "available",
        value: { ...evidence, shot: " " },
      },
      expectedShot: "opening",
    }),
    invalid: classifyAutoMovieProductionSemanticMaskEvidence({
      observation: {
        status: "available",
        value: {
          ...evidence,
          mask: { ...evidence.mask, digest: `sha256:${"0".repeat(64)}` },
        },
      },
      expectedShot: "opening",
    }),
  };
  TestValidator.equals(
    "absence and each incompatible evidence class retain their own status",
    Object.fromEntries(
      Object.entries(classifications).map(([name, result]) => [
        name,
        result.status,
      ]),
    ),
    {
      notRun: "not-run",
      blankNotRun: "invalid",
      unsupported: "unsupported",
      unsupportedEnvelope: "unsupported",
      invalidCoverage: "invalid",
      foreign: "foreign",
      blankShot: "invalid",
      invalid: "invalid",
    },
  );

  const malformedEvidence: Array<
    readonly [string, IAutoMovieProductionSemanticMaskEvidence, string]
  > = [
    [
      "extra key",
      { ...evidence, extra: true } as IAutoMovieProductionSemanticMaskEvidence,
      "evidence keys",
    ],
    [
      "same-count wrong key",
      renameKey(evidence, "shot", "take"),
      "evidence keys",
    ],
    ["historical envelope", { ...evidence, version: 2 } as never, "version 2"],
    ["blank shot", { ...evidence, shot: " " }, "non-blank id"],
    [
      "extra coverage key",
      withCoverage(evidence, {
        unresolved: [],
        unaddressed: 0,
        extra: true,
      } as never),
      "coverage keys",
    ],
    [
      "blank unresolved id",
      withCoverage(evidence, { unresolved: [" "], unaddressed: 0 }),
      "sorted unique ids",
    ],
    [
      "unsorted unresolved ids",
      withCoverage(evidence, {
        unresolved: ["node:z", "node:a"],
        unaddressed: 0,
      }),
      "sorted unique ids",
    ],
    [
      "duplicate unresolved ids",
      withCoverage(evidence, {
        unresolved: ["node:a", "node:a"],
        unaddressed: 0,
      }),
      "sorted unique ids",
    ],
    [
      "negative count",
      withCoverage(evidence, { unresolved: [], unaddressed: -1 }),
      "non-negative safe integer",
    ],
    [
      "fractional count",
      withCoverage(evidence, { unresolved: [], unaddressed: 0.5 }),
      "non-negative safe integer",
    ],
    [
      "unsafe count",
      withCoverage(evidence, {
        unresolved: [],
        unaddressed: Number.MAX_SAFE_INTEGER + 1,
      }),
      "non-negative safe integer",
    ],
  ];
  TestValidator.equals(
    "malformed evidence is refused at its exact structural boundary",
    Object.fromEntries(
      malformedEvidence.map(([name, value, message]) => [
        name,
        throwsError(
          () =>
            verifyAutoMovieProductionSemanticMaskEvidence({
              evidence: value,
              expectedShot: "opening",
            }),
          message,
        ),
      ]),
    ),
    Object.fromEntries(malformedEvidence.map(([name]) => [name, true])),
  );

  const invalidPaths = [
    ["blank", ""],
    ["backslash", "semantic\\mask.json"],
    ["rooted", "/semantic/mask.json"],
    ["drive", "C:/semantic/mask.json"],
    ["empty segment", "semantic//mask.json"],
    ["dot segment", "semantic/./mask.json"],
    ["parent segment", "semantic/../mask.json"],
  ] as const;
  TestValidator.equals(
    "receipt creation refuses foreign evidence, malformed frame, path, and sidecar bytes",
    {
      negativeFrame: throwsError(
        () => createReceipt({ frame: -1, evidence, sidecarBytes }),
        "non-negative safe integer",
      ),
      fractionalFrame: throwsError(
        () => createReceipt({ frame: 0.5, evidence, sidecarBytes }),
        "non-negative safe integer",
      ),
      unsafeFrame: throwsError(
        () =>
          createReceipt({
            frame: Number.MAX_SAFE_INTEGER + 1,
            evidence,
            sidecarBytes,
          }),
        "non-negative safe integer",
      ),
      invalidPaths: Object.fromEntries(
        invalidPaths.map(([name, path]) => [
          name,
          throwsError(
            () => createReceipt({ evidence, sidecarBytes, path }),
            "portable relative path",
          ),
        ]),
      ),
      wrongBytes: throwsError(
        () => createReceipt({ evidence, sidecarBytes: bytes("{}\n") }),
        "do not match its canonical palette",
      ),
      foreignEvidence: throwsError(
        () =>
          createReceipt({
            evidence: { ...evidence, shot: "closing" },
            expectedShot: "opening",
            sidecarBytes,
          }),
        'foreign semantic evidence for shot "closing"; expected "opening"',
      ),
    },
    {
      negativeFrame: true,
      fractionalFrame: true,
      unsafeFrame: true,
      invalidPaths: Object.fromEntries(
        invalidPaths.map(([name]) => [name, true]),
      ),
      wrongBytes: true,
      foreignEvidence: true,
    },
  );

  const changedMask = seal({
    ...payload(evidence.mask),
    entries: [
      { ...evidence.mask.entries[0]!, owner: "space:elsewhere" },
      ...evidence.mask.entries.slice(1),
    ],
  });
  const reopenCases: Array<readonly [string, () => void, string]> = [
    [
      "extra receipt key",
      () => reopen({ receipt: { ...receipt, extra: true } as never }),
      "receipt keys",
    ],
    [
      "renamed receipt key",
      () => reopen({ receipt: renameKey(receipt, "shot", "take") }),
      "receipt keys",
    ],
    [
      "extra sidecar key",
      () =>
        reopen({
          receipt: {
            ...receipt,
            sidecar: { ...receipt.sidecar, extra: true },
          } as never,
        }),
      "sidecar keys",
    ],
    [
      "extra receipt coverage key",
      () =>
        reopen({
          receipt: {
            ...receipt,
            coverage: { ...receipt.coverage, extra: true },
          } as never,
        }),
      "coverage keys",
    ],
    [
      "historical receipt",
      () => reopen({ receipt: { ...receipt, version: 2 } as never }),
      "receipt version 2",
    ],
    [
      "escaping receipt path",
      () =>
        reopen({
          receipt: {
            ...receipt,
            sidecar: { ...receipt.sidecar, path: "../opening.mask.json" },
          },
        }),
      "portable relative path",
    ],
    [
      "foreign frame",
      () => reopen({ receipt: { ...receipt, frame: 1 } }),
      "stale semantic receipt frame",
    ],
    [
      "foreign pass",
      () => reopen({ receipt: { ...receipt, pass: "beauty" } as never }),
      "stale semantic receipt frame",
    ],
    [
      "foreign shot",
      () => reopen({ receipt: { ...receipt, shot: "closing" } }),
      "foreign semantic receipt",
    ],
    [
      "foreign resident path",
      () => reopen({ residentPath: "semantic/other.mask.json" }),
      "foreign semantic sidecar path",
    ],
    [
      "tampered resident bytes",
      () => reopen({ residentBytes: bytes("{}\n") }),
      "do not match its canonical palette",
    ],
    [
      "stale byte digest",
      () =>
        reopen({
          receipt: {
            ...receipt,
            sidecar: {
              ...receipt.sidecar,
              digest: `sha256:${"3".repeat(64)}`,
            },
          },
        }),
      "tampered semantic sidecar",
    ],
    [
      "stale byte count",
      () =>
        reopen({
          receipt: {
            ...receipt,
            sidecar: { ...receipt.sidecar, bytes: receipt.sidecar.bytes + 1 },
          },
        }),
      "tampered semantic sidecar",
    ],
    [
      "stale semantic digest",
      () =>
        reopen({
          receipt: {
            ...receipt,
            semanticDigest: `sha256:${"4".repeat(64)}`,
          },
        }),
      "stale semantic payload",
    ],
    [
      "stale unnamed count",
      () =>
        reopen({
          receipt: {
            ...receipt,
            coverage: { unresolved: [], unaddressed: 1 },
          },
        }),
      "stale semantic payload",
    ],
    [
      "stale unresolved length",
      () =>
        reopen({
          receipt: {
            ...receipt,
            coverage: { unresolved: ["node:missing"], unaddressed: 0 },
          },
        }),
      "stale semantic payload",
    ],
    [
      "stale unresolved id",
      () =>
        reopen({
          receipt: {
            ...receipt,
            coverage: { unresolved: ["node:b"], unaddressed: 0 },
          },
          evidence: withCoverage(evidence, {
            unresolved: ["node:a"],
            unaddressed: 0,
          }),
        }),
      "stale semantic payload",
    ],
    [
      "foreign evidence palette",
      () => reopen({ evidence: { ...evidence, mask: changedMask } }),
      "do not match its canonical palette",
    ],
  ];
  TestValidator.equals(
    "receipt reopening refuses every stale or foreign dependency",
    Object.fromEntries(
      reopenCases.map(([name, attempt, message]) => [
        name,
        throwsError(attempt, message),
      ]),
    ),
    Object.fromEntries(reopenCases.map(([name]) => [name, true])),
  );

  const later = createReceipt({ frame: 12, evidence, sidecarBytes });
  TestValidator.equals(
    "repeated semantic evidence stays content-identical but frame-specific",
    {
      frameMoved: later.frame !== receipt.frame,
      semanticHeld: later.semanticDigest === receipt.semanticDigest,
      sidecarHeld: later.sidecar.digest === receipt.sidecar.digest,
    },
    { frameMoved: true, semanticHeld: true, sidecarHeld: true },
  );

  const chunk = {
    slot: "mask/00000000-00000001",
    id: digest("a"),
    deliverable: "semantic-guide",
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
  } satisfies IAutoMovieProductionRenderChunk;
  const plan = {
    frameFormat: { width: 16, height: 16, fps: 24 },
    chunks: [chunk],
  } as unknown as IAutoMovieProductionRenderJobPlan;
  const chunkReceipt = {
    version: 2,
    slot: chunk.slot,
    chunk: chunk.id,
    frames: [
      {
        globalFrame: 0,
        path: "frame_00000000.mask.png",
        digest: digest("b"),
        bytes: 1,
        width: 16,
        height: 16,
      },
    ],
    semanticMasks: [receipt],
    encoded: { path: "chunk.mp4", digest: digest("c"), bytes: 1 },
  } satisfies IAutoMovieProductionRenderChunkReceipt;
  TestValidator.equals(
    "chunk completion requires one complete semantic receipt per mask layer",
    {
      verified: verifyProductionRenderChunkReceipt({
        plan,
        chunk,
        receipt: chunkReceipt,
      }),
      status: productionRenderChunkStatuses({
        plan,
        receipts: [chunkReceipt],
        attempts: [],
      })[0]!.status,
      historical: productionRenderChunkStatuses({
        plan,
        receipts: [{ ...chunkReceipt, version: 1 } as never],
        attempts: [],
      })[0]!.status,
      missing: productionRenderChunkStatuses({
        plan,
        receipts: [{ ...chunkReceipt, semanticMasks: [] }],
        attempts: [],
      })[0]!.status,
      incomplete: productionRenderChunkStatuses({
        plan,
        receipts: [
          {
            ...chunkReceipt,
            semanticMasks: [
              {
                ...receipt,
                coverage: { unresolved: ["node:missing"], unaddressed: 0 },
              },
            ],
          },
        ],
        attempts: [],
      })[0]!.status,
      orderedGaps: productionRenderChunkStatuses({
        plan,
        receipts: [
          {
            ...chunkReceipt,
            semanticMasks: [
              {
                ...receipt,
                coverage: {
                  unresolved: ["node:first", "node:second"],
                  unaddressed: 0,
                },
              },
            ],
          },
        ],
        attempts: [],
      })[0]!.status,
    },
    {
      verified: undefined,
      status: "complete",
      historical: "failed",
      missing: "failed",
      incomplete: "failed",
      orderedGaps: "failed",
    },
  );

  const sidecarPath =
    "deliverables/final/0f/semantic-guide/frames/mask/frame_00000000.semantic.json";
  const delivered = createReceipt({
    evidence,
    sidecarBytes,
    path: sidecarPath,
  });
  const sidecarProbe = probeProductionMedia({
    kind: "guide-pass",
    mediaType: AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
    bytes: sidecarBytes,
  });
  const png = productionPng(16, 16);
  const pngProbe = probeProductionMedia({
    kind: "guide-pass",
    mediaType: "image/png",
    bytes: png,
  });
  const vtt = productionWebVtt();
  const vttProbe = probeProductionMedia({
    kind: "captions",
    mediaType: "text/vtt",
    bytes: vtt,
  });
  const guide = { id: "semantic-guide", kind: "guide-pass" } as const;
  const classify = (
    overrides: Partial<
      Parameters<typeof classifyAutoMovieProductionDeliverableSemanticMask>[0]
    >,
  ) =>
    classifyAutoMovieProductionDeliverableSemanticMask({
      deliverable: guide,
      file: { path: sidecarPath, semanticMask: delivered },
      probe: sidecarProbe,
      bytes: sidecarBytes,
      plan,
      ...overrides,
    });
  const reasonOf = (
    finding: ReturnType<
      typeof classifyAutoMovieProductionDeliverableSemanticMask
    >,
  ): string => ("reason" in finding ? finding.reason : finding.status);
  const paddedBytes = bytes(
    `${renderAutoMovieSemanticMaskSidecar(evidence.mask)}\n`,
  );
  const beautyPlan = {
    ...plan,
    chunks: [{ ...chunk, kind: "feature", pass: "beauty" }],
  } as unknown as IAutoMovieProductionRenderJobPlan;
  const deliverableFindings = {
    media: classify({
      file: {
        path: "deliverables/final/0f/semantic-guide/frames/mask/frame_00000000.png",
      },
      probe: pngProbe,
      bytes: png,
    }),
    current: classify({}),
    unreceipted: classify({ file: { path: sidecarPath } }),
    captionsOwner: classify({
      deliverable: { id: "subtitles", kind: "captions" },
      file: {
        path: "deliverables/final/0f/subtitles/captions.vtt",
        semanticMask: delivered,
      },
      probe: vttProbe,
      bytes: vtt,
    }),
    pngBytes: classify({ probe: pngProbe, bytes: png }),
    pathMismatch: classify({
      file: { path: `${sidecarPath}.moved`, semanticMask: delivered },
    }),
    foreignFrame: classify({
      file: {
        path: sidecarPath,
        semanticMask: createReceipt({
          frame: 1,
          evidence,
          sidecarBytes,
          path: sidecarPath,
        }),
      },
    }),
    foreignShot: classify({
      file: {
        path: sidecarPath,
        semanticMask: createReceipt({
          evidence: { ...evidence, shot: "closing" },
          expectedShot: "closing",
          sidecarBytes,
          path: sidecarPath,
        }),
      },
    }),
    foreignDeliverable: classify({
      deliverable: { id: "other-guide", kind: "guide-pass" },
    }),
    beautyPlan: classify({ plan: beautyPlan }),
    stale: classify({
      probe: probeProductionMedia({
        kind: "guide-pass",
        mediaType: AUTOMOVIE_SEMANTIC_MASK_MEDIA_TYPE,
        bytes: paddedBytes,
      }),
      bytes: paddedBytes,
    }),
    incomplete: classify({
      file: {
        path: sidecarPath,
        semanticMask: createReceipt({
          evidence: withCoverage(evidence, {
            unresolved: ["node:missing"],
            unaddressed: 0,
          }),
          sidecarBytes,
          path: sidecarPath,
        }),
      },
    }),
  };
  TestValidator.equals(
    "a delivered ledger file is classified from its receipt, bytes, and plan",
    {
      findings: Object.fromEntries(
        Object.entries(deliverableFindings).map(([name, finding]) => [
          name,
          reasonOf(finding),
        ]),
      ),
      currentReceipt:
        deliverableFindings.current.status === "semantic-mask"
          ? deliverableFindings.current.receipt
          : null,
      owned: productionRenderPlanOwnsSemanticMaskReceipt({
        plan,
        deliverable: "semantic-guide",
        receipt: delivered,
      }),
      asserted: {
        media: assertAutoMovieProductionDeliverableSemanticMask({
          deliverable: guide,
          file: {
            path: "deliverables/final/0f/semantic-guide/frames/mask/frame_00000000.png",
          },
          probe: pngProbe,
          bytes: png,
          plan,
        }),
        current: assertAutoMovieProductionDeliverableSemanticMask({
          deliverable: guide,
          file: { path: sidecarPath, semanticMask: delivered },
          probe: sidecarProbe,
          bytes: sidecarBytes,
          plan,
        }),
        unreceipted: throwsError(
          () =>
            assertAutoMovieProductionDeliverableSemanticMask({
              deliverable: guide,
              file: { path: sidecarPath },
              probe: sidecarProbe,
              bytes: sidecarBytes,
              plan,
            }),
          `Semantic sidecar "${sidecarPath}" has no semantic receipt`,
        ),
      },
    },
    {
      findings: {
        media: "media",
        current: "semantic-mask",
        unreceipted: `Semantic sidecar "${sidecarPath}" has no semantic receipt in its deliverable ledger.`,
        captionsOwner:
          'Semantic receipt on "deliverables/final/0f/subtitles/captions.vtt" belongs to captions deliverable "subtitles"; only a guide-pass deliverable owns mask sidecars.',
        pngBytes: `Semantic receipt on "${sidecarPath}" describes bytes that are not a semantic-mask sidecar.`,
        pathMismatch: `Semantic receipt on "${sidecarPath}.moved" names sidecar path "${sidecarPath}".`,
        foreignFrame: `Semantic sidecar "${sidecarPath}" is not bound to a current mask frame 1 of shot "opening" in guide deliverable "semantic-guide".`,
        foreignShot: `Semantic sidecar "${sidecarPath}" is not bound to a current mask frame 0 of shot "closing" in guide deliverable "semantic-guide".`,
        foreignDeliverable: `Semantic sidecar "${sidecarPath}" is not bound to a current mask frame 0 of shot "opening" in guide deliverable "other-guide".`,
        beautyPlan: `Semantic sidecar "${sidecarPath}" is not bound to a current mask frame 0 of shot "opening" in guide deliverable "semantic-guide".`,
        stale:
          'semantic sidecar bytes for shot "opening" do not match its canonical palette',
        incomplete: `Semantic sidecar "${sidecarPath}" records 1 unresolved ids and 0 unaddressed meshes for shot "opening"; a delivered mask product requires complete runtime coverage.`,
      },
      currentReceipt: delivered,
      owned: true,
      asserted: { media: undefined, current: undefined, unreceipted: true },
    },
  );

  function reopen(overrides: {
    receipt?: IAutoMovieProductionSemanticMaskReceipt;
    evidence?: IAutoMovieProductionSemanticMaskEvidence;
    residentPath?: string;
    residentBytes?: Uint8Array;
  }): void {
    verifyAutoMovieProductionSemanticMaskReceipt({
      receipt: overrides.receipt ?? receipt,
      expectedFrame: 0,
      expectedShot: "opening",
      evidence: overrides.evidence ?? evidence,
      resident: {
        path: overrides.residentPath ?? "semantic/opening.mask.json",
        bytes: overrides.residentBytes ?? sidecarBytes,
      },
    });
  }
};

/** One valid current palette and zero-gap runtime observation. */
const validEvidence = (): IAutoMovieProductionSemanticMaskEvidence => ({
  version: 1,
  shot: "opening",
  mask: seal({
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
  } as unknown as Omit<IAutoMovieSemanticMask, "digest">),
  coverage: { unresolved: [], unaddressed: 0 },
});

/** Copy evidence with an exact replacement runtime-coverage observation. */
const withCoverage = (
  evidence: IAutoMovieProductionSemanticMaskEvidence,
  coverage: IAutoMovieProductionSemanticMaskEvidence["coverage"],
): IAutoMovieProductionSemanticMaskEvidence => ({ ...evidence, coverage });

/** Create one receipt with concise defaults for refusal cases. */
const createReceipt = (props: {
  evidence: IAutoMovieProductionSemanticMaskEvidence;
  sidecarBytes: Uint8Array;
  expectedShot?: string;
  frame?: number;
  path?: string;
}): IAutoMovieProductionSemanticMaskReceipt =>
  createAutoMovieProductionSemanticMaskReceipt({
    frame: props.frame ?? 0,
    expectedShot: props.expectedShot ?? "opening",
    evidence: props.evidence,
    sidecar: {
      path: props.path ?? "semantic/opening.mask.json",
      bytes: props.sidecarBytes,
    },
  });

/** Seal one semantic payload with the engine's public canonical digest. */
const seal = (
  value: Omit<IAutoMovieSemanticMask, "digest">,
): IAutoMovieSemanticMask => ({
  ...value,
  digest: digestAutoMovieSemanticMask(value),
});

/** Extract a mask payload without its self-declared digest. */
const payload = (
  mask: IAutoMovieSemanticMask,
): Omit<IAutoMovieSemanticMask, "digest"> => ({
  version: mask.version,
  protocol: mask.protocol,
  background: mask.background,
  entries: mask.entries,
  unaddressed: mask.unaddressed,
});

/** Rename one key without changing key count, for exact-record refusal. */
const renameKey = <T extends object>(
  value: T,
  removed: string,
  added: string,
): T => {
  const record = { ...value } as Record<string, unknown>;
  record[added] = record[removed];
  delete record[removed];
  return record as T;
};

/** Exact UTF-8 bytes used by production sidecar files. */
const bytes = (value: string): Uint8Array => Buffer.from(value, "utf8");

const digest = (fill: string): AutoMovieContentDigest =>
  `sha256:${fill.repeat(64).slice(0, 64)}`;
