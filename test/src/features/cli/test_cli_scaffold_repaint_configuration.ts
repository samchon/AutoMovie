import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

interface IRepaintRequest {
  shot: string;
  parameters: IAutoMovieRepaintReceipt["parameters"];
  references: Array<{
    role: IAutoMovieRepaintReceipt["references"][number]["role"];
    path: string;
  }>;
  evidence: NonNullable<IAutoMovieRepaintReceipt["evidence"]>;
  selectionReview: {
    candidateAttemptId: string;
    candidateOutputDigest: string;
    reason: string;
    structuralReview: string;
    continuityReview: {
      baseline: string;
      playbackEvidence: string;
      mixedDeliveryPolicy: string | null;
      flicker: "pass";
      identityDrift: "pass";
      geometryWarp: "pass";
      textureCrawl: "pass";
      transitionMismatch: "pass";
    } | null;
  } | null;
}

interface IRepaintSelection {
  generator: IAutoMovieRepaintGeneratorAdoption;
  executionPolicy: NonNullable<IAutoMovieRepaintReceipt["executionPolicy"]>;
  requests: IRepaintRequest[];
}

interface IConfigurationModule {
  readProductionDialogueSynthesis: (
    selected: unknown,
    occurredAt?: Date | string,
  ) => unknown;
  readProductionRepaintSelection: (
    selected: unknown,
    occurredAt?: Date | string,
  ) => IRepaintSelection | null;
  assertProductionRepaintSelection: (props: {
    selected: unknown;
    visualDelivery: "deterministic" | "repainted";
    continuity: "film" | "inapplicable";
    shots: readonly string[];
  }) => IRepaintSelection | null;
  selectProductionRepaintRequest: (
    selected: unknown,
    shot: unknown,
    occurredAt?: Date | string,
  ) => {
    generator: IAutoMovieRepaintGeneratorAdoption;
    executionPolicy: IRepaintSelection["executionPolicy"];
    request: IRepaintRequest;
  };
  readProductionRepaintCommand: (
    args: readonly string[],
  ) =>
    | { kind: "reroll"; shot: string }
    | { kind: "retry"; shot: string; requestId: string }
    | { kind: "selection"; shot: string; attemptId: string }
    | { kind: "reversal"; shot: string; attemptId: string };
  assertProductionRepaintCandidateAdoption: (props: {
    selected: IRepaintSelection;
    receipt: IAutoMovieRepaintReceipt;
  }) => void;
  selectProductionRepaintCandidateReview: (props: {
    request: IRepaintRequest;
    receipt: IAutoMovieRepaintReceipt;
  }) => {
    reason: string;
    structuralReview: string;
    continuityReview: NonNullable<
      IRepaintRequest["selectionReview"]
    >["continuityReview"];
  };
  assertProductionRepaintReceiptAdoption: (props: {
    selected: IRepaintSelection;
    receipts: readonly IAutoMovieRepaintReceipt[];
  }) => void;
}

const digest = (value: string): AutoMovieContentDigest => `sha256:${value}`;
const outputDigest = (shot: "opening" | "answer"): AutoMovieContentDigest =>
  `sha256:${(shot === "opening" ? "a" : "b").repeat(64)}`;
const OCCURRED_AT = "2026-08-28T23:59:59.999Z";

