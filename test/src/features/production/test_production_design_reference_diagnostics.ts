import {
  AutoMovieContentDigest,
  IAutoMovieAssetProvenance,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignReference,
} from "@automovie/interface";
import {
  assetAcquisitionIncomplete,
  assetProcessingOmitted,
  designReferenceDiagnostics,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

const PLAN_PATH = "public/design-references/pavilion-plan.png";
const STUDY_PATH = "public/design-references/pavilion-study.png";

/** A complete PNG datastream carrying the declared plan extent. */
const png = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(0xff);
  return PNG.sync.write(image);
};

const PLAN_BYTES = png(1000, 800);
const PLAN_DIGEST = digestAutoMovieBytes(PLAN_BYTES);
const STUDY_BYTES = png(1024, 1024);
const STUDY_DIGEST = digestAutoMovieBytes(STUDY_BYTES);
const PROMPT_DIGEST =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222" as AutoMovieContentDigest;

/** The observed raster plan, declared exactly as its bytes are. */
const planDocument = (): IAutoMovieDesignReference => ({
  version: 1,
  id: "pavilion-plan",
  asset: PLAN_PATH,
  digest: PLAN_DIGEST,
  media: "image/png",
  frames: [
    {
      id: "plan-1",
      page: 1,
      view: "plan",
      level: "ground",
      bounds: { width: 1000, height: 800 },
      anchor: { x: 0, y: 0 },
      scaleCandidates: [
        {
          id: "plan-bar",
          metersPerUnit: 0.01,
          confidence: 0.95,
          basis: "scale-bar",
        },
      ],
      scale: "plan-bar",
      axisX: { x: 1, y: 0, z: 0 },
      axisY: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      north: { x: 0, y: 0, z: -1 },
      transform: null,
    },
  ],
  primitives: [
    {
      id: "west-run",
      frame: "plan-1",
      kind: "line",
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 500 },
      ],
      text: null,
    },
  ],
  analyses: [
    {
      id: "wall-centerline",
      frame: "plan-1",
      subject: "wall-centerline",
      outcome: { status: "observed", candidates: ["wall-west"] },
    },
  ],
  candidates: [
    {
      id: "wall-west",
      semantic: "wall-centerline",
      primitives: ["west-run"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
  ],
  issues: [],
});

/** The generated elevation study, observed as its own reference. */
const studyDocument = (): IAutoMovieDesignReference => ({
  ...planDocument(),
  id: "pavilion-study",
  asset: STUDY_PATH,
  digest: STUDY_DIGEST,
  frames: [
    {
      ...planDocument().frames[0]!,
      id: "study-1",
      view: "elevation",
      bounds: { width: 1024, height: 1024 },
    },
  ],
  analyses: [
    {
      id: "massing-read",
      frame: "study-1",
      subject: "massing",
      outcome: {
        status: "not-run",
        reason:
          "A generated study is a mood reference; no measurement was attempted against it.",
      },
    },
  ],
  candidates: [],
  primitives: [],
});

const evidence = (): IAutoMovieDesignEvidence[] => [
  {
    subject: "pavilion/wall-west",
    document: "pavilion-plan",
    candidates: ["wall-west"],
    rationale:
      "The west run is the only unambiguous centreline on the sheet, so the authored wall follows it.",
  },
];

/** The compiler's view of one production's declared design references. */
interface ILedger {
  path: string;
  references: IAutoMovieDesignReference[];
  evidence: IAutoMovieDesignEvidence[];
  assets: Map<string, Uint8Array | null>;
  uses: Map<string, Set<string>>;
}

/** Everything the compiler would see for a healthy pair of references. */
const inputs = (): ILedger => ({
  path: "automovie/assets.json",
  references: [planDocument(), studyDocument()],
  evidence: evidence(),
  assets: new Map<string, Uint8Array | null>([
    [PLAN_PATH, PLAN_BYTES],
    [STUDY_PATH, STUDY_BYTES],
  ]),
  uses: new Map<string, Set<string>>([
    [PLAN_PATH, new Set(["pavilion-plan"])],
    [STUDY_PATH, new Set(["pavilion-study"])],
  ]),
});

/** The diagnostic codes one mutated ledger produces, in order. */
const codes = (mutate: (value: ILedger) => void): string[] => {
  const value = inputs();
  mutate(value);
  return designReferenceDiagnostics(value).map((diagnostic) => diagnostic.code);
};

/** A fetched asset whose ledger is complete. */
const fetched = (): IAutoMovieAssetProvenance => ({
  path: PLAN_PATH,
  digest: PLAN_DIGEST,
  original: {
    url: "https://example.com/pavilion-plan.png",
    digest: PLAN_DIGEST,
  },
  license: {
    identifier: "CC-BY-4.0",
    url: "https://creativecommons.org/licenses/by/4.0/",
  },
  processing: [],
  uses: [],
});

