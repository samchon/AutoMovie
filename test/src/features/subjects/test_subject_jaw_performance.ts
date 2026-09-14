import { posePortraitJawPoint } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError, vclose } from "../internal/predicates";

/**
 * Mandibular tissue rotates about its assigned transverse hinge, not about the world origin.
 *
 * Scenarios:
 * 1. Positive rotation sends anterior tissue down; an identical inverse weight recovers its source.
 * 2. Zero angle and zero attachment weight are exact owned identities; half weight means half angle.
 * 3. Range endpoints are accepted; adjacent angle/weight, nonfinite and overflow cases refuse.
 */
export const test_subject_jaw_performance = (): void => {
  const hinge = { x: 2, y: 3, z: 4 },
    point = { x: 2, y: 3, z: 14 };
  const radians = (20 * Math.PI) / 180;
  const moved = posePortraitJawPoint(point, hinge, 20, 1);
  TestValidator.predicate(
    "inferior mandibular rotation",
    vclose(moved, {
      x: 2,
      y: 3 - 10 * Math.sin(radians),
      z: 4 + 10 * Math.cos(radians),
    }),
  );
  TestValidator.predicate(
    "inverse movement",
    vclose(posePortraitJawPoint(moved, hinge, -20, 1), point),
  );
  TestValidator.predicate(
    "half attachment",
    vclose(
      posePortraitJawPoint(point, hinge, 20, 0.5),
      posePortraitJawPoint(point, hinge, 10, 1),
    ),
  );
  for (const [angle, weight] of [
    [0, 1],
    [20, 0],
  ]) {
    const copy = posePortraitJawPoint(point, hinge, angle, weight);
    TestValidator.equals("exact stationary attachment", copy, point);
    copy.x = 99;
    TestValidator.equals("owned stationary point", point.x, 2);
  }
  for (const angle of [-25, 25]) posePortraitJawPoint(point, hinge, angle, 1);
  for (const [angle, weight] of [
    [-25.01, 1],
    [25.01, 1],
    [0, -0.01],
    [0, 1.01],
    [NaN, 1],
    [1, Infinity],
  ])
    TestValidator.predicate(
      "motion guard",
      throwsError(() => posePortraitJawPoint(point, hinge, angle, weight)),
    );
  TestValidator.predicate(
    "point guard",
    throwsError(() => posePortraitJawPoint({ ...point, z: NaN }, hinge, 1, 1)),
  );
  TestValidator.predicate(
    "hinge guard",
    throwsError(() =>
      posePortraitJawPoint(point, { ...hinge, x: Infinity }, 1, 1),
    ),
  );
  TestValidator.predicate(
    "finite output guard",
    throwsError(() =>
      posePortraitJawPoint(
        { x: Number.MAX_VALUE, y: 0, z: 0 },
        { x: -Number.MAX_VALUE, y: 0, z: 0 },
        1,
        1,
      ),
    ),
  );
};
