import {
  promoteDesignObservations,
  validateDesignEvidence,
  validateDesignReference,
} from "@automovie/engine";
import type {
  IAutoMovieDesignEvidence,
  IAutoMovieDesignPromotion,
  IAutoMovieDesignReference,
} from "@automovie/interface";

/**
 * Observing a plan, and then designing a building anyway.
 *
 * ## The one rule this example exists to teach
 *
 * A plan image is never turned into a building. There is no import step, no
 * "trace this PNG", no automatic wall extraction. What a drawing gives you is
 * an OBSERVATION: the marks that are on the sheet, one or more proposed
 * meanings for them, and an honest list of everything still undecided. The
 * building itself is written by you, in TypeScript, exactly as it is in
 * `examples/buildings.ts` : and it CITES the observation as its reason.
 *
 * That asymmetry is the point. If a sheet is ambiguous, the ambiguity survives
 * in the record instead of being silently resolved by whoever ran the reader
 * last. If a scale was never legible, the design says so rather than inheriting
 * a number nobody measured.
 *
 * ## Registering the bytes
 *
 * The observed file lives with the project's other assets and is registered in
 * `automovie/assets.json` with a `design-reference` use naming the document id
 * below. Bytes that a model produced record `generated` : provider, model,
 * request, prompt digest, inputs, output digest : instead of `original`, so a
 * study that no URL ever served does not have to invent one.
 *
 * ## What "unsupported" and "not-run" mean here
 *
 * They mean what they say. `opening-detection` below is `unsupported` because
 * this host reads no door-symbol library, and `storey-datum` is `not-run`
 * because there was nothing worth running it against. Neither is reported as a
 * clean sheet, and neither becomes a door or a level by default.
 */
export const OBSERVED_PAVILION_PLAN: IAutoMovieDesignReference = {
  version: 1,
  id: "pavilion-plan",
  asset: "public/design-references/pavilion-plan.png",
  // The SHA-256 of the registered bytes at the moment they were read. A change
  // here is what makes the compiler call an old observation stale.
  digest:
    "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  media: "image/png",
  frames: [
    {
      id: "plan-1",
      page: 1,
      view: "plan",
      level: "ground",
      // Pixels for a raster sheet; user units for a vector one.
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
      // Settled, because the bar was legible. Leave this null when it is not:
      // an unknown scale is a fact about the drawing, not a blank to fill in.
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
      id: "opening-detection",
      frame: "plan-1",
      subject: "opening",
      outcome: {
        status: "unsupported",
        reason:
          "This project reads no door symbol library, so swing arcs are not resolved into openings.",
      },
    },
    {
      id: "storey-datum",
      frame: "plan-1",
      subject: "storey-datum",
      outcome: {
        status: "not-run",
        reason: "The sheet carries no section, so no datum read was attempted.",
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
    // Two readings of the same wall. Neither is promoted, and neither is
    // deleted: the disagreement is the useful part of the record.
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
  ],
  issues: [
    {
      id: "door-occluded",
      kind: "occluded",
      subjects: ["wall-north-inner"],
      detail:
        "A planter hatch covers the door jamb, so the opening width cannot be read from this sheet.",
      open: true,
    },
  ],
};

/**
 * The citations an authored pavilion class makes back to the sheet.
 *
 * Note the second entry: it deliberately cites BOTH north readings. The
 * authored wall had to sit somewhere, so the author chose one and wrote down
 * why : but the competing reading stays attached to the decision instead of
 * disappearing the moment a wall existed.
 */
export const PAVILION_DESIGN_EVIDENCE: IAutoMovieDesignEvidence[] = [
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
      "Both centrelines are cited on purpose: the authored wall sits on the outer reading because the roof overhang is dimensioned from it, and the inner reading stays recorded so a later survey can overturn the choice.",
  },
];

/**
 * Ask the sheet for metres and read the refusals.
 *
 * Run this while authoring: the interesting half of the answer is `withheld`
 * and `skipped`, not `promoted`. Out of three readings, exactly one becomes
 * geometry; the two north candidates stay observations because they contradict
 * each other, and two analyses report that they produced nothing. Feeding
 * `promoted` into a building is optional and manual : it is a proposal, not the
 * design.
 */
export const readPavilionPlan = (): IAutoMovieDesignPromotion => {
  const validated = validateDesignReference({
    reference: OBSERVED_PAVILION_PLAN,
  });
  if (validated.success === false)
    throw new Error(
      `the observed pavilion plan is not a coherent observation: ${validated.violations[0]!.path}`,
    );
  const cited = validateDesignEvidence({
    references: [OBSERVED_PAVILION_PLAN],
    evidence: PAVILION_DESIGN_EVIDENCE,
  });
  if (cited.success === false)
    throw new Error(
      `the pavilion cites evidence that does not resolve: ${cited.violations[0]!.path}`,
    );
  // The default confidence floor is 1: nothing but a certain, unopposed,
  // unblocked, scaled reading promotes. Lower it consciously or not at all.
  return promoteDesignObservations({ reference: OBSERVED_PAVILION_PLAN });
};
