import {
  designFrameScale,
  designReferenceWorldPoint,
  promoteDesignObservations,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignReference,
  IAutoMovieDesignSourceFrame,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError, vclose } from "../internal/predicates";

const PLAN_DIGEST =
  "sha256:1111111111111111111111111111111111111111111111111111111111111111" as AutoMovieContentDigest;

/** The settled raster plan: one centimetre of sheet is one centimetre of wall. */
const planFrame = (): IAutoMovieDesignSourceFrame => ({
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
});

/** The unsettled section: two plausible scales and no chosen one. */
const sectionFrame = (): IAutoMovieDesignSourceFrame => ({
  ...planFrame(),
  id: "section-1",
  view: "section",
  level: null,
  scaleCandidates: [
    {
      id: "fifty",
      metersPerUnit: 0.02,
      confidence: 0.4,
      basis: "assumed 1:50",
    },
    {
      id: "hundred",
      metersPerUnit: 0.04,
      confidence: 0.4,
      basis: "assumed 1:100",
    },
  ],
  scale: null,
  axisY: { x: 0, y: -1, z: 0 },
  north: null,
});

/**
 * The same pavilion sheet, arranged so every promotion verdict is reachable:
 * one clean west run, two competing north centrelines, one occluded door, a
 * label that is text rather than geometry, a section line whose scale nobody
 * settled, a reading no analysis ever claimed, and two analyses that produced
 * nothing at all.
 */
