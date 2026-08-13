import {
  type IAutoMovieInspectSubject,
  type IAutoMovieSubjectInspectionView,
  autoMovieSubjectInspectionPlan,
  autoMovieSubjectInspectionPose,
} from "@automovie/mcp";
import {
  autoMovieViewerTurntableViewpoints,
  frameAutoMovieViewerSubject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";

/** One elevation the size of a wall, and one mullion inside it. */
const ELEVATION = {
  min: { x: -25, y: 0, z: -0.4 },
  max: { x: 25, y: 18, z: 0.4 },
};
const MULLION = {
  min: { x: 3.11, y: 4.2, z: -0.025 },
  max: { x: 3.16, y: 6.4, z: 0.025 },
};

const LENS = { fovDeg: 35, aspect: 16 / 9 };
const RULE = {
  azimuthCount: 6,
  elevationsDeg: [20, -10],
  distanceFactor: 1.25,
};

/** What a caller must give before the plan will produce a viewpoint. */
const refusal = (act: () => unknown): string => {
  try {
    act();
    return "accepted";
  } catch (error) {
    return error instanceof RangeError ? "refused" : "wrong-error";
  }
};

/**
 * The tool surface and the in-process harness are one instrument.
 *
 * Scenarios:
 *
 * 1. For a 50 m elevation and a 0.05 m mullion alike, the plan the MCP surface
 *    states and the plan the viewer harness lays out name the same viewpoints
 *    in the same order and resolve to bit-identical camera state. That equality
 *    is what lets a reviewer looking through the browser and an authoring agent
 *    calling the tool argue about one object rather than two pictures.
 * 2. Framing comes from the subject's own extent, so the mullion is opened from
 *    centimetres away and the elevation from tens of metres under one rule, and
 *    a degenerate box is still framed instead of refused.
 * 3. Every impossible viewpoint rule is refused with a range error rather than
 *    silently normalised, including two elevation rings that would round to one
 *    viewpoint identity.
 * 4. An inspection answer cannot be handed to a consumer that requires delivery
 *    evidence; the refusal is in the type, not in a reviewer's memory.
 */
export const test_mcp_subject_inspection_parity = (): void => {
  for (const [label, bounds] of [
    ["elevation", ELEVATION],
    ["mullion", MULLION],
  ] as const) {
    const plan = autoMovieSubjectInspectionPlan({ bounds, ...RULE, ...LENS });
    const harness = autoMovieViewerTurntableViewpoints(RULE);
    TestValidator.equals(
      `the ${label} plan names the harness viewpoints in harness order`,
      plan.map((viewpoint) => viewpoint.id),
      harness.map((viewpoint) => viewpoint.id),
    );
    TestValidator.equals(
      `the ${label} resolves to the camera state the harness resolves`,
      plan.map((viewpoint) =>
        autoMovieSubjectInspectionPose({
          bounds,
          coordinateSpace: "world",
          viewpoint,
          ...LENS,
        }),
      ),
      harness.map((viewpoint) => {
        const pose = frameAutoMovieViewerSubject(bounds, viewpoint, LENS);
        return {
          coordinateSpace: "world" as const,
          position: pose.position,
          target: pose.target,
          fovDeg: pose.lens.fovDeg,
          aspect: pose.lens.aspect,
          near: pose.near,
          far: pose.far,
        };
      }),
    );
  }

  const elevation = autoMovieSubjectInspectionPlan({
    bounds: ELEVATION,
    ...RULE,
    ...LENS,
  })[0]!;
  const mullion = autoMovieSubjectInspectionPlan({
    bounds: MULLION,
    ...RULE,
    ...LENS,
  })[0]!;
  const degenerate = autoMovieSubjectInspectionPlan({
    bounds: { min: { x: 2, y: 1, z: 0 }, max: { x: 2, y: 1, z: 0 } },
    ...RULE,
    ...LENS,
  })[0]!;
  TestValidator.equals(
    "one rule frames a wall and a mullion at their own scales",
    {
      scaled: elevation.distance > mullion.distance * 100,
      mullionWithinReach: mullion.distance < 12,
      degenerateFramed:
        degenerate.distance > 0 && Number.isFinite(degenerate.distance),
      degenerateAtItsOwnPoint: autoMovieSubjectInspectionPose({
        bounds: { min: { x: 2, y: 1, z: 0 }, max: { x: 2, y: 1, z: 0 } },
        coordinateSpace: "model",
        viewpoint: degenerate,
        ...LENS,
      }).target,
    },
    {
      scaled: true,
      mullionWithinReach: true,
      degenerateFramed: true,
      degenerateAtItsOwnPoint: { x: 2, y: 1, z: 0 },
    },
  );

  TestValidator.equals(
    "an impossible viewpoint rule is refused rather than normalised",
    {
      fractionalAzimuths: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          azimuthCount: 1.5,
        }),
      ),
      noAzimuths: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          azimuthCount: 0,
        }),
      ),
      tooManyAzimuths: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          azimuthCount: 65,
        }),
      ),
      noRings: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          elevationsDeg: [],
        }),
      ),
      tooManyRings: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          elevationsDeg: [0, 5, 10, 15, 20, 25, 30, 35, 40],
        }),
      ),
      overheadRing: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          elevationsDeg: [90],
        }),
      ),
      collapsingRings: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          elevationsDeg: [20, 20.4],
        }),
      ),
      zeroMargin: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          distanceFactor: 0,
        }),
      ),
      unmeasurableMargin: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          distanceFactor: Number.NaN,
        }),
      ),
      degenerateLens: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          fovDeg: 0,
        }),
      ),
      straightThroughLens: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          fovDeg: 180,
        }),
      ),
      flatViewport: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          aspect: 0,
        }),
      ),
      unmeasurableViewport: refusal(() =>
        autoMovieSubjectInspectionPlan({
          bounds: ELEVATION,
          ...RULE,
          ...LENS,
          aspect: Number.NaN,
        }),
      ),
    },
    {
      fractionalAzimuths: "refused",
      noAzimuths: "refused",
      tooManyAzimuths: "refused",
      noRings: "refused",
      tooManyRings: "refused",
      overheadRing: "refused",
      collapsingRings: "refused",
      zeroMargin: "refused",
      unmeasurableMargin: "refused",
      degenerateLens: "refused",
      straightThroughLens: "refused",
      flatViewport: "refused",
      unmeasurableViewport: "refused",
    },
  );

  TestValidator.equals(
    "an inspection answer is refused by a consumer that requires delivery evidence",
    typeof deliveryEvidenceConsumerIsUnreachable,
    "function",
  );
};

/** A consumer that will only read evidence about a delivered picture. */
const requireDeliveryEvidence = (evidence: {
  deliveryEvidence: true;
  views: IAutoMovieSubjectInspectionView[];
}): number => evidence.views.length;

/**
 * The delivery-evidence refusal is a type error, not a reviewer's discipline.
 *
 * The body never runs. It exists so the compiler is the thing that proves an
 * inspection answer cannot be offered where a delivered frame is required; a
 * runtime assertion could only observe the literal `false`, and a later widening
 * to `boolean` would leave that assertion green while the guarantee was gone.
 */
const deliveryEvidenceConsumerIsUnreachable = (
  inspection: IAutoMovieInspectSubject,
): number =>
  // @ts-expect-error a subject inspection can never be delivery evidence
  requireDeliveryEvidence(inspection);
