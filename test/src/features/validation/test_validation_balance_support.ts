import { validateBalanceSupport } from "@automovie/engine";
import {
  IAutoMovieKeyframe,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeMotion } from "../internal/fixtures";
import {
  hasViolation,
  hasWarning,
  nclose,
  violationCount,
  warningCount,
} from "../internal/predicates";

const restAt = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton = (centerX: number, centerZ: number): IAutoMovieSkeleton => ({
  id: `balance-${centerX}-${centerZ}`,
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "spine",
      parent: "hips",
      rest: restAt(centerX, 0.5, centerZ),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "hips",
      rest: restAt(-0.2, -1, 0),
      constraint: null,
    },
    {
      bone: "rightFoot",
      parent: "hips",
      rest: restAt(0.2, -1, 0),
      constraint: null,
    },
    {
      bone: "leftToes",
      parent: "leftFoot",
      rest: restAt(0, 0, 0.4),
      constraint: null,
    },
    {
      bone: "rightToes",
      parent: "rightFoot",
      rest: restAt(0, 0, 0.4),
      constraint: null,
    },
  ],
});

const root = (): IAutoMovieTransform => ({
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (target: IAutoMovieSkeleton): IAutoMoviePose => ({
  skeleton: target.id,
  root: root(),
  joints: [],
});

const key = (target: IAutoMovieSkeleton, time: number): IAutoMovieKeyframe => ({
  time,
  pose: pose(target),
  expression: null,
  easing: "linear",
  bezier: null,
});

const motion = (target: IAutoMovieSkeleton) =>
  makeMotion([key(target, 0), key(target, 1)], 1);

/**
 * `validateBalanceSupport` pins the balance heuristic: callers declare a
 * support window, the validator projects the center of mass and support
 * contacts to XZ, then rejects samples whose COM falls outside the support hull
 * margin. With an explicit `centerBone` the COM is that single bone; omitted,
 * it is the segment-mass-weighted whole-body COM (#1184).
 *
 * Scenarios:
 *
 * 1. A single-bone (`spine`) COM beyond a two-foot support segment reports a
 *    physics violation on
 *    `$input.supports[i].samples[j].centerOfMass.supportDistance`.
 * 2. Widening the margin accepts the same segment case, proving the distance
 *    threshold is the gate.
 * 3. One-foot support and the whole-body COM pass when the COM is on the support
 *    point or segment.
 * 4. A convex four-point foot/toe hull accepts an inside COM and rejects an
 *    outside COM.
 * 5. The mass-weighted whole-body COM (#1184) warns on a forward-leaning trunk
 *    that a single-hips proxy misses — the pelvis stays over the feet while the
 *    body's real COM has pitched past them.
 * 6. Invalid support annotations and invalid sample rates report deterministic
 *    non-physics failures before sampling.
 */
export const test_validation_balance_support = (): void => {
  const outsideLine = skeleton(0.5, 0);
  const rejected = validateBalanceSupport({
    motion: motion(outsideLine),
    skeleton: outsideLine,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["leftFoot", "rightFoot"],
        start: 0,
        end: 1,
        margin: 0.05,
      },
    ],
    sampleRate: 1,
  });
  TestValidator.predicate(
    "balance support warns but succeeds",
    rejected.success === true &&
      hasWarning(
        rejected,
        "physics",
        "$input.supports[0].samples[0].centerOfMass.supportDistance",
      ),
  );
  const first =
    rejected.success === true
      ? (rejected.warnings ?? []).find((v) => v.path.includes("samples[0]"))
      : null;
  TestValidator.predicate(
    "balance support overshoot",
    first?.kind === "physics" && nclose(first.overshoot ?? -1, 0.25),
  );

  // physicsIntent (wire-fu / a deliberately off-balance pose) suppresses it.
  const acknowledged = validateBalanceSupport({
    motion: motion(outsideLine),
    skeleton: outsideLine,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["leftFoot", "rightFoot"],
        start: 0,
        end: 1,
        margin: 0.05,
      },
    ],
    sampleRate: 1,
    physicsIntent: "wire-fu",
  });
  TestValidator.equals(
    "acknowledged imbalance is clean",
    acknowledged.success === true && warningCount(acknowledged),
    0,
  );

  TestValidator.equals(
    "margin accepts line support",
    validateBalanceSupport({
      motion: motion(outsideLine),
      skeleton: outsideLine,
      supports: [
        {
          centerBone: "spine",
          supportBones: ["leftFoot", "rightFoot"],
          start: 0,
          end: 1,
          margin: 0.3,
        },
      ],
      sampleRate: 1,
    }).success,
    true,
  );

  const oneFoot = skeleton(-0.2, 0);
  TestValidator.equals(
    "one-foot support succeeds",
    validateBalanceSupport({
      motion: motion(oneFoot),
      skeleton: oneFoot,
      supports: [
        {
          centerBone: "spine",
          supportBones: ["leftFoot"],
          start: 0,
          end: 1,
          margin: 0,
        },
      ],
      sampleRate: 1,
    }).success,
    true,
  );

  const defaultCenter = skeleton(0, 0);
  TestValidator.equals(
    "whole-body COM over an upright rig stays within the foot segment",
    validateBalanceSupport({
      motion: motion(defaultCenter),
      skeleton: defaultCenter,
      supports: [{ supportBones: ["leftFoot", "rightFoot"], start: 0, end: 1 }],
    }).success,
    true,
  );

  // #1184: a forward-leaning trunk pitches the whole-body COM past the feet,
  // which the mass-weighted default catches but a single-hips proxy misses —
  // the pelvis stays over the feet while the heavy trunk has tipped forward.
  const leaningTrunk: IAutoMovieSkeleton = {
    id: "leaning",
    bones: [
      { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
      {
        bone: "chest",
        parent: "hips",
        rest: restAt(0, 0.5, 1),
        constraint: null,
      },
      {
        bone: "leftFoot",
        parent: "hips",
        rest: restAt(-0.2, -1, 0),
        constraint: null,
      },
      {
        bone: "rightFoot",
        parent: "hips",
        rest: restAt(0.2, -1, 0),
        constraint: null,
      },
    ],
  };
  const leanDefault = validateBalanceSupport({
    motion: motion(leaningTrunk),
    skeleton: leaningTrunk,
    supports: [
      {
        supportBones: ["leftFoot", "rightFoot"],
        start: 0,
        end: 1,
        margin: 0.05,
      },
    ],
    sampleRate: 1,
  });
  TestValidator.predicate(
    "mass-weighted COM warns on a forward-leaning trunk",
    leanDefault.success === true &&
      hasWarning(
        leanDefault,
        "physics",
        "$input.supports[0].samples[0].centerOfMass.supportDistance",
      ),
  );
  const leanHips = validateBalanceSupport({
    motion: motion(leaningTrunk),
    skeleton: leaningTrunk,
    supports: [
      {
        centerBone: "hips",
        supportBones: ["leftFoot", "rightFoot"],
        start: 0,
        end: 1,
        margin: 0.05,
      },
    ],
    sampleRate: 1,
  });
  TestValidator.equals(
    "the single-hips proxy misses the same lean (pelvis stays over the feet)",
    leanHips.success === true && warningCount(leanHips),
    0,
  );

  const insidePolygon = skeleton(0, 0.2);
  TestValidator.equals(
    "polygon support succeeds",
    validateBalanceSupport({
      motion: motion(insidePolygon),
      skeleton: insidePolygon,
      supports: [
        {
          centerBone: "spine",
          supportBones: ["leftFoot", "rightFoot", "rightToes", "leftToes"],
          start: 0,
          end: 1,
          margin: 0,
        },
      ],
      sampleRate: 1,
    }).success,
    true,
  );

  const edgePolygon = skeleton(0, 0);
  TestValidator.equals(
    "polygon edge support succeeds",
    validateBalanceSupport({
      motion: motion(edgePolygon),
      skeleton: edgePolygon,
      supports: [
        {
          centerBone: "spine",
          supportBones: ["leftFoot", "rightFoot", "rightToes", "leftToes"],
          start: 0,
          end: 1,
          margin: 0,
        },
      ],
      sampleRate: 1,
    }).success,
    true,
  );

  TestValidator.equals(
    "fractional sample window succeeds",
    validateBalanceSupport({
      motion: motion(insidePolygon),
      skeleton: insidePolygon,
      supports: [
        {
          centerBone: "spine",
          supportBones: ["leftFoot", "rightFoot", "rightToes", "leftToes"],
          start: 0,
          end: 0.75,
          margin: 0,
        },
      ],
      sampleRate: 2,
    }).success,
    true,
  );

  const outsidePolygon = skeleton(0.5, 0.2);
  const polygonRejected = validateBalanceSupport({
    motion: motion(outsidePolygon),
    skeleton: outsidePolygon,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["leftFoot", "rightFoot", "rightToes", "leftToes"],
        start: 0,
        end: 1,
        margin: 0.05,
      },
    ],
    sampleRate: 1,
    path: "$balance",
  });
  TestValidator.predicate(
    "polygon support warns but succeeds",
    polygonRejected.success === true &&
      hasWarning(
        polygonRejected,
        "physics",
        "$balance.supports[0].samples[0].centerOfMass.supportDistance",
      ),
  );

  const invalid = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "rightHand",
        supportBones: [],
        start: 1,
        end: 0,
        margin: -1,
      },
      {
        centerBone: "spine",
        supportBones: ["leftFoot", "leftFoot", "rightHand"],
        start: 0,
        end: 1,
        margin: Number.POSITIVE_INFINITY,
      },
      {
        centerBone: "spine",
        supportBones: ["rightHand"],
        start: Number.NaN,
        end: Number.POSITIVE_INFINITY,
        margin: 0,
      },
    ],
    sampleRate: Number.POSITIVE_INFINITY,
    path: "$balancePlan",
  });
  TestValidator.predicate(
    "invalid center bone",
    hasViolation(invalid, "type", "$balancePlan.supports[0].centerBone"),
  );
  TestValidator.predicate(
    "invalid empty supports",
    hasViolation(invalid, "type", "$balancePlan.supports[0].supportBones"),
  );
  TestValidator.predicate(
    "invalid support missing bone",
    hasViolation(invalid, "type", "$balancePlan.supports[1].supportBones"),
  );
  TestValidator.predicate(
    "invalid first support bone missing",
    hasViolation(invalid, "type", "$balancePlan.supports[2].supportBones"),
  );
  TestValidator.predicate(
    "invalid window",
    hasViolation(invalid, "temporal", "$balancePlan.supports[0]"),
  );
  TestValidator.predicate(
    "invalid non-finite window",
    hasViolation(invalid, "temporal", "$balancePlan.supports[2]"),
  );
  TestValidator.predicate(
    "invalid negative margin",
    hasViolation(invalid, "range", "$balancePlan.supports[0].margin"),
  );
  TestValidator.predicate(
    "invalid non-finite margin",
    hasViolation(invalid, "range", "$balancePlan.supports[1].margin"),
  );
  TestValidator.predicate(
    "invalid sample rate",
    hasViolation(invalid, "range", "$balancePlan.sampleRate"),
  );
  TestValidator.equals("invalid balance count", violationCount(invalid), 9);

  const invalidCenterOnly = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "rightHand",
        supportBones: ["leftFoot"],
        start: 0,
        end: 1,
        margin: 0,
      },
    ],
    sampleRate: 1,
    path: "$centerOnly",
  });
  TestValidator.predicate(
    "invalid center-only bone",
    hasViolation(
      invalidCenterOnly,
      "type",
      "$centerOnly.supports[0].centerBone",
    ),
  );
  TestValidator.equals(
    "invalid center-only count",
    violationCount(invalidCenterOnly),
    1,
  );

  const invalidEmptySupportOnly = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "spine",
        supportBones: [],
        start: 0,
        end: 1,
        margin: 0,
      },
    ],
    sampleRate: 1,
    path: "$emptySupportOnly",
  });
  TestValidator.predicate(
    "invalid empty-support-only window",
    hasViolation(
      invalidEmptySupportOnly,
      "type",
      "$emptySupportOnly.supports[0].supportBones",
    ),
  );
  TestValidator.equals(
    "invalid empty-support-only count",
    violationCount(invalidEmptySupportOnly),
    1,
  );

  const invalidSupportOnly = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["rightHand"],
        start: 0,
        end: 1,
        margin: 0,
      },
    ],
    sampleRate: 1,
    path: "$supportOnly",
  });
  TestValidator.predicate(
    "invalid support-only missing bone",
    hasViolation(
      invalidSupportOnly,
      "type",
      "$supportOnly.supports[0].supportBones",
    ),
  );
  TestValidator.equals(
    "invalid support-only count",
    violationCount(invalidSupportOnly),
    1,
  );

  const invalidMarginOnly = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["leftFoot"],
        start: 0,
        end: 1,
        margin: -1,
      },
    ],
    sampleRate: 1,
    path: "$marginOnly",
  });
  TestValidator.predicate(
    "invalid margin-only support",
    hasViolation(invalidMarginOnly, "range", "$marginOnly.supports[0].margin"),
  );
  TestValidator.equals(
    "invalid margin-only count",
    violationCount(invalidMarginOnly),
    1,
  );

  const invalidNonFiniteMarginOnly = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [
      {
        centerBone: "spine",
        supportBones: ["leftFoot"],
        start: 0,
        end: 1,
        margin: Number.POSITIVE_INFINITY,
      },
    ],
    sampleRate: 1,
    path: "$nonFiniteMarginOnly",
  });
  TestValidator.predicate(
    "invalid non-finite margin-only support",
    hasViolation(
      invalidNonFiniteMarginOnly,
      "range",
      "$nonFiniteMarginOnly.supports[0].margin",
    ),
  );
  TestValidator.equals(
    "invalid non-finite margin-only count",
    violationCount(invalidNonFiniteMarginOnly),
    1,
  );

  const zeroRate = validateBalanceSupport({
    motion: motion(defaultCenter),
    skeleton: defaultCenter,
    supports: [{ supportBones: ["leftFoot"], start: 0, end: 1 }],
    sampleRate: 0,
    path: "$zeroBalance",
  });
  TestValidator.predicate(
    "zero sample rate",
    hasViolation(zeroRate, "range", "$zeroBalance.sampleRate"),
  );
  TestValidator.equals("zero rate count", violationCount(zeroRate), 1);
};
