import { TestValidator } from "@nestia/e2e";

import { createPortraitDentalArc } from "../../subjects/generated-korean-girl-01/dentalArc";
import { nclose, throwsError, vclose } from "../internal/predicates";

/**
 * The dental guide has a metric horizontal coordinate and a finite posterior
 * continuation. Sampling cannot silently clamp an over-wide or displaced row.
 *
 * Scenarios:
 * 1. A symmetric straight rim has its centre at half the guide length, exact
 *    X-distance samples and matching posterior ends for short and long rows.
 * 2. Editing source landmarks or returned samples cannot mutate the guide.
 * 3. Incomplete/nonfinite rims, nonpositive row lengths, stationary corners or
 *    interior spans, and out-of-range/nonfinite sample distances are refused.
 */
export const test_subject_dental_arc = (): void => {
  for (const rowLength of [10, 100]) {
    const points = [
      { x: -10, y: 2, z: 0 },
      { x: 0, y: 2, z: 0 },
      { x: 10, y: 2, z: 0 },
    ];
    const arc = createPortraitDentalArc(points, rowLength);
    TestValidator.predicate(
      "symmetric metric centre",
      nclose(arc.center, arc.length / 2),
    );
    for (const offset of [-10, -3.25, 0, 3.25, 10]) {
      const sample = arc.sample(arc.center + offset);
      TestValidator.predicate(
        "straight metric samples",
        vclose(sample.position, { x: offset, y: 2, z: 0 }),
      );
      TestValidator.predicate(
        "horizontal unit tangent",
        nclose(sample.tangent.y, 0) &&
          nclose(Math.hypot(sample.tangent.x, sample.tangent.z), 1),
      );
      if (Math.abs(offset) < 10)
        TestValidator.predicate(
          "straight span tangent",
          vclose(sample.tangent, { x: 1, y: 0, z: 0 }),
        );
    }
    const extension = rowLength === 10 ? 12 : 50;
    for (const [distance, sign] of [
      [0, -1],
      [arc.length, 1],
    ])
      TestValidator.predicate(
        "posterior continuation",
        vclose(arc.sample(distance).position, {
          x: sign * (10 + extension / 3),
          y: 2,
          z: -extension,
        }),
      );
    points[1].x = 100;
    arc.sample(arc.center).position.x = 100;
    TestValidator.predicate(
      "guide owns its coordinates",
      vclose(arc.sample(arc.center).position, { x: 0, y: 2, z: 0 }),
    );
    for (const distance of [-1, arc.length + 1, NaN, Infinity])
      TestValidator.predicate(
        "invalid distance refused",
        throwsError(() => arc.sample(distance)),
      );
  }
  const line = [
    { x: -10, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  for (const rowLength of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "invalid row length",
      throwsError(() => createPortraitDentalArc(line, rowLength)),
    );
  for (const points of [
    [],
    line.slice(0, 2),
    [...line.slice(0, 2), { x: Infinity, y: 0, z: 0 }],
    Array.from({ length: 3 }, (_v, i) => ({ x: 0, y: i, z: 0 })),
    [-10, -5, 0, 0, 0, 0, 5, 10].map((x) => ({ x, y: 0, z: 0 })),
    [-Number.MAX_VALUE, 0, Number.MAX_VALUE].map((x) => ({ x, y: 0, z: 0 })),
  ])
    TestValidator.predicate(
      "invalid guide refused",
      throwsError(() => createPortraitDentalArc(points, 10)),
    );
};
