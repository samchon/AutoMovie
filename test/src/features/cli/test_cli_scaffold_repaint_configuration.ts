import type {
  AutoMovieContentDigest,
  IAutoMovieRepaintGeneratorAdoption,
  IAutoMovieRepaintReceipt,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface IRepaintRequest {
  shot: string;
  parameters: IAutoMovieRepaintReceipt["parameters"];
  references: Array<{ role: "style" | "character"; path: string }>;
}

interface IRepaintSelection {
  generator: IAutoMovieRepaintGeneratorAdoption;
  requests: IRepaintRequest[];
}

interface IConfigurationModule {
  readProductionRepaintSelection: (
    selected: unknown,
  ) => IRepaintSelection | null;
  assertProductionRepaintSelection: (props: {
    selected: unknown;
    visualDelivery: "deterministic" | "repainted";
    shots: readonly string[];
  }) => IRepaintSelection | null;
  selectProductionRepaintRequest: (
    selected: unknown,
    shot: unknown,
  ) => {
    generator: IAutoMovieRepaintGeneratorAdoption;
    request: IRepaintRequest;
  };
  readProductionRepaintShotArgument: (args: readonly string[]) => string;
  assertProductionRepaintReceiptAdoption: (props: {
    selected: IRepaintSelection;
    receipts: readonly IAutoMovieRepaintReceipt[];
  }) => void;
}

const digest = (value: string): AutoMovieContentDigest => `sha256:${value}`;

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
        { role: "style", path: "assets/references/lobby-style.png" },
        { role: "character", path: "assets/references/guide.png" },
      ],
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
    version: 3,
    productionId: "repaint-config-test",
    shot,
    compileFingerprint: digest("compile"),
    sourceRenderFingerprint: digest(`source-${shot}`),
    attemptId: `attempt-${shot}`,
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
    output: {
      path: `renditions/${shot}/result.mp4`,
      digest: digest(`output-${shot}`),
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
 *    generator, request, parameter, control, and reference fields are refused.
 * 3. Repaint delivery requires bidirectional equality between reviewed config
 *    shots and the compiled timeline; deterministic delivery requires null.
 * 4. The CLI resolves only a configured shot and cannot supply prompt controls.
 * 5. Final publication accepts receipts only when generator adoption, complete
 *    request, structural authority, and shot population still exactly match.
 */
export const test_cli_scaffold_repaint_configuration =
  async (): Promise<void> => {
    const configSource = path.resolve(
      __dirname,
      "../../../../packages/template/scaffold/scripts/productionConfiguration.ts",
    );
    const configuration = (
      process.env.AUTOMOVIE_ISSUE_2126_ESM === "1"
        ? await import(pathToFileURL(configSource).href)
        : require(configSource)
    ) as IConfigurationModule;
    const authored = selection();
    const parsed = configuration.readProductionRepaintSelection(authored)!;
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

    const runtime = authored.generator.runtimeIdentity;
    const provenance = authored.generator.generatorProvenance;
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
        ["license", ""],
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

    TestValidator.equals(
      "visual delivery and compiled repaint shots agree in both valid states",
      [
        configuration.assertProductionRepaintSelection({
          selected: null,
          visualDelivery: "deterministic",
          shots: [],
        }),
        configuration
          .assertProductionRepaintSelection({
            selected: authored,
            visualDelivery: "repainted",
            shots: ["answer", "opening"],
          })
          ?.requests.map((candidate) => candidate.shot),
      ],
      [null, ["opening", "answer"]],
    );
    const deliveryFailures = [
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "deterministic",
          shots: [],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: null,
          visualDelivery: "repainted",
          shots: [],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          shots: ["opening"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          shots: ["opening", "answer", "extra"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          shots: ["opening", "opening"],
        }),
      () =>
        configuration.assertProductionRepaintSelection({
          selected: authored,
          visualDelivery: "repainted",
          shots: ["opening", " padded "],
        }),
    ].map((operation) => messageOf(operation));
    TestValidator.predicate(
      "delivery refuses both selection directions and every shot-set mismatch",
      deliveryFailures.every((message) => message !== null),
    );

    TestValidator.equals(
      "the repaint command resolves the complete reviewed request by shot only",
      {
        shot: configuration.readProductionRepaintShotArgument([
          "--shot",
          "opening",
        ]),
        selected: configuration.selectProductionRepaintRequest(
          authored,
          "opening",
        ),
      },
      {
        shot: "opening",
        selected: {
          generator: authored.generator,
          request: authored.requests[0],
        },
      },
    );
    TestValidator.predicate(
      "repaint command selection refuses positional, extra, null, blank, padded, and unknown shots",
      [
        () => configuration.readProductionRepaintShotArgument(["opening"]),
        () =>
          configuration.readProductionRepaintShotArgument([
            "--shot",
            "opening",
            "extra",
          ]),
        () =>
          configuration.readProductionRepaintShotArgument(["--prompt", "x"]),
        () => configuration.readProductionRepaintShotArgument(["--shot", ""]),
        () =>
          configuration.readProductionRepaintShotArgument([
            "--shot",
            " padded ",
          ]),
        () => configuration.selectProductionRepaintRequest(null, "opening"),
        () => configuration.selectProductionRepaintRequest(authored, ""),
        () =>
          configuration.selectProductionRepaintRequest(authored, " padded "),
        () => configuration.selectProductionRepaintRequest(authored, "missing"),
      ].every((operation) => messageOf(operation) !== null),
    );

    const receipts = [receipt(parsed, "answer"), receipt(parsed, "opening")];
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
  };
