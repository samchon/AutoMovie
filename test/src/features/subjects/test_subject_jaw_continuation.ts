import {
  createPortraitFacePerformanceComponent,
  createPortraitJawContinuation,
  portraitNeckShape,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { nclose } from "../internal/predicates";

/**
 * Newly formed head tissue follows the same jaw without restoring the mouth.
 *
 * Scenarios:
 * 1. Matching angles omit the extra assembly, including nonzero observations.
 * 2. Only actual mandibular constraints restore their owned reference samples;
 *    unclaimed component points and raised brows retain their current positions.
 * 3. Hand rotation pins full and angular-midpoint motion, inverse motion and the
 *    fixed posterior, superior and lower-neck regions.
 * 4. Mutation of caller data or a returned reference cannot change the field.
 */
export const test_subject_jaw_continuation = (): void => {
  const { host, bindings } = humanFaceFixture().basis;
  bindings.jawHinge = { x: 0, y: 0, z: -45 };
  for (const angle of [0, 10])
    TestValidator.equals(
      "matching observation",
      createPortraitJawContinuation(
        host,
        bindings,
        { jawOpen: angle },
        { jawOpen: angle },
        portraitNeckShape,
      ),
      undefined,
    );
  const field = createPortraitJawContinuation(
    host,
    bindings,
    {},
    { jawOpen: 25, browRaise: { left: 2 } },
    portraitNeckShape,
  )!;
  const plan = createPortraitFacePerformanceComponent(
    bindings,
    {},
    { jawOpen: 25 },
  ).fit(host);
  const lowerY =
    host.positions[
      bindings.mouth.lower[Math.floor(bindings.mouth.lower.length / 2)]
    ][1];
  const points = plan.constraints
    .map((c) => host.positions[c.vertex])
    .filter((p) => p[1] <= lowerY);
  const chin = Math.min(...points.map((p) => p[1])),
    front = Math.min(...points.map((p) => p[2]));
  const original = [...host.positions[152]];
  const performed = plan.constraints.find((c) => c.vertex === 152)!.target;
  TestValidator.predicate(
    "restored chin",
    field.reference(performed, 152).every((v, i) => nclose(v, original[i])),
  );
  for (const vertex of [
    bindings.mouth.lower[0],
    bindings.eyes.left.browTop[0],
    host.positions.length + 1,
  ])
    TestValidator.equals(
      "unclaimed point",
      field.reference([1, 2, 3], vertex),
      [1, 2, 3],
    );
  const rotated = (point: number[], degrees: number) => {
    const a = (degrees * Math.PI) / 180,
      dy = point[1],
      dz = point[2] + 45;
    return [
      point[0],
      dy * Math.cos(a) - dz * Math.sin(a),
      -45 + dy * Math.sin(a) + dz * Math.cos(a),
    ];
  };
  const check = (actual: number[], expected: number[]) =>
    TestValidator.predicate(
      "hand rotation",
      actual.every((v, i) => nclose(v, expected[i])),
    );
  const decorated = performed.map((v, i) => v + [0, 1, 0][i]);
  check(field.reference(decorated, 152), rotated(decorated, -25));
  const full = [0, chin, Math.max(...points.map((p) => p[2])) + 10];
  check(field.pose(full), rotated(full, 25));
  const frontAngle = Math.max(
      ...points.map((p) => Math.atan2(-p[1], p[2] + 45)),
    ),
    middleAngle = (frontAngle + Math.PI / 2) / 2,
    radius = -chin * 0.95,
    half = [
      0,
      -radius * Math.sin(middleAngle),
      -45 + radius * Math.cos(middleAngle),
    ];
  TestValidator.predicate("midpoint is below oral band", half[1] < lowerY);
  check(field.pose(half), rotated(half, 12.5));
  for (const fixed of [
    [0, chin, -45],
    [0, chin, -46],
    [0, portraitNeckShape.lower.y, front],
    [0, portraitNeckShape.lower.y - 1, front],
    [0, 100, front],
  ])
    TestValidator.equals("anchored tissue", field.pose(fixed), fixed);
  const reverse = createPortraitJawContinuation(
    host,
    bindings,
    { jawOpen: 25 },
    {},
    portraitNeckShape,
  )!;
  check(reverse.pose(full), rotated(full, -25));
  const baseline = field.pose(full);
  host.positions[152][0] = 99;
  bindings.jawHinge.z = -90;
  const returned = field.reference(performed, 152);
  returned[0] = 88;
  TestValidator.predicate(
    "owned reference",
    field.reference(performed, 152).every((v, i) => nclose(v, original[i])),
  );
  TestValidator.equals("owned performance", field.pose(full), baseline);
};
