import { validateFootSkate } from "@automovie/engine";
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

const SKELETON: IAutoMovieSkeleton = {
  id: "skeleton-1",
  bones: [
    { bone: "hips", parent: null, rest: restAt(0, 1, 0), constraint: null },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: restAt(0.1, -0.5, 0),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: restAt(0, -0.4, 0),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: restAt(0, -0.1, 0),
      constraint: null,
    },
  ],
};

const root = (x: number, z: number): IAutoMovieTransform => ({
  translation: { x, y: 0, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const pose = (x: number, z: number): IAutoMoviePose => ({
  skeleton: SKELETON.id,
  root: root(x, z),
  joints: [],
});

const key = (time: number, x: number, z: number): IAutoMovieKeyframe => ({
  time,
  pose: pose(x, z),
  expression: null,
  easing: "linear",
  bezier: null,
});

/**
 * `validateFootSkate` pins the first explicit planted-foot metric: callers mark
 * contact windows, and the validator rejects horizontal foot velocity inside
 * those windows.
 *
 * Scenarios:
 *
 * 1. A planted left foot that slides 0.1m over 0.5s exceeds a 0.05m/s limit and
 *    reports a physics WARNING (D015: advice, not a gate) on the stable contact
 *    sample path; the run still succeeds. `physicsIntent` (a deliberate slide)
 *    suppresses it.
 * 2. Raising the allowed speed accepts the same clip, proving the tolerance is the
 *    metric gate rather than the movement itself.
 * 3. Invalid annotation inputs report deterministic non-physics failures (errors)
 *    and do not attempt FK sampling.
 * 4. A no-drift contact with default path, rate, and tolerance succeeds.
 */
export const test_validation_foot_skate = (): void => {
  const sliding = makeMotion(
    [key(0, 0, 0), key(0.5, 0.1, 0), key(1, 0.2, 0)],
    1,
  );
  const rejected = validateFootSkate({
    motion: sliding,
    skeleton: SKELETON,
    contacts: [
      { bone: "leftFoot", start: 0, end: 1, maxHorizontalSpeed: 0.05 },
    ],
    sampleRate: 2,
  });
  TestValidator.predicate(
    "foot skate warns but succeeds",
    rejected.success === true &&
      hasWarning(
        rejected,
        "physics",
        "$input.contacts[0].samples[1].leftFoot.horizontalSpeed",
      ),
  );
  const first =
    rejected.success === true
      ? (rejected.warnings ?? []).find((v) => v.path.includes("samples[1]"))
      : null;
  TestValidator.predicate(
    "foot skate overshoot",
    first?.kind === "physics" && nclose(first.overshoot ?? -1, 0.15),
  );

  // physicsIntent (a deliberate moonwalk) suppresses the skate warning.
  const acknowledged = validateFootSkate({
    motion: sliding,
    skeleton: SKELETON,
    contacts: [
      { bone: "leftFoot", start: 0, end: 1, maxHorizontalSpeed: 0.05 },
    ],
    sampleRate: 2,
    physicsIntent: "moonwalk",
  });
  TestValidator.equals(
    "acknowledged skate is clean",
    acknowledged.success === true && warningCount(acknowledged),
    0,
  );

  TestValidator.equals(
    "tolerance accepts planted drift",
    validateFootSkate({
      motion: sliding,
      skeleton: SKELETON,
      contacts: [
        { bone: "leftFoot", start: 0, end: 1, maxHorizontalSpeed: 0.25 },
      ],
      sampleRate: 2,
    }).success,
    true,
  );

  const invalid = validateFootSkate({
    motion: sliding,
    skeleton: SKELETON,
    contacts: [
      { bone: "rightFoot", start: 0.8, end: 0.2, maxHorizontalSpeed: -1 },
    ],
    sampleRate: 0,
    path: "$contactPlan",
  });
  TestValidator.predicate(
    "invalid bone",
    hasViolation(invalid, "type", "$contactPlan.contacts[0].bone"),
  );
  TestValidator.predicate(
    "invalid window",
    hasViolation(invalid, "temporal", "$contactPlan.contacts[0]"),
  );
  TestValidator.predicate(
    "invalid speed",
    hasViolation(
      invalid,
      "range",
      "$contactPlan.contacts[0].maxHorizontalSpeed",
    ),
  );
  TestValidator.predicate(
    "invalid sample rate",
    hasViolation(invalid, "range", "$contactPlan.sampleRate"),
  );
  TestValidator.equals("invalid annotation count", violationCount(invalid), 4);

  TestValidator.equals(
    "default contact succeeds",
    validateFootSkate({
      motion: makeMotion([key(0, 0, 0), key(1, 0, 0)], 1),
      skeleton: SKELETON,
      contacts: [{ bone: "leftFoot", start: 0, end: 1 }],
    }).success,
    true,
  );
};