/** A generated asset whose ledger records generation instead of a URL. */
const produced = (): IAutoMovieAssetProvenance => ({
  path: STUDY_PATH,
  digest: STUDY_DIGEST,
  generated: {
    provider: "image-generation-service",
    model: "diffusion-xl-2026-03",
    request: "req_8f21",
    prompt: "Quarter view of a timber garden pavilion under a flat roof.",
    promptDigest: PROMPT_DIGEST,
    inputs: [PLAN_PATH],
    outputDigest: STUDY_DIGEST,
    reproducible: false,
    seed: null,
  },
  license: {
    identifier: "LicenseRef-generated",
    url: "https://example.com/generation-terms",
  },
  processing: [],
  uses: [],
});

/**
 * The compiler's gate over observed evidence. A design reference is the one
 * place bytes somebody else produced can reach a building, so this pins that
 * every way those bytes could quietly change identity — swapped under a stable
 * path, relabelled as another container, claimed by a frame larger than the
 * sheet, cited by a reading that was deleted, or carried by an asset no ledger
 * authorized — is reported rather than absorbed. It also pins the acquisition
 * ledger that lets a generated image be registered at all, without inventing
 * the source URL it never had.
 *
 * Scenarios:
 *
 * 1. A healthy pair of references — one scanned plan, one generated study —
 *    compiles with no diagnostic at all.
 * 2. A document declared twice, or one that is not a coherent observation, is
 *    refused before its bytes are ever read.
 * 3. Bytes that are absent, or that no longer hash to what was observed, are
 *    reported: an observation cannot outlive the file it was taken from.
 * 4. A container relabelled as another family, and one this host cannot open at
 *    all, are each reported with their own code.
 * 5. A frame claiming more sheet than the file measures is refused, while a
 *    container whose extent is genuinely unmeasurable leaves the frame
 *    unverified instead of falsely blessed.
 * 6. A single-page raster carrying a frame that cites page two is refused.
 * 7. An asset with no design-reference use, a use naming no document, and a use
 *    naming a document that reads different bytes are each refused, so the
 *    authorization is bidirectional.
 * 8. A citation pointing at a reading nobody recorded is refused.
 * 9. An asset acquisition is exactly one of fetched or generated: neither and both
 *    are incomplete, a fetched one still needs a real URL and digest, and a
 *    generated one is held to its own generation ledger.
 * 10. Changed bytes with no recorded processing are reported against whichever
 *     baseline the asset actually has, and an asset with no acquisition at all
 *     is left to the acquisition gate rather than double-reported.
 */
