import {
  validateDesignEvidence,
  validateDesignReference,
  validateGeneratedAcquisition,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignReference,
  IAutoMovieGeneratedAcquisition,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  validationHasWarning,
  validationHasWarningCount,
  violationCount,
} from "../internal/predicates";

const PLAN_DIGEST =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as AutoMovieContentDigest;
const PROMPT_DIGEST =
  "sha256:2222222222222222222222222222222222222222222222222222222222222222" as AutoMovieContentDigest;
const STUDY_DIGEST =
  "sha256:3333333333333333333333333333333333333333333333333333333333333333" as AutoMovieContentDigest;

/**
 * One small garden pavilion, observed rather than designed.
 *
 * The sheet carries a settled raster plan and an unsettled section: the plan's
 * scale bar was legible, the section's was not, and the section therefore keeps
 * two competing scale readings and no chosen one. The north wall was drawn with
 * two plausible centrelines, a door is behind a hatched planter, and two of the
 * three analyses produced nothing at all. Everything about that is recorded as
 * observation, and none of it is a wall.
 */
const observation = (): IAutoMovieDesignReference => ({
  version: 1,
  id: "pavilion-plan",
  asset: "public/design-references/pavilion-plan.png",
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
    {
      id: "section-1",
      page: 1,
      view: "section",
      level: null,
      bounds: { width: 1000, height: 800 },
      anchor: { x: 500, y: 400 },
      scaleCandidates: [
        {
          id: "section-fifty",
          metersPerUnit: 0.02,
          confidence: 0.4,
          basis: "assumed 1:50",
        },
        {
          id: "section-hundred",
          metersPerUnit: 0.04,
          confidence: 0.4,
          basis: "assumed 1:100",
        },
      ],
      scale: null,
      axisX: { x: 1, y: 0, z: 0 },
      axisY: { x: 0, y: -1, z: 0 },
      origin: { x: 0, y: 0, z: 0 },
      up: { x: 0, y: 1, z: 0 },
      north: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
  ],
  primitives: [
    {
      id: "north-outer",
      frame: "plan-1",
      kind: "line",
      points: [
        { x: 100, y: 100 },
        { x: 700, y: 100 },
      ],
      text: null,
    },
    {
      id: "north-inner",
      frame: "plan-1",
      kind: "line",
      points: [
        { x: 100, y: 120 },
        { x: 700, y: 120 },
      ],
      text: null,
    },
    {
      id: "west-run",
      frame: "plan-1",
      kind: "polyline",
      points: [
        { x: 100, y: 100 },
        { x: 100, y: 500 },
        { x: 300, y: 500 },
      ],
      text: null,
    },
    {
      id: "planter",
      frame: "plan-1",
      kind: "region",
      points: [
        { x: 300, y: 90 },
        { x: 420, y: 90 },
        { x: 420, y: 150 },
      ],
      text: null,
    },
    {
      id: "door-swing",
      frame: "plan-1",
      kind: "arc",
      points: [
        { x: 320, y: 110 },
        { x: 360, y: 70 },
        { x: 400, y: 110 },
      ],
      text: null,
    },
    {
      id: "room-label",
      frame: "plan-1",
      kind: "text",
      points: [{ x: 400, y: 300 }],
      text: "PAVILION",
    },
    {
      id: "ffl",
      frame: "section-1",
      kind: "level-marker",
      points: [{ x: 200, y: 600 }],
      text: "+0.000",
    },
  ],
  analyses: [
    {
      id: "wall-centerline",
      frame: "plan-1",
      subject: "wall-centerline",
      outcome: {
        status: "observed",
        candidates: ["wall-north-outer", "wall-north-inner", "wall-west"],
      },
    },
    {
      id: "opening-detection",
      frame: "plan-1",
      subject: "opening",
      outcome: {
        status: "unsupported",
        reason:
          "This host reads no door symbol library, so the swing arc is not resolved into an opening.",
      },
    },
    {
      id: "section-datum",
      frame: "section-1",
      subject: "storey-datum",
      outcome: {
        status: "not-run",
        reason:
          "The section scale is unsettled, so no datum extraction was attempted.",
      },
    },
  ],
  candidates: [
    {
      id: "wall-north-outer",
      semantic: "wall-centerline",
      primitives: ["north-outer"],
      confidence: 0.6,
      alternatives: ["wall-north-inner"],
      issues: [],
    },
    {
      id: "wall-north-inner",
      semantic: "wall-centerline",
      primitives: ["north-inner"],
      confidence: 0.6,
      alternatives: ["wall-north-outer"],
      issues: ["door-occluded"],
    },
    {
      id: "wall-west",
      semantic: "wall-centerline",
      primitives: ["west-run"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
  ],
  issues: [
    {
      id: "door-occluded",
      kind: "occluded",
      subjects: ["door-swing", "wall-north-inner"],
      detail:
        "The planter hatch covers the door jamb, so the opening width cannot be read from this sheet.",
      open: true,
    },
    {
      id: "section-scale-unknown",
      kind: "unknown-scale",
      subjects: ["ffl"],
      detail:
        "The section carries no legible scale bar; 1:50 and 1:100 both fit the sheet.",
      open: true,
    },
  ],
});

/** One generated study, owning its generation identity and nothing invented. */
const generated = (): IAutoMovieGeneratedAcquisition => ({
  provider: "image-generation-service",
  model: "diffusion-xl-2026-03",
  request: "req_8f21",
  prompt: "Quarter view of a timber garden pavilion under a flat roof.",
  promptDigest: PROMPT_DIGEST,
  inputs: ["public/design-references/pavilion-plan.png"],
  outputDigest: STUDY_DIGEST,
  reproducible: false,
  seed: null,
});

/** Citations an authored pavilion class makes against the observation. */
const evidence = (): IAutoMovieDesignEvidence[] => [
  {
    subject: "pavilion/wall-west",
    document: "pavilion-plan",
    candidates: ["wall-west"],
    rationale:
      "The west run is the only unambiguous centreline on the sheet, so the authored wall follows it directly.",
  },
  {
    subject: "pavilion/wall-north",
    document: "pavilion-plan",
    candidates: ["wall-north-outer", "wall-north-inner"],
    rationale:
      "Both north centrelines are cited on purpose: the authored wall was placed on the outer reading, and the disagreement stays visible instead of being deleted.",
  },
];

/**
 * The exact violation paths one mutation produces, so a refusal is pinned to
 * the field the author wrote rather than to "something failed".
 */
const refusalPaths = (
  mutate: (value: IAutoMovieDesignReference) => void,
): string[] => {
  const value = observation();
  mutate(value);
  const validation = validateDesignReference({ reference: value });
  return validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);
};

/**
 * An observed drawing is evidence, and evidence is a different kind of thing
 * from a design. This pins the four layers a reference keeps apart — how a
 * sheet is read, what was on it, what someone proposed it meant, and what is
 * still undecided — and pins that a reading which was never taken is recorded
 * as `unsupported` or `not-run` rather than as a clean sheet. It also pins the
 * two ledgers that keep the boundary honest: an acquisition record that admits
 * generated bytes have no source URL, and citations that must point at readings
 * which actually exist.
 *
 * Scenarios:
 *
 * 1. A two-frame pavilion sheet with a settled plan scale, an unsettled section
 *    scale, competing wall centrelines, an occluded door and two barren
 *    analyses validates as a coherent observation.
 * 2. The unsettled section keeps both scale readings and chooses neither, and
 *    naming a scale candidate that was never recorded is refused: an unknown
 *    scale is a fact about the drawing, not a gap to fill in.
 * 3. An `observed` analysis that produced nothing is refused, and so is an
 *    `unsupported` or `not-run` analysis that smuggles a reading through, so
 *    the three outcomes cannot be swapped for each other.
 * 4. One candidate cannot be produced by two analyses, nor named twice by one, so
 *    a reading has exactly one origin story; and an analysis cannot file a
 *    candidate built from marks on a sheet it never says it read.
 * 5. Generated bytes record provider, model, request, prompt digest, inputs and
 *    output digest, and are accepted with no source URL and no seed at all.
 * 6. A generation that claims to be reproducible without a seed is refused, while
 *    an irreproducible one carrying a seed is warned about rather than failed:
 *    the seed is decoration, not a defect in the bytes.
 * 7. A fractional, infinite, `NaN` or beyond-2^53 seed is refused outright at
 *    either reproducibility, because such a value names no draw a provider
 *    could have made; a negative whole seed is a real one and is accepted.
 * 8. A generated output digest is checked against the current bytes, and the check
 *    is skipped exactly when recorded processing has replaced them.
 * 9. Citations resolve to real documents and real candidates, may deliberately
 *    cite two competing readings at once, and are refused when they dangle,
 *    repeat, or carry no reason.
 * 10. Every malformed observation, including a rival or an issue subject listed
 *     twice, is refused at its own path.
 * 11. The untouched fixture produces no violation path at all.
 */
export const test_architecture_design_reference = (): void => {
  const source = observation();
  TestValidator.equals(
    "an observed pavilion sheet validates as evidence",
    validateDesignReference({ reference: source }).success,
    true,
  );
  TestValidator.equals(
    "the unsettled section chooses no scale while keeping both readings",
    [source.frames[1]!.scale, source.frames[1]!.scaleCandidates.length],
    [null, 2],
  );
  TestValidator.equals(
    "the two barren analyses are recorded as unsupported and not-run",
    source.analyses.map((analysis) => analysis.outcome.status),
    ["observed", "unsupported", "not-run"],
  );

  // 5-8. The generated acquisition ledger.
  TestValidator.equals(
    "a generated study with no source URL and no seed is complete provenance",
    validateGeneratedAcquisition({
      acquisition: generated(),
      digest: STUDY_DIGEST,
    }).success,
    true,
  );
  TestValidator.equals(
    "a text-only generation with no prompt text and no request id is accepted",
    validateGeneratedAcquisition({
      acquisition: {
        ...generated(),
        request: null,
        prompt: null,
        inputs: [],
      },
      digest: STUDY_DIGEST,
    }).success,
    true,
  );
  TestValidator.predicate(
    "a reproducible claim with no seed is refused",
    hasViolation(
      validateGeneratedAcquisition({
        acquisition: { ...generated(), reproducible: true },
        digest: STUDY_DIGEST,
      }),
      "type",
      "$input.seed",
    ),
  );
  TestValidator.equals(
    "a reproducible claim carrying its seed is accepted",
    validateGeneratedAcquisition({
      acquisition: { ...generated(), reproducible: true, seed: 4211 },
      digest: STUDY_DIGEST,
    }).success,
    true,
  );
  const decorated = validateGeneratedAcquisition({
    acquisition: { ...generated(), seed: 4211 },
    digest: STUDY_DIGEST,
  });
  TestValidator.predicate(
    "a seed on an irreproducible generation warns instead of failing",
    validationHasWarning(
      "irreproducible generation carrying a seed",
      decorated,
      "type",
      "$input.seed",
    ) &&
      validationHasWarningCount(
        "irreproducible generation carrying a seed",
        decorated,
        1,
      ),
  );
  const seedRefusals: ReadonlyArray<readonly [string, number]> = [
    ["a fractional seed", 4211.5],
    ["an infinite seed", Number.POSITIVE_INFINITY],
    ["a NaN seed", Number.NaN],
    ["a seed beyond exact integer range", 2 ** 53],
  ];
  seedRefusals.forEach(([name, seed]) => {
    TestValidator.predicate(
      `${name} is refused rather than accepted as a replay handle`,
      hasViolation(
        validateGeneratedAcquisition({
          acquisition: { ...generated(), reproducible: true, seed },
          digest: STUDY_DIGEST,
        }),
        "range",
        "$input.seed",
      ),
    );
    const irreproducible = validateGeneratedAcquisition({
      acquisition: { ...generated(), seed },
      digest: STUDY_DIGEST,
    });
    TestValidator.predicate(
      `${name} on an irreproducible generation fails outright rather than warning`,
      hasViolation(irreproducible, "range", "$input.seed") &&
        violationCount(irreproducible) === 1,
    );
  });
  TestValidator.equals(
    "a negative provider seed is a whole number and is accepted",
    validateGeneratedAcquisition({
      acquisition: { ...generated(), reproducible: true, seed: -1 },
      digest: STUDY_DIGEST,
    }).success,
    true,
  );

  TestValidator.predicate(
    "a generated output digest that is not the current bytes is refused",
    hasViolation(
      validateGeneratedAcquisition({
        acquisition: generated(),
        digest: PLAN_DIGEST,
      }),
      "type",
      "$input.outputDigest",
    ),
  );
  TestValidator.equals(
    "processed bytes skip the output-digest comparison rather than fail it",
    validateGeneratedAcquisition({
      acquisition: generated(),
      digest: null,
    }).success,
    true,
  );
  const acquisitionRefusals: ReadonlyArray<
    readonly [string, (value: IAutoMovieGeneratedAcquisition) => void, string]
  > = [
    ["blank provider", (value) => (value.provider = "  "), "$input.provider"],
    ["blank model", (value) => (value.model = ""), "$input.model"],
    ["blank request id", (value) => (value.request = " "), "$input.request"],
    ["blank prompt", (value) => (value.prompt = " "), "$input.prompt"],
    [
      "malformed prompt digest",
      (value) => (value.promptDigest = "sha256:zz" as AutoMovieContentDigest),
      "$input.promptDigest",
    ],
    [
      "malformed output digest",
      (value) => (value.outputDigest = "md5:abc" as AutoMovieContentDigest),
      "$input.outputDigest",
    ],
    ["blank input path", (value) => (value.inputs[0] = ""), "$input.inputs[0]"],
  ];
  acquisitionRefusals.forEach(([name, mutate, path]) => {
    const value = generated();
    mutate(value);
    TestValidator.predicate(
      `${name} is refused at ${path}`,
      hasViolation(
        validateGeneratedAcquisition({ acquisition: value, digest: null }),
        "type",
        path,
      ),
    );
  });

  // 9. Citations.
  TestValidator.equals(
    "citations that resolve, including one deliberately citing both readings",
    validateDesignEvidence({
      references: [source],
      evidence: evidence(),
    }).success,
    true,
  );
  TestValidator.equals(
    "an empty citation ledger is a clean success rather than a silent gap",
    validateDesignEvidence({ references: [source], evidence: [] }).success,
    true,
  );
  const evidenceRefusals: ReadonlyArray<
    readonly [string, (value: IAutoMovieDesignEvidence[]) => void, string]
  > = [
    [
      "blank subject",
      (value) => (value[0]!.subject = " "),
      "$input.evidence[0].subject",
    ],
    [
      "blank rationale",
      (value) => (value[0]!.rationale = ""),
      "$input.evidence[0].rationale",
    ],
    [
      "dangling document",
      (value) => (value[0]!.document = "ghost-sheet"),
      "$input.evidence[0].document",
    ],
    [
      "no cited candidate",
      (value) => (value[0]!.candidates = []),
      "$input.evidence[0].candidates",
    ],
    [
      "dangling candidate",
      (value) => (value[0]!.candidates[0] = "wall-ghost"),
      "$input.evidence[0].candidates[0]",
    ],
    [
      "repeated candidate for one subject",
      (value) => value[1]!.candidates.push("wall-north-outer"),
      "$input.evidence[1].candidates[2]",
    ],
  ];
  evidenceRefusals.forEach(([name, mutate, path]) => {
    const value = evidence();
    mutate(value);
    const validation = validateDesignEvidence({
      references: [source],
      evidence: value,
    });
    TestValidator.predicate(
      `${name} evidence is refused at ${path}`,
      validation.success === false &&
        validation.violations.some((violation) => violation.path === path),
    );
  });
  TestValidator.equals(
    "two documents sharing one id pool their candidates for citation",
    validateDesignEvidence({
      references: [
        { ...source, candidates: [source.candidates[0]!] },
        { ...source, candidates: [source.candidates[2]!] },
      ],
      evidence: [evidence()[0]!],
    }).success,
    true,
  );

  // 10. Malformed observations.
  const malformed: ReadonlyArray<
    readonly [string, (value: IAutoMovieDesignReference) => void, string]
  > = [
    ["blank document id", (value) => (value.id = " "), "$input.id"],
    [
      "wrong schema version",
      (value) => ((value as { version: number }).version = 2),
      "$input.version",
    ],
    ["blank asset path", (value) => (value.asset = ""), "$input.asset"],
    [
      "malformed digest",
      (value) => (value.digest = "sha1:abcd" as AutoMovieContentDigest),
      "$input.digest",
    ],
    [
      "unregistrable media",
      (value) =>
        (value.media = "image/gif" as IAutoMovieDesignReference["media"]),
      "$input.media",
    ],
    ["no frame at all", (value) => (value.frames = []), "$input.frames"],
    [
      "blank frame id",
      (value) => (value.frames[0]!.id = ""),
      "$input.frames[0].id",
    ],
    [
      "duplicate frame id",
      (value) => (value.frames[1]!.id = "plan-1"),
      "$input.frames[1].id",
    ],
    [
      "unknown drawing view",
      (value) =>
        (value.frames[0]!.view =
          "isometric" as IAutoMovieDesignReference["frames"][number]["view"]),
      "$input.frames[0].view",
    ],
    [
      "zeroth page",
      (value) => (value.frames[0]!.page = 0),
      "$input.frames[0].page",
    ],
    [
      "fractional page",
      (value) => (value.frames[0]!.page = 1.5),
      "$input.frames[0].page",
    ],
    [
      "blank level label",
      (value) => (value.frames[0]!.level = " "),
      "$input.frames[0].level",
    ],
    [
      "zero sheet width",
      (value) => (value.frames[0]!.bounds.width = 0),
      "$input.frames[0].bounds.width",
    ],
    [
      "non-finite sheet height",
      (value) => (value.frames[0]!.bounds.height = Number.NaN),
      "$input.frames[0].bounds.height",
    ],
    [
      "anchor left of the sheet",
      (value) => (value.frames[0]!.anchor.x = -1),
      "$input.frames[0].anchor.x",
    ],
    [
      "anchor below the sheet",
      (value) => (value.frames[0]!.anchor.y = 801),
      "$input.frames[0].anchor.y",
    ],
    [
      "non-finite anchor",
      (value) => (value.frames[0]!.anchor.x = Number.NaN),
      "$input.frames[0].anchor.x",
    ],
    [
      "blank scale candidate id",
      (value) => (value.frames[0]!.scaleCandidates[0]!.id = ""),
      "$input.frames[0].scaleCandidates[0].id",
    ],
    [
      "duplicate scale candidate id",
      (value) => (value.frames[1]!.scaleCandidates[1]!.id = "section-fifty"),
      "$input.frames[1].scaleCandidates[1].id",
    ],
    [
      "non-positive metres per unit",
      (value) => (value.frames[0]!.scaleCandidates[0]!.metersPerUnit = 0),
      "$input.frames[0].scaleCandidates[0].metersPerUnit",
    ],
    [
      "non-finite metres per unit",
      (value) =>
        (value.frames[0]!.scaleCandidates[0]!.metersPerUnit =
          Number.POSITIVE_INFINITY),
      "$input.frames[0].scaleCandidates[0].metersPerUnit",
    ],
    [
      "confidence above one",
      (value) => (value.frames[0]!.scaleCandidates[0]!.confidence = 1.5),
      "$input.frames[0].scaleCandidates[0].confidence",
    ],
    [
      "blank scale basis",
      (value) => (value.frames[0]!.scaleCandidates[0]!.basis = " "),
      "$input.frames[0].scaleCandidates[0].basis",
    ],
    [
      "settled scale naming no candidate",
      (value) => (value.frames[1]!.scale = "section-two-hundred"),
      "$input.frames[1].scale",
    ],
    [
      "zero x axis",
      (value) => (value.frames[0]!.axisX = { x: 0, y: 0, z: 0 }),
      "$input.frames[0].axisX",
    ],
    [
      "non-finite x axis",
      (value) => (value.frames[0]!.axisX.x = Number.POSITIVE_INFINITY),
      "$input.frames[0].axisX.x",
    ],
    [
      "zero y axis",
      (value) => (value.frames[0]!.axisY = { x: 0, y: 0, z: 0 }),
      "$input.frames[0].axisY",
    ],
    [
      "y axis parallel to x",
      (value) => (value.frames[0]!.axisY = { x: 2, y: 0, z: 0 }),
      "$input.frames[0].axisY",
    ],
    [
      "zero up direction",
      (value) => (value.frames[0]!.up = { x: 0, y: 0, z: 0 }),
      "$input.frames[0].up",
    ],
    [
      "zero north direction",
      (value) => (value.frames[0]!.north = { x: 0, y: 0, z: 0 }),
      "$input.frames[0].north",
    ],
    [
      "non-finite origin",
      (value) => (value.frames[0]!.origin.x = Number.NaN),
      "$input.frames[0].origin.x",
    ],
    [
      "non-unit frame rotation",
      (value) => (value.frames[1]!.transform!.rotation.w = 0.5),
      "$input.frames[1].transform.rotation",
    ],
    [
      "blank primitive id",
      (value) => (value.primitives[0]!.id = " "),
      "$input.primitives[0].id",
    ],
    [
      "duplicate primitive id",
      (value) => (value.primitives[1]!.id = "north-outer"),
      "$input.primitives[1].id",
    ],
    [
      "primitive on an unknown frame",
      (value) => (value.primitives[0]!.frame = "plan-2"),
      "$input.primitives[0].frame",
    ],
    [
      "unknown primitive kind",
      (value) =>
        (value.primitives[0]!.kind =
          "spline" as IAutoMovieDesignReference["primitives"][number]["kind"]),
      "$input.primitives[0].kind",
    ],
    [
      "three-point line",
      (value) => value.primitives[0]!.points.push({ x: 0, y: 0 }),
      "$input.primitives[0].points",
    ],
    [
      "single-point polyline",
      (value) => (value.primitives[2]!.points.length = 1),
      "$input.primitives[2].points",
    ],
    [
      "two-point region",
      (value) => (value.primitives[3]!.points.length = 2),
      "$input.primitives[3].points",
    ],
    [
      "two-point arc",
      (value) => (value.primitives[4]!.points.length = 2),
      "$input.primitives[4].points",
    ],
    [
      "non-finite observed point",
      (value) => (value.primitives[0]!.points[0]!.x = Number.NaN),
      "$input.primitives[0].points[0].x",
    ],
    [
      "a mark drawn past the right edge of its own sheet",
      (value) => (value.primitives[0]!.points[0]!.x = 5000),
      "$input.primitives[0].points[0].x",
    ],
    [
      "a mark drawn above the top edge of its own sheet",
      (value) => (value.primitives[0]!.points[0]!.y = -5),
      "$input.primitives[0].points[0].y",
    ],
    [
      "text primitive with no text",
      (value) => (value.primitives[5]!.text = null),
      "$input.primitives[5].text",
    ],
    [
      "level marker with blank text",
      (value) => (value.primitives[6]!.text = "  "),
      "$input.primitives[6].text",
    ],
    [
      "geometric primitive carrying text",
      (value) => (value.primitives[0]!.text = "WALL"),
      "$input.primitives[0].text",
    ],
    [
      "blank issue id",
      (value) => (value.issues[0]!.id = ""),
      "$input.issues[0].id",
    ],
    [
      "duplicate issue id",
      (value) => (value.issues[1]!.id = "door-occluded"),
      "$input.issues[1].id",
    ],
    [
      "unknown issue kind",
      (value) =>
        (value.issues[0]!.kind =
          "smudged" as IAutoMovieDesignReference["issues"][number]["kind"]),
      "$input.issues[0].kind",
    ],
    [
      "blank issue detail",
      (value) => (value.issues[0]!.detail = " "),
      "$input.issues[0].detail",
    ],
    [
      "issue about nothing",
      (value) => (value.issues[0]!.subjects = []),
      "$input.issues[0].subjects",
    ],
    [
      "issue about an unknown subject",
      (value) => (value.issues[0]!.subjects[0] = "ghost"),
      "$input.issues[0].subjects[0]",
    ],
    [
      "issue naming one subject twice",
      (value) => value.issues[0]!.subjects.push("door-swing"),
      "$input.issues[0].subjects[2]",
    ],
    [
      "blank candidate id",
      (value) => (value.candidates[0]!.id = " "),
      "$input.candidates[0].id",
    ],
    [
      "duplicate candidate id",
      (value) => (value.candidates[1]!.id = "wall-north-outer"),
      "$input.candidates[1].id",
    ],
    [
      "blank candidate semantic",
      (value) => (value.candidates[0]!.semantic = ""),
      "$input.candidates[0].semantic",
    ],
    [
      "candidate reading nothing",
      (value) => (value.candidates[0]!.primitives = []),
      "$input.candidates[0].primitives",
    ],
    [
      "candidate reading an unknown primitive",
      (value) => (value.candidates[0]!.primitives[0] = "ghost-line"),
      "$input.candidates[0].primitives[0]",
    ],
    [
      "candidate reading one primitive twice",
      (value) => value.candidates[0]!.primitives.push("north-outer"),
      "$input.candidates[0].primitives[1]",
    ],
    [
      "negative candidate confidence",
      (value) => (value.candidates[0]!.confidence = -0.1),
      "$input.candidates[0].confidence",
    ],
    [
      "alternative that does not resolve",
      (value) => (value.candidates[0]!.alternatives[0] = "wall-ghost"),
      "$input.candidates[0].alternatives[0]",
    ],
    [
      "candidate listed as its own alternative",
      (value) => (value.candidates[0]!.alternatives[0] = "wall-north-outer"),
      "$input.candidates[0].alternatives[0]",
    ],
    [
      "candidate naming one rival twice",
      (value) => value.candidates[0]!.alternatives.push("wall-north-inner"),
      "$input.candidates[0].alternatives[1]",
    ],
    [
      "candidate blocked by an unknown issue",
      (value) => (value.candidates[1]!.issues[0] = "ghost-issue"),
      "$input.candidates[1].issues[0]",
    ],
    [
      "candidate listing one issue twice",
      (value) => value.candidates[1]!.issues.push("door-occluded"),
      "$input.candidates[1].issues[1]",
    ],
    [
      "blank analysis id",
      (value) => (value.analyses[0]!.id = ""),
      "$input.analyses[0].id",
    ],
    [
      "duplicate analysis id",
      (value) => (value.analyses[1]!.id = "wall-centerline"),
      "$input.analyses[1].id",
    ],
    [
      "blank analysis subject",
      (value) => (value.analyses[0]!.subject = " "),
      "$input.analyses[0].subject",
    ],
    [
      "analysis of an unknown frame",
      (value) => (value.analyses[0]!.frame = "plan-9"),
      "$input.analyses[0].frame",
    ],
    [
      "an observed analysis that observed nothing",
      (value) =>
        (value.analyses[0]!.outcome = { status: "observed", candidates: [] }),
      "$input.analyses[0].outcome.candidates",
    ],
    [
      "an observed analysis naming an unknown candidate",
      (value) =>
        (value.analyses[0]!.outcome = {
          status: "observed",
          candidates: ["wall-ghost"],
        }),
      "$input.analyses[0].outcome.candidates[0]",
    ],
    [
      "one candidate produced by two analyses",
      (value) =>
        (value.analyses[1]!.outcome = {
          status: "observed",
          candidates: ["wall-west"],
        }),
      "$input.analyses[1].outcome.candidates[0]",
    ],
    [
      "one analysis naming its own candidate twice",
      (value) =>
        (value.analyses[0]!.outcome = {
          status: "observed",
          candidates: ["wall-west", "wall-west"],
        }),
      "$input.analyses[0].outcome.candidates[1]",
    ],
    [
      "an analysis filing readings taken off another sheet",
      (value) => (value.analyses[0]!.frame = "section-1"),
      "$input.analyses[0].outcome.candidates[0]",
    ],
    [
      "unsupported without a reason",
      (value) =>
        (value.analyses[1]!.outcome = { status: "unsupported", reason: " " }),
      "$input.analyses[1].outcome.reason",
    ],
    [
      "not-run without a reason",
      (value) =>
        (value.analyses[2]!.outcome = { status: "not-run", reason: "" }),
      "$input.analyses[2].outcome.reason",
    ],
    [
      "an outcome status nobody defined",
      (value) =>
        (value.analyses[1]!.outcome = {
          status: "guessed",
        } as unknown as IAutoMovieDesignReference["analyses"][number]["outcome"]),
      "$input.analyses[1].outcome.status",
    ],
  ];
  malformed.forEach(([name, mutate, path]) =>
    TestValidator.equals(
      `${name} is refused at ${path}`,
      refusalPaths(mutate).includes(path),
      true,
    ),
  );
  TestValidator.equals(
    "the untouched observation produces no violation path at all",
    refusalPaths(() => {}),
    [],
  );
  TestValidator.equals(
    "one malformed field produces exactly one refusal",
    violationCount(
      validateDesignReference({
        reference: { ...observation(), id: "" },
      }),
    ),
    1,
  );
};