const selection = (): IRepaintSelection => ({
  generator: {
    runtimeIdentity: {
      protocolVersion: "automovie.repaint-runtime.v1",
      provider: "reviewed-local-host",
      model: "studio/repaint-model",
      version: "sha256:model-revision",
      execution: "local",
    },
    generatorProvenance: {
      source: "https://models.example/studio/repaint-model",
      license: "license-records/repaint-model.md",
      termsCheckedAt: "2026-08-28",
      cost: "local compute; no per-request provider fee",
      consumer: {
        kind: "repaint",
        reason: "the reviewed final delivery requires appearance rendition",
      },
    },
  },
  executionPolicy: {
    maximumAttempts: 2,
    attemptTimeoutMs: 500,
    maximumElapsedMs: 2_000,
    maximumCostUnits: 4,
    backoffMs: [25],
    retryableFailures: ["timeout", "rate-limit", "transport"],
  },
  requests: [
    {
      shot: "opening",
      parameters: {
        prompt: "quiet limestone lobby under the reviewed warm light",
        negativePrompt: "unowned subject, changed geometry",
        seed: 17,
        strength: 0.35,
        controls: {
          scheduler: "fixed",
          guidance: 7.5,
          preservePalette: true,
        },
      },
      references: [
        { role: "structure", path: "assets/references/shared.png" },
        { role: "character", path: "assets/references/shared.png" },
        { role: "costume", path: "assets/references/costume.png" },
        { role: "style", path: "assets/references/style.png" },
        { role: "material", path: "assets/references/material.png" },
        { role: "color", path: "assets/references/color.png" },
        { role: "environment", path: "assets/references/environment.png" },
      ],
      evidence: {
        prompt: "settings/visual.md#opening-prompt",
        continuity: "settings/continuity.md#baseline-v3",
        settings: "settings/visual.md#shared-grammar",
        design: "models/guide.md#appearance",
        screenplayOrBrief: "screenplays/opening.md#arrival",
        shot: "src/shots/opening.ts#opening",
      },
      selectionReview: {
        candidateAttemptId: "33333333-3333-4333-8333-333333333333",
        candidateOutputDigest: outputDigest("opening"),
        reason: "Candidate preserves the reviewed opening appearance.",
        structuralReview: "Depth and outline stay aligned at every frame.",
        continuityReview: {
          baseline: "settings/continuity.md#baseline-v3",
          playbackEvidence: "Played the complete opening at delivery rate.",
          mixedDeliveryPolicy: null,
          flicker: "pass",
          identityDrift: "pass",
          geometryWarp: "pass",
          textureCrawl: "pass",
          transitionMismatch: "pass",
        },
      },
    },
    {
      shot: "answer",
      parameters: {
        prompt: "the same reviewed lobby finish from the reverse angle",
        seed: 18,
        strength: 0,
      },
      references: [
        { role: "style", path: "assets/references/lobby-style.png" },
      ],
      evidence: {
        prompt: "settings/visual.md#answer-prompt",
        continuity: "settings/continuity.md#baseline-v3",
        settings: "settings/visual.md#shared-grammar",
        design: "spaces/lobby.md#appearance",
        screenplayOrBrief: "screenplays/opening.md#answer",
        shot: "src/shots/answer.ts#answer",
      },
      selectionReview: {
        candidateAttemptId: "44444444-4444-4444-8444-444444444444",
        candidateOutputDigest: outputDigest("answer"),
        reason: "Candidate preserves the reviewed reverse-angle appearance.",
        structuralReview: "Depth and outline stay aligned at every frame.",
        continuityReview: {
          baseline: "settings/continuity.md#baseline-v3",
          playbackEvidence: "Played the complete answer at delivery rate.",
          mixedDeliveryPolicy: "Both shots use the selected repaint lane.",
          flicker: "pass",
          identityDrift: "pass",
          geometryWarp: "pass",
          textureCrawl: "pass",
          transitionMismatch: "pass",
        },
      },
    },
  ],
});

