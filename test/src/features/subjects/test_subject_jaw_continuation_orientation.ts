import {
  createPortraitFacePerformanceComponent,
  createPortraitJawContinuation,
  portraitJawSkinWeight,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Cervical interpolation retains angular order between rigid and fixed tissue.
 * A spatially smooth weight alone can still reverse this local orientation.
 *
 * Scenarios:
 * 1. A short neck's fully mandibular angular arc remains strictly ordered at
 *    maximum opening and closing, preserving radius and the fixed back plane.
 * 2. The symmetric midpoint advances by half the rotation. Its independent
 *    rational-quadratic derivative and both unit endpoint tangents are pinned.
 * 3. A ray reaching the lower horizontal anchor is fixed there. Insufficient
 *    angular clearance refuses, including finite-coordinate overflow, while
 *    a smaller rotation on the same ray succeeds without clipping the angle.
 */
export const test_subject_jaw_continuation_orientation = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  const neck = {
    ...portraitNeckShape,
    lower: { ...portraitNeckShape.lower, y: -100 },
  };
  const middle = (curve: number[]) =>
    host.positions[curve[Math.floor(curve.length / 2)]][1];
  const upper = middle(bindings.mouth.upper),
    lower = middle(bindings.mouth.lower);
  const constraints = createPortraitFacePerformanceComponent(
    bindings,
    {},
    { jawOpen: 25 },
  ).fit(host).constraints;
  const attached = constraints
    .map(({ vertex }) => host.positions[vertex])
    .filter((p) => portraitJawSkinWeight(p[1], upper, lower) === 1);
  const chin = Math.min(...attached.map((p) => p[1]));
  const start = Math.max(...attached.map((p) => Math.atan2(-p[1], p[2] + 45)));
  const end = Math.PI / 2,
    radius = -chin * 0.95;
  const point = (r: number, theta: number) => [
    7,
    -r * Math.sin(theta),
    -45 + r * Math.cos(theta),
  ];
  const polar = (p: number[]) => Math.atan2(-p[1], p[2] + 45);
  for (const angle of [-25, 25]) {
    const field = createPortraitJawContinuation(
      host,
      bindings,
      { jawOpen: angle < 0 ? 25 : 0 },
      { jawOpen: angle < 0 ? 0 : 25 },
      neck,
    )!;
    const evaluate = (theta: number) => polar(field.pose(point(radius, theta)));
    const middleAngle = (start + end) / 2,
      radians = (angle * Math.PI) / 180;
    TestValidator.predicate(
      "full mandibular interval",
      portraitJawSkinWeight(point(radius, start)[1], upper, lower) === 1,
    );
    let previous = -Infinity;
    for (let i = 0; i <= 64; i++) {
      const sample = point(radius, start + ((end - start) * i) / 64),
        result = field.pose(sample),
        theta = polar(result);
      TestValidator.predicate("strict angular order", theta > previous);
      TestValidator.predicate(
        "radius retained",
        nclose(Math.hypot(result[1], result[2] + 45), radius),
      );
      TestValidator.equals("transverse coordinate", result[0], sample[0]);
      previous = theta;
    }
    TestValidator.predicate(
      "half-angle midpoint",
      nclose(evaluate(middleAngle), middleAngle + radians / 2),
    );
    const epsilon = 1e-6,
      derivative = (theta: number) =>
        (evaluate(theta + epsilon) - evaluate(theta - epsilon)) / (2 * epsilon);
    const ratio = 1 - radians / (end - start);
    TestValidator.predicate(
      "midpoint analytic derivative",
      Math.abs(derivative(middleAngle) - (2 * ratio * ratio) / (1 + ratio)) <
        1e-5,
    );
    for (const boundary of [start, end])
      TestValidator.predicate(
        "unit endpoint tangent",
        Math.abs(derivative(boundary) - 1) < 1e-5,
      );
  }
  const farRadius = 300,
    fixedAngle = Math.asin(100 / farRadius),
    beforeFixed = point(farRadius, fixedAngle - 0.001);
  const small = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 1 },
    neck,
  )!;
  TestValidator.predicate(
    "small angle moves",
    small.pose(beforeFixed)[1] < beforeFixed[1],
  );
  const fixed = [7, -100, -45 + Math.sqrt(farRadius * farRadius - 10000)];
  TestValidator.equals("lower-plane anchor", small.pose(fixed), fixed);
  const maximum = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 25 },
    neck,
  )!;
  TestValidator.predicate(
    "no room for full angle",
    throwsError(() => maximum.pose(beforeFixed)),
  );
  const narrow = { ...neck, lower: { ...neck.lower, y: chin - 1e-10 } };
  const overflow = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 25 },
    narrow,
  )!;
  TestValidator.predicate(
    "finite-coordinate ratio overflow",
    throwsError(() => overflow.pose([0, chin - 5e-11, 1e308])),
  );
};