const observation = (): IAutoMovieDesignReference => ({
  version: 1,
  id: "pavilion-plan",
  asset: "public/design-references/pavilion-plan.png",
  digest: PLAN_DIGEST,
  media: "image/png",
  frames: [planFrame(), sectionFrame()],
  primitives: [
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
      id: "room-label",
      frame: "plan-1",
      kind: "text",
      points: [{ x: 400, y: 300 }],
      text: "PAVILION",
    },
    {
      id: "section-wall",
      frame: "section-1",
      kind: "line",
      points: [
        { x: 200, y: 600 },
        { x: 200, y: 200 },
      ],
      text: null,
    },
    {
      id: "stray-run",
      frame: "plan-1",
      kind: "line",
      points: [
        { x: 20, y: 20 },
        { x: 40, y: 20 },
      ],
      text: null,
    },
  ],
  analyses: [
    {
      id: "wall-centerline",
      frame: "plan-1",
      subject: "wall-centerline",
      outcome: {
        status: "observed",
        candidates: ["wall-west", "wall-north-outer", "wall-north-inner"],
      },
    },
    {
      id: "label-read",
      frame: "plan-1",
      subject: "room-label",
      outcome: { status: "observed", candidates: ["room-name"] },
    },
    {
      id: "section-wall-read",
      frame: "section-1",
      subject: "wall-centerline",
      outcome: { status: "observed", candidates: ["section-wall-line"] },
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
      id: "storey-datum",
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
      id: "wall-west",
      semantic: "wall-centerline",
      primitives: ["west-run"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
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
      id: "room-name",
      semantic: "room-label",
      primitives: ["room-label"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
    {
      id: "section-wall-line",
      semantic: "wall-centerline",
      primitives: ["section-wall"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
    {
      id: "stray-reading",
      semantic: "wall-centerline",
      primitives: ["stray-run"],
      confidence: 1,
      alternatives: [],
      issues: [],
    },
  ],
  issues: [
    {
      id: "door-occluded",
      kind: "occluded",
      subjects: ["wall-north-inner"],
      detail:
        "The planter hatch covers the door jamb, so the opening width cannot be read from this sheet.",
      open: true,
    },
  ],
});

/** Every withholding as `candidate:reason`, so a verdict is pinned per reading. */
const verdicts = (
  mutate: (value: IAutoMovieDesignReference) => void,
  minimumConfidence?: number,
): { promoted: string[]; withheld: string[]; skipped: string[] } => {
  const value = observation();
  mutate(value);
  const promotion = promoteDesignObservations(
    minimumConfidence === undefined
      ? { reference: value }
      : { reference: value, minimumConfidence },
  );
  return {
    promoted: promotion.promoted.map((entry) => entry.candidate),
    withheld: promotion.withheld.map(
      (entry) => `${entry.candidate}:${entry.reason}`,
    ),
    skipped: promotion.skipped.map(
      (entry) => `${entry.analysis}:${entry.status}`,
    ),
  };
};

/**
 * Asking a plan for metres is the one place an image could quietly become a
 * design, so this pins that the answer is a refusal by default and a proposal
 * at best. Every candidate lands in exactly one pile, each withholding names
 * the fact that blocked it, and every analysis that produced nothing is carried
 * out with its own `unsupported` or `not-run` word rather than dropped. The
 * metric half is pinned against hand arithmetic, not against whatever the code
 * currently emits.
 *
 * Scenarios:
 *
 * 1. Out of six readings of one sheet, exactly one promotes: the rest are withheld
 *    as ambiguous, blocked, non-geometric, unscaled, or unclaimed, and the two
 *    barren analyses are reported as skipped rather than as silence.
 * 2. Two competing centrelines are both withheld, and neither is chosen by
 *    confidence, count, or order: ambiguity is not broken by the engine.
 * 3. Deleting the competition is not enough — a 0.6 reading still fails the
 *    default certainty floor, and clears it only when the caller lowers the bar
 *    on purpose.
 * 4. An open issue blocks promotion even at full confidence; closing the issue
 *    releases exactly that candidate and nothing else.
 * 5. A text label never becomes geometry, and an unsettled section scale is
 *    refused rather than resolved to either of its two candidates.
 * 6. A reading no analysis produced is withheld as unobserved, so a candidate
 *    cannot enter the design by simply existing.
 * 7. Promotion is a pure function of the record: the same reference promotes to
 *    the same metres twice, and the source observation is not mutated.
 * 8. The mapping from sheet to world is hand-checked, including the frame's
 *    optional placement transform, and refuses outright on an unsettled scale.
 * 9. A degenerate axis maps without dividing by zero rather than producing a NaN
 *    coordinate.
 * 10. An invalid reference and an out-of-range confidence floor both throw instead
 *     of returning a partial promotion.
 */
export const test_architecture_design_observation_promotion = (): void => {
  const base = verdicts(() => {});
  TestValidator.equals(
    "one clean run promotes and every other reading is withheld with its reason",
    base,
    {
      promoted: ["wall-west"],
      withheld: [
        "wall-north-outer:ambiguous-candidate",
        "wall-north-inner:ambiguous-candidate",
        "room-name:unsupported-geometry",
        "section-wall-line:unknown-scale",
        "stray-reading:unobserved",
      ],
      skipped: ["opening-detection:unsupported", "storey-datum:not-run"],
    },
  );

  TestValidator.equals(
    "the two competing centrelines are still both withheld at a floor they both clear",
    verdicts(() => {}, 0.5).withheld.slice(0, 2),
    [
      "wall-north-outer:ambiguous-candidate",
      "wall-north-inner:ambiguous-candidate",
    ],
  );

  const unopposed = (value: IAutoMovieDesignReference): void => {
    value.candidates[1]!.alternatives = [];
    value.candidates[2]!.alternatives = [];
  };
  TestValidator.equals(
    "an unopposed 0.6 reading still fails the default certainty floor",
    verdicts(unopposed).withheld.slice(0, 2),
    ["wall-north-outer:low-confidence", "wall-north-inner:open-issue"],
  );
  TestValidator.equals(
    "lowering the floor on purpose releases the unopposed, unblocked reading only",
    verdicts(unopposed, 0.5),
    {
      promoted: ["wall-west", "wall-north-outer"],
      withheld: [
        "wall-north-inner:open-issue",
        "room-name:unsupported-geometry",
        "section-wall-line:unknown-scale",
        "stray-reading:unobserved",
      ],
      skipped: ["opening-detection:unsupported", "storey-datum:not-run"],
    },
  );
  TestValidator.equals(
    "closing the occlusion issue releases exactly the candidate it blocked",
    verdicts((value) => {
      unopposed(value);
      value.issues[0]!.open = false;
    }, 0.5).promoted,
    ["wall-west", "wall-north-outer", "wall-north-inner"],
  );
  TestValidator.equals(
    "settling the section scale releases the section line and nothing else",
    verdicts((value) => (value.frames[1]!.scale = "fifty")).promoted,
    ["wall-west", "section-wall-line"],
  );
  TestValidator.equals(
    "claiming the stray reading turns it from unobserved into a promotion",
    verdicts((value) =>
      value.analyses[0]!.outcome.status === "observed"
        ? value.analyses[0]!.outcome.candidates.push("stray-reading")
        : undefined,
    ).promoted,
    ["wall-west", "stray-reading"],
  );

  // 7. Determinism and non-mutation.
  const source = observation();
  const first = promoteDesignObservations({ reference: source });
  const second = promoteDesignObservations({ reference: source });
  TestValidator.equals(
    "the same reference promotes to the same metres twice",
    first,
    second,
  );
  TestValidator.equals(
    "promotion leaves the observation exactly as it was read",
    source,
    observation(),
  );
  TestValidator.predicate(
    "the promoted west run is the hand-computed metric polyline",
    first.promoted[0]!.outlines[0]!.length === 3 &&
      vclose(first.promoted[0]!.outlines[0]![0]!, { x: 1, y: 0, z: 1 }) &&
      vclose(first.promoted[0]!.outlines[0]![1]!, { x: 1, y: 0, z: 5 }) &&
      vclose(first.promoted[0]!.outlines[0]![2]!, { x: 3, y: 0, z: 5 }),
  );
  TestValidator.equals(
    "the promoted reading carries the candidate's own semantic label",
    first.promoted[0]!.semantic,
    "wall-centerline",
  );

  // 8. The sheet-to-world mapping.
  TestValidator.predicate(
    "a point left and above the anchor maps to negative metres",
    vclose(designReferenceWorldPoint(planFrame(), { x: -50, y: -100 }), {
      x: -0.5,
      y: 0,
      z: -1,
    }),
  );
  TestValidator.predicate(
    "an unnormalized axis states a direction rather than a magnitude",
    vclose(
      designReferenceWorldPoint(
        { ...planFrame(), axisX: { x: 3, y: 0, z: 0 } },
        { x: 200, y: 0 },
      ),
      { x: 2, y: 0, z: 0 },
    ),
  );
  TestValidator.predicate(
    "the frame placement transform scales, rotates, then translates the mapping",
    vclose(
      designReferenceWorldPoint(
        {
          ...planFrame(),
          transform: {
            translation: { x: 10, y: 1, z: -2 },
            rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
            scale: { x: 2, y: 2, z: 2 },
          },
        },
        { x: 500, y: 400 },
      ),
      { x: 18, y: 1, z: -12 },
    ),
  );
  TestValidator.predicate(
    "a degenerate axis maps without dividing by zero",
    vclose(
      designReferenceWorldPoint(
        { ...planFrame(), axisX: { x: 0, y: 0, z: 0 } },
        { x: 500, y: 400 },
      ),
      { x: 0, y: 0, z: 4 },
    ),
  );
  TestValidator.predicate(
    "an unsettled scale refuses to produce a world position at all",
    throwsError(
      () => designReferenceWorldPoint(sectionFrame(), { x: 1, y: 1 }),
      ["section-1", "no settled scale"],
    ),
  );
  TestValidator.equals(
    "a settled frame reports its metres per unit and an unsettled one reports none",
    [
      designFrameScale(planFrame()),
      designFrameScale(sectionFrame()),
      designFrameScale({ ...sectionFrame(), scale: "ghost" }),
    ],
    [0.01, null, null],
  );

  // 10. Refusals.
  TestValidator.predicate(
    "an invalid reference throws instead of promoting part of it",
    throwsError(() => {
      const value = observation();
      value.candidates[0]!.primitives[0] = "ghost";
      promoteDesignObservations({ reference: value });
    }, ["pavilion-plan", "$input.candidates[0].primitives[0]"]),
  );
  [-0.1, 1.5, Number.NaN].forEach((floor) =>
    TestValidator.predicate(
      `a confidence floor of ${floor} is refused`,
      throwsError(
        () =>
          promoteDesignObservations({
            reference: observation(),
            minimumConfidence: floor,
          }),
        ["confidence floor"],
      ),
    ),
  );
  TestValidator.equals(
    "a floor of zero promotes every unopposed, unblocked, scaled reading",
    verdicts((value) => {
      unopposed(value);
      value.issues[0]!.open = false;
    }, 0).promoted,
    ["wall-west", "wall-north-outer", "wall-north-inner"],
  );
};