export const test_production_design_reference_diagnostics = (): void => {
  TestValidator.equals(
    "a scanned plan and a generated study compile with no diagnostic",
    designReferenceDiagnostics(inputs()),
    [],
  );
  TestValidator.equals(
    "the diagnostics carry the ledger path and the design phase",
    designReferenceDiagnostics({
      ...inputs(),
      references: [planDocument(), planDocument()],
      uses: new Map([[PLAN_PATH, new Set(["pavilion-plan"])]]),
    }).map((diagnostic) => [
      diagnostic.path,
      diagnostic.phase,
      diagnostic.target,
    ]),
    [["automovie/assets.json", "design", "pavilion-plan"]],
  );

  const cases: ReadonlyArray<
    readonly [string, (value: ReturnType<typeof inputs>) => void, string[]]
  > = [
    [
      "a document declared twice",
      (value) => value.references.push(planDocument()),
      ["design-reference-duplicate"],
    ],
    [
      "an incoherent observation",
      (value) => (value.references[0]!.candidates[0]!.confidence = 2),
      ["design-reference-invalid"],
    ],
    [
      "bytes that are absent from the project",
      (value) => value.assets.set(PLAN_PATH, null),
      ["design-reference-asset-missing"],
    ],
    [
      "bytes that were never registered at all",
      (value) => (value.assets = new Map([[STUDY_PATH, STUDY_BYTES]])),
      ["design-reference-asset-missing"],
    ],
    [
      "bytes that changed under a stable path",
      (value) => value.assets.set(PLAN_PATH, png(1024, 768)),
      ["design-reference-stale"],
    ],
    [
      "a container relabelled as another family",
      (value) => (value.references[0]!.media = "image/svg+xml"),
      ["design-reference-media-mismatch"],
    ],
    [
      "bytes this host cannot open at all",
      (value) => {
        const bytes = new Uint8Array(Buffer.from("plain notes", "utf8"));
        value.assets.set(PLAN_PATH, bytes);
        value.references[0]!.digest = digestAutoMovieBytes(bytes);
      },
      ["design-reference-media-unsupported"],
    ],
    [
      "an XML candidate preceded by an invalid XML scalar",
      (value) => {
        const bytes = Buffer.from(
          '\u000b<svg xmlns="http://www.w3.org/2000/svg"/>',
          "utf8",
        );
        value.assets.set(PLAN_PATH, bytes);
        value.references[0]!.digest = digestAutoMovieBytes(bytes);
        value.references[0]!.media = "image/svg+xml";
      },
      ["design-reference-container-invalid"],
    ],
    [
      "a frame claiming more sheet than the file holds",
      (value) => (value.references[0]!.frames[0]!.bounds.width = 4096),
      ["design-reference-frame-bounds-mismatch"],
    ],
    [
      "a frame claiming more height than the file holds",
      (value) => (value.references[0]!.frames[0]!.bounds.height = 4096),
      ["design-reference-frame-bounds-mismatch"],
    ],
    [
      "a single-page raster whose frame cites page two",
      (value) => (value.references[0]!.frames[0]!.page = 2),
      ["design-reference-frame-page-missing"],
    ],
    [
      "an asset carrying no design-reference use",
      (value) => value.uses.delete(PLAN_PATH),
      ["design-reference-use-unbound"],
    ],
    [
      "an asset whose use names another document",
      (value) => value.uses.set(PLAN_PATH, new Set(["pavilion-elevation"])),
      ["design-reference-use-unbound", "design-reference-use-dangling"],
    ],
    [
      "a use naming a document that reads different bytes",
      (value) => value.uses.set(PLAN_PATH, new Set(["pavilion-study"])),
      ["design-reference-use-unbound", "design-reference-use-dangling"],
    ],
    [
      "a citation pointing at a reading nobody recorded",
      (value) => (value.evidence[0]!.candidates = ["wall-ghost"]),
      ["design-reference-evidence-dangling"],
    ],
  ];
  cases.forEach(([name, mutate, expected]) =>
    TestValidator.equals(`${name} is reported`, codes(mutate), expected),
  );

  TestValidator.equals(
    "an unmeasurable container leaves its frames unverified rather than blessed",
    codes((value) => {
      const bytes = new Uint8Array(
        Buffer.from(
          "0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF",
          "utf8",
        ),
      );
      value.assets.set(PLAN_PATH, bytes);
      value.references[0]!.digest = digestAutoMovieBytes(bytes);
      value.references[0]!.media = "image/vnd.dxf";
      value.references[0]!.frames[0]!.page = 3;
      value.references[0]!.frames[0]!.bounds = { width: 99999, height: 99999 };
    }),
    [],
  );

  // 9-10. The acquisition ledger.
  TestValidator.equals(
    "exactly one of a fetched and a generated acquisition is complete provenance",
    [
      assetAcquisitionIncomplete(fetched()),
      assetAcquisitionIncomplete(produced()),
      assetAcquisitionIncomplete({ ...fetched(), original: undefined }),
      assetAcquisitionIncomplete({
        ...fetched(),
        generated: produced().generated,
      }),
    ],
    [false, false, true, true],
  );
  TestValidator.equals(
    "a fetched acquisition still needs a real URL and a real digest",
    [
      assetAcquisitionIncomplete({
        ...fetched(),
        original: { url: "not a url", digest: PLAN_DIGEST },
      }),
      assetAcquisitionIncomplete({
        ...fetched(),
        original: {
          url: "https://example.com/plan.png",
          digest: "sha256:short" as AutoMovieContentDigest,
        },
      }),
    ],
    [true, true],
  );
  TestValidator.equals(
    "a generated acquisition is held to its own ledger, and to the bytes when unprocessed",
    [
      assetAcquisitionIncomplete({
        ...produced(),
        generated: { ...produced().generated!, provider: " " },
      }),
      assetAcquisitionIncomplete({
        ...produced(),
        digest: PLAN_DIGEST,
      }),
      assetAcquisitionIncomplete({
        ...produced(),
        digest: PLAN_DIGEST,
        processing: [
          { tool: "oxipng@9", command: "optimize", parameters: { level: 4 } },
        ],
      }),
    ],
    [true, true, false],
  );
  TestValidator.equals(
    "changed bytes with no recorded processing are reported against the right baseline",
    [
      assetProcessingOmitted(fetched()),
      assetProcessingOmitted(produced()),
      assetProcessingOmitted({ ...fetched(), digest: STUDY_DIGEST }),
      assetProcessingOmitted({ ...produced(), digest: PLAN_DIGEST }),
      assetProcessingOmitted({
        ...fetched(),
        digest: STUDY_DIGEST,
        processing: [
          { tool: "oxipng@9", command: "optimize", parameters: { level: 4 } },
        ],
      }),
      assetProcessingOmitted({ ...fetched(), original: undefined }),
    ],
    [false, false, true, true, false, false],
  );
};