const messageOf = (operation: () => unknown): string | null => {
  try {
    operation();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const receipt = (
  selected: IRepaintSelection,
  shot: string,
): IAutoMovieRepaintReceipt => {
  const request = selected.requests.find(
    (candidate) => candidate.shot === shot,
  );
  if (request === undefined) throw new Error(`Missing test request ${shot}.`);
  return {
    version: 4,
    productionId: "repaint-config-test",
    shot,
    compileFingerprint: digest("compile"),
    sourceRenderFingerprint: digest(`source-${shot}`),
    requestId:
      shot === "opening"
        ? "11111111-1111-4111-8111-111111111111"
        : "22222222-2222-4222-8222-222222222222",
    attemptId:
      shot === "opening"
        ? "33333333-3333-4333-8333-333333333333"
        : "44444444-4444-4444-8444-444444444444",
    startedAt: "2026-08-28T00:00:00.000Z",
    completedAt: "2026-08-28T00:00:01.000Z",
    costUnits: 1,
    executionPolicy: structuredClone(selected.executionPolicy),
    sourceBundle: `renders/${shot}/source`,
    controls: [{ pass: "depth", frameDigests: [digest(`depth-${shot}`)] }],
    references: request.references.map((reference, index) => ({
      ...reference,
      digest: digest(`${shot}-reference-${index}`),
    })),
    adapterIdentity: JSON.stringify(selected.generator.runtimeIdentity),
    generatorProvenance: structuredClone(
      selected.generator.generatorProvenance,
    ),
    structuralAuthority: "deterministic-source-only",
    parameters: structuredClone(request.parameters),
    evidence: structuredClone(request.evidence),
    output: {
      path: `renditions/${shot}/result.mp4`,
      digest: outputDigest(shot as "opening" | "answer"),
      bytes: 1,
      probe: {
        kind: "video",
        container: "mp4",
        codec: "h264",
        width: 16,
        height: 16,
        runtimeSeconds: 1,
        frameCount: 24,
        fps: 24,
        frameRate: { numerator: 24, denominator: 1 },
        brands: { major: "isom", compatible: ["isom"] },
        coded: { width: 16, height: 16 },
        trackDisplay: { width16_16: 1_048_576, height16_16: 1_048_576 },
        trackMatrix: [65_536, 0, 0, 0, 65_536, 0, 0, 0, 1_073_741_824],
        pixelAspect: { kind: "implicit-square" },
        presentation: {
          movieTimescale: 24,
          mediaTimescale: 24,
          movieDuration: 24,
          mediaDuration: 24,
          edits: [],
        },
        samples: {
          count: 24,
          duration: 1,
          timescale: 24,
          firstDts: 0,
          lastDts: 23,
          firstCts: 0,
          lastCts: 23,
        },
        color: {
          container: {
            kind: "nclx",
            primaries: 1,
            transfer: 13,
            matrix: 1,
            fullRange: true,
          },
          resolved: { kind: "srgb", source: "container" },
        },
      },
    },
  };
};

/**
 * Repaint execution consumes one exact reviewed configuration population.
 *
 * Scenarios:
 *
 * 1. A complete generator adoption and per-shot request set round-trips, while
 *    null remains the explicit deterministic-delivery choice.
 * 2. Extra, missing, padded, malformed, credential-bearing, or duplicate
 *    generator, policy, request, evidence, review, parameter, control, and
 *    reference fields are refused.
 * 3. Repaint delivery requires bidirectional equality between reviewed config
 *    shots and the compiled timeline; deterministic delivery requires null.
 * 4. The CLI separates reroll, same-request retry, candidate selection, and
 *    reversal and cannot supply prompt controls or review evidence.
 * 5. Final publication accepts receipts only when generator adoption, complete
 *    request, execution time, structural authority, and shot population still
 *    exactly match.
 * 6. Future terms-review dates fail before execution and from stored receipts,
 *    while same-day, past, leap-day, and UTC-midnight boundaries stay valid.
 */
export const test_cli_scaffold_repaint_configuration =
  async (): Promise<void> => {
    const configSource = path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/productionConfiguration.ts",
    );
    const configuration = loadSourceModule<IConfigurationModule>(configSource);
    const authored = selection();
    const parsed = configuration.readProductionRepaintSelection(
      authored,
      OCCURRED_AT,
    )!;
    TestValidator.equals(
      "repaint config preserves the complete reviewed adoption and requests",
      parsed,
      authored,
    );
    TestValidator.equals(
      "null remains the explicit no-repaint selection",
      configuration.readProductionRepaintSelection(null),
      null,
    );
    const unreviewed: IRepaintSelection = {
      ...authored,
      requests: authored.requests.map((request) => ({
        ...request,
        selectionReview: null,
      })),
    };
    TestValidator.equals(
      "candidate review remains null until an actual output is reviewed",
      configuration.readProductionRepaintSelection(unreviewed, OCCURRED_AT),
      unreviewed,
    );

    const runtime = authored.generator.runtimeIdentity;
    const provenance = authored.generator.generatorProvenance;
    const dialogue = {
      provider: "kokoro-local-v1",
      model: "onnx-community/Kokoro-82M-v1.0-ONNX",
      modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
      dtype: "q8",
      device: "cpu",
      voice: "af_heart",
      speed: 1,
      generatorProvenance: {
        source: "https://models.example/kokoro",
        license: "Apache-2.0",
        termsCheckedAt: "2026-08-28",
        cost: "local compute",
        consumer: {
          kind: "dialogue-synthesis",
          reason: "the screenplay contains authored dialogue",
        },
      },
    } as const;
    TestValidator.equals(
      "dialogue provenance admits a credential-free URL and non-URL license identifier",
      configuration.readProductionDialogueSynthesis(dialogue, OCCURRED_AT),
      dialogue,
    );
    TestValidator.predicate(
      "dialogue provenance refuses credential-bearing and malformed absolute locators",
      [
        {
          ...dialogue,
          generatorProvenance: {
            ...dialogue.generatorProvenance,
            source: "https://user:secret@models.example/kokoro",
          },
        },
        {
          ...dialogue,
          generatorProvenance: {
            ...dialogue.generatorProvenance,
            source: "https://[invalid",
          },
        },
        {
          ...dialogue,
          generatorProvenance: {
            ...dialogue.generatorProvenance,
            license: "https://user:secret@licenses.example/kokoro",
          },
        },
        {
          ...dialogue,
          generatorProvenance: {
            ...dialogue.generatorProvenance,
            license: "https://[invalid",
          },
        },
      ].every(
        (value) =>
          messageOf(() =>
            configuration.readProductionDialogueSynthesis(value, OCCURRED_AT),
          ) !== null,
      ),
    );
    const exactAndGeneratorFailures: unknown[] = [
      undefined,
      [],
      { ...authored, apiKey: "must-not-enter-config" },
      { requests: authored.requests },
      { ...authored, generator: null },
      {
        ...authored,
        generator: { ...authored.generator, credential: "forbidden" },
      },
      {
        ...authored,
        generator: {
          ...authored.generator,
          runtimeIdentity: { ...runtime, apiKey: "forbidden" },
        },
      },
      ...[
        ["protocolVersion", "automovie.repaint-runtime.v2"],
        ["provider", ""],
        ["provider", " padded "],
        ["model", ""],
        ["version", ""],
        ["execution", "cloud"],
      ].map(([key, value]) => ({
        ...authored,
        generator: {
          ...authored.generator,
          runtimeIdentity: { ...runtime, [String(key)]: value },
        },
      })),
      {
        ...authored,
        generator: { ...authored.generator, generatorProvenance: null },
      },
      {
        ...authored,
        generator: {
          ...authored.generator,
          generatorProvenance: { ...provenance, credential: "forbidden" },
        },
      },
      ...[
        ["source", ""],
        ["source", " padded "],
        ["source", "https://user:secret@models.example/repaint"],
        ["source", "https://[invalid"],
        ["license", ""],
        ["license", "https://user:secret@licenses.example/repaint"],
        ["license", "https://[invalid"],
        ["termsCheckedAt", "today"],
        ["termsCheckedAt", "2026-02-30"],
        ["cost", ""],
      ].map(([key, value]) => ({
        ...authored,
        generator: {
          ...authored.generator,
          generatorProvenance: { ...provenance, [String(key)]: value },
        },
      })),
      {
        ...authored,
        generator: {
          ...authored.generator,
          generatorProvenance: { ...provenance, consumer: null },
        },
      },
      {
        ...authored,
        generator: {
          ...authored.generator,
          generatorProvenance: {
            ...provenance,
            consumer: { kind: "dialogue-synthesis", reason: "wrong lane" },
          },
        },
      },
      {
        ...authored,
        generator: {
          ...authored.generator,
          generatorProvenance: {
            ...provenance,
            consumer: { kind: "repaint", reason: " padded " },
          },
        },
      },
    ];
    TestValidator.predicate(
      "repaint config refuses malformed and hidden generator adoption fields",
      exactAndGeneratorFailures.every(
        (value) =>
          messageOf(() =>
            configuration.readProductionRepaintSelection(value),
          ) !== null,
      ),
    );

    const policyFailures: unknown[] = [
      { ...authored, executionPolicy: null },
      {
        ...authored,
        executionPolicy: { ...authored.executionPolicy, hidden: true },
      },
      {
        ...authored,
        executionPolicy: {
          ...authored.executionPolicy,
          attemptTimeoutMs: 2_147_483_648,
          maximumElapsedMs: 2_147_483_648,
        },
      },
      ...[
        ["maximumAttempts", 0],
        ["maximumAttempts", 1.5],
        ["attemptTimeoutMs", 0],
        ["maximumElapsedMs", 100],
        ["maximumCostUnits", -1],
        ["maximumCostUnits", Number.POSITIVE_INFINITY],
        ["backoffMs", []],
        ["backoffMs", [-1]],
        ["backoffMs", [0, 2_147_483_648]],
        ["retryableFailures", ["transport", "transport"]],
        ["retryableFailures", ["unknown"]],
        ...[
          "invalid-output",
          "cancelled",
          "input-stale",
          "budget-exhausted",
        ].map((failureClass) => ["retryableFailures", [failureClass]]),
      ].map(([key, value]) => ({
        ...authored,
        executionPolicy: {
          ...authored.executionPolicy,
          [String(key)]: value,
        },
      })),
    ];
    TestValidator.predicate(
      "repaint config refuses every malformed or widened execution policy",
      policyFailures.every(
        (value) =>
          messageOf(() =>
            configuration.readProductionRepaintSelection(value),
          ) !== null,
      ),
    );

    const request = authored.requests[0]!;
    const malformedRequests: unknown[] = [
      { ...authored, requests: null },
      { ...authored, requests: [] },
      { ...authored, requests: [null] },
      {
        ...authored,
        requests: [{ ...request, prompt: "hidden parallel field" }],
      },
      {
        ...authored,
        requests: [
          { parameters: request.parameters, references: request.references },
        ],
      },
      { ...authored, requests: [{ ...request, shot: "" }] },
      { ...authored, requests: [{ ...request, shot: " padded " }] },
      { ...authored, requests: [request, structuredClone(request)] },
      { ...authored, requests: [{ ...request, parameters: null }] },
      {
        ...authored,
        requests: [
          { ...request, parameters: { ...request.parameters, hidden: true } },
        ],
      },
      ...[
        ["prompt", ""],
        ["prompt", " padded "],
        ["seed", 1.5],
        ["seed", Number.MAX_SAFE_INTEGER + 1],
        ["strength", "0.5"],
        ["strength", Number.NaN],
        ["strength", -0.1],
        ["strength", 1.1],
        ["negativePrompt", ""],
        ["negativePrompt", " padded "],
        ["controls", null],
        ["controls", []],
        ["controls", new Date("2026-08-28T00:00:00.000Z")],
        ["controls", { " padded ": true }],
        ["controls", { scheduler: "" }],
        ["controls", { scheduler: " padded " }],
        ["controls", { guidance: Number.POSITIVE_INFINITY }],
        ["controls", { nested: {} }],
      ].map(([key, value]) => ({
        ...authored,
        requests: [
          {
            ...request,
            parameters: { ...request.parameters, [String(key)]: value },
          },
        ],
      })),
      { ...authored, requests: [{ ...request, references: null }] },
      { ...authored, requests: [{ ...request, references: [] }] },
      { ...authored, requests: [{ ...request, references: [null] }] },
      {
        ...authored,
        requests: [
          {
            ...request,
            references: [{ ...request.references[0], digest: "hidden" }],
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              candidateAttemptId: "not-a-uuid",
            },
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              candidateOutputDigest: "not-a-digest",
            },
          },
        ],
      },
      ...[63, 65].map((length) => ({
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              candidateOutputDigest: `sha256:${"a".repeat(length)}`,
            },
          },
        ],
      })),
      {
        ...authored,
        requests: [
          { ...request, references: [{ role: "mask", path: "asset.png" }] },
        ],
      },
      {
        ...authored,
        requests: [{ ...request, references: [{ role: "style", path: "" }] }],
      },
      {
        ...authored,
        requests: [
          { ...request, references: [{ role: "style", path: " padded " }] },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            references: [request.references[0], request.references[0]],
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            references: request.references.map((reference) => ({
              ...reference,
              path: "assets/references/universal.png",
            })),
          },
        ],
      },
      { ...authored, requests: [{ ...request, evidence: null }] },
      {
        ...authored,
        requests: [
          { ...request, evidence: { ...request.evidence, hidden: true } },
        ],
      },
      ...[
        ["prompt", ""],
        ["continuity", 10],
        ["settings", " padded "],
        ["design", ""],
        ["screenplayOrBrief", ""],
        ["shot", ""],
      ].map(([key, value]) => ({
        ...authored,
        requests: [
          {
            ...request,
            evidence: { ...request.evidence, [String(key)]: value },
          },
        ],
      })),
      {
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              reason: "",
            },
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              continuityReview: {
                ...request.selectionReview!.continuityReview!,
                flicker: "fail",
              },
            },
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            selectionReview: {
              ...request.selectionReview!,
              continuityReview: {
                ...request.selectionReview!.continuityReview!,
                baseline: "settings/continuity.md#another-baseline",
              },
            },
          },
        ],
      },
      {
        ...authored,
        requests: [
          {
            ...request,
            evidence: { ...request.evidence, continuity: null },
          },
        ],
      },
    ];
    TestValidator.predicate(
      "repaint config refuses malformed request, parameter, control, and reference fields",
      malformedRequests.every(
        (value) =>
          messageOf(() =>
            configuration.readProductionRepaintSelection(value),
          ) !== null,
      ),
    );

    const inapplicable: IRepaintSelection = {
      ...authored,
      requests: authored.requests.map((candidate) => ({
        ...candidate,
        evidence: { ...candidate.evidence, continuity: null },
        selectionReview: {
          ...candidate.selectionReview!,
          continuityReview: null,
        },
      })),
    };
    TestValidator.equals(
      "visual delivery, continuity population, and compiled repaint shots agree in every valid state",
      [
        configuration.assertProductionRepaintSelection({
          selected: null,
          visualDelivery: "deterministic",
          continuity: "film",
          shots: [],
        }),
        configuration
          .assertProductionRepaintSelection({
            selected: authored,
            visualDelivery: "repainted",
            continuity: "film",
            shots: ["answer", "opening"],
          })
          ?.requests.map((candidate) => candidate.shot),
        configuration
          .assertProductionRepaintSelection({
            selected: inapplicable,
            visualDelivery: "repainted",
            continuity: "inapplicable",
            shots: ["answer", "opening"],
          })
          ?.requests.map((candidate) => candidate.shot),
      ],
      [null, ["opening", "answer"], ["opening", "answer"]],
    );
    const deliveryFailures = [
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "deterministic",
          continuity: "film",
          shots: [],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: null,
          visualDelivery: "repainted",
          continuity: "film",
          shots: [],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening", "answer", "extra"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening", "opening"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening", " padded "],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: inapplicable,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening", "answer"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: unreviewed,
          visualDelivery: "repainted",
          continuity: "film",
          shots: ["opening", "answer"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          continuity: "inapplicable",
          shots: ["opening", "answer"],
        }),
    ].map((operation) => messageOf(operation));
    TestValidator.predicate(
      "delivery refuses selection, continuity-population, and shot-set mismatches",
      deliveryFailures.every((message) => message !== null),
    );

    TestValidator.equals(
      "the repaint command separates request, retry, selection, and reversal identities",
      {
        reroll: configuration.readProductionRepaintCommand([
          "reroll",
          "--shot",
          "opening",
        ]),
        retry: configuration.readProductionRepaintCommand([
          "retry",
          "--shot",
          "opening",
          "--request",
          "11111111-1111-4111-8111-111111111111",
        ]),
        selection: configuration.readProductionRepaintCommand([
          "select",
          "--shot",
          "opening",
          "--attempt",
          "33333333-3333-4333-8333-333333333333",
        ]),
        reversal: configuration.readProductionRepaintCommand([
          "reverse",
          "--shot",
          "opening",
          "--attempt",
          "44444444-4444-4444-8444-444444444444",
        ]),
        selected: configuration.selectProductionRepaintRequest(
          authored,
          "opening",
          OCCURRED_AT,
        ),
      },
      {
        reroll: { kind: "reroll", shot: "opening" },
        retry: {
          kind: "retry",
          shot: "opening",
          requestId: "11111111-1111-4111-8111-111111111111",
        },
        selection: {
          kind: "selection",
          shot: "opening",
          attemptId: "33333333-3333-4333-8333-333333333333",
        },
        reversal: {
          kind: "reversal",
          shot: "opening",
          attemptId: "44444444-4444-4444-8444-444444444444",
        },
        selected: {
          generator: authored.generator,
          executionPolicy: authored.executionPolicy,
          request: authored.requests[0],
        },
      },
    );
    TestValidator.predicate(
      "repaint operations refuse ambiguous, malformed, injected, and unknown identities",
      [
        () => configuration.readProductionRepaintCommand(["opening"]),
        () =>
          configuration.readProductionRepaintCommand([
            "reroll",
            "--shot",
            "opening",
            "extra",
          ]),
        () => configuration.readProductionRepaintCommand(["--prompt", "x"]),
        () =>
          configuration.readProductionRepaintCommand(["reroll", "--shot", ""]),
        () =>
          configuration.readProductionRepaintCommand([
            "reroll",
            "--shot",
            " padded ",
          ]),
        () =>
          configuration.readProductionRepaintCommand([
            "retry",
            "--shot",
            "opening",
            "--request",
            "not-a-uuid",
          ]),
        () =>
          configuration.readProductionRepaintCommand([
            "select",
            "--shot",
            "opening",
            "--attempt",
            "33333333-3333-4333-8333-333333333333",
            "--reason",
            "injected",
          ]),
        () => configuration.selectProductionRepaintRequest(null, "opening"),
        () => configuration.selectProductionRepaintRequest(authored, ""),
        () =>
          configuration.selectProductionRepaintRequest(authored, " padded "),
        () => configuration.selectProductionRepaintRequest(authored, "missing"),
      ].every((operation) => messageOf(operation) !== null),
    );

    const receipts = [receipt(parsed, "answer"), receipt(parsed, "opening")];
    for (const candidate of receipts) {
      configuration.assertProductionRepaintCandidateAdoption({
        selected: parsed,
        receipt: candidate,
      });
      TestValidator.equals(
        `selection review is bound to ${candidate.shot}'s immutable candidate`,
        configuration.selectProductionRepaintCandidateReview({
          request: parsed.requests.find(
            (request) => request.shot === candidate.shot,
          )!,
          receipt: candidate,
        }).reason,
        parsed.requests.find((request) => request.shot === candidate.shot)!
          .selectionReview!.reason,
      );
    }
    configuration.assertProductionRepaintReceiptAdoption({
      selected: parsed,
      receipts,
    });
    const mutateReceipt = (
      shot: string,
      transform: (value: IAutoMovieRepaintReceipt) => IAutoMovieRepaintReceipt,
    ): IAutoMovieRepaintReceipt[] =>
      receipts.map((value) =>
        value.shot === shot ? transform(structuredClone(value)) : value,
      );
    const receiptFailures = [
      () =>
        configuration.selectProductionRepaintCandidateReview({
          request: unreviewed.requests[0]!,
          receipt: receipts.find((value) => value.shot === "opening")!,
        }),
      () =>
        configuration.selectProductionRepaintCandidateReview({
          request: {
            ...parsed.requests[0]!,
            selectionReview: {
              ...parsed.requests[0]!.selectionReview!,
              candidateAttemptId: "55555555-5555-4555-8555-555555555555",
            },
          },
          receipt: receipts.find((value) => value.shot === "opening")!,
        }),
      () =>
        configuration.selectProductionRepaintCandidateReview({
          request: {
            ...parsed.requests[0]!,
            selectionReview: {
              ...parsed.requests[0]!.selectionReview!,
              candidateOutputDigest: `sha256:${"c".repeat(64)}`,
            },
          },
          receipt: receipts.find((value) => value.shot === "opening")!,
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: null as unknown as IRepaintSelection,
          receipts: [],
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: [],
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: [receipts[0]!, receipts[0]!, receipts[1]!],
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            adapterIdentity: "not-json",
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            version: 3,
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            startedAt: "not-an-instant",
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            startedAt: "2026-08-28T00:00:02.000Z",
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            executionPolicy: {
              ...value.executionPolicy!,
              maximumCostUnits: value.executionPolicy!.maximumCostUnits + 1,
            },
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            evidence: { ...value.evidence!, shot: "src/shots/other.ts#other" },
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            adapterIdentity: JSON.stringify({
              ...parsed.generator.runtimeIdentity,
              provider: "different-provider",
            }),
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            generatorProvenance: {
              ...value.generatorProvenance,
              termsCheckedAt: "2026-08-29",
            },
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            parameters: {
              ...value.parameters,
              seed: value.parameters.seed + 1,
            },
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            references: [
              { ...value.references[0]!, path: "assets/unreviewed.png" },
            ],
          })),
        }),
      () =>
        configuration.assertProductionRepaintReceiptAdoption({
          selected: parsed,
          receipts: mutateReceipt("opening", (value) => ({
            ...value,
            structuralAuthority: "derived-rendition" as never,
          })),
        }),
    ].map((operation) => messageOf(operation));
    TestValidator.predicate(
      "publication refuses missing, repeated, malformed, changed, or over-authoritative receipts",
      receiptFailures.every((message) => message !== null),
    );

    const calendarSelection = (termsCheckedAt: string): IRepaintSelection => ({
      ...authored,
      generator: {
        ...authored.generator,
        generatorProvenance: {
          ...authored.generator.generatorProvenance,
          termsCheckedAt,
        },
      },
    });
    TestValidator.equals(
      "terms review uses the injected UTC day without entering content identity",
      {
        past: configuration.readProductionRepaintSelection(
          calendarSelection("2024-02-29"),
          "2026-08-28T00:00:00.000Z",
        )?.generator.generatorProvenance.termsCheckedAt,
        sameDayBeforeMidnight: configuration.readProductionRepaintSelection(
          calendarSelection("2026-08-28"),
          "2026-08-28T23:59:59.999Z",
        )?.generator.generatorProvenance.termsCheckedAt,
        sameDayAfterMidnight: configuration.readProductionRepaintSelection(
          calendarSelection("2026-08-29"),
          "2026-08-29T00:00:00.000Z",
        )?.generator.generatorProvenance.termsCheckedAt,
        futureRefused:
          messageOf(() =>
            configuration.readProductionRepaintSelection(
              calendarSelection("2026-08-29"),
              "2026-08-28T23:59:59.999Z",
            ),
          ) !== null,
      },
      {
        past: "2024-02-29",
        sameDayBeforeMidnight: "2026-08-28",
        sameDayAfterMidnight: "2026-08-29",
        futureRefused: true,
      },
    );
  };
