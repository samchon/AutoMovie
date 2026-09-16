import { appendPortraitNeck } from "@automovie/human/components/cranium";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Local submental fullness is independent of the cervical section dimensions.
 *
 * Scenarios:
 * 1. A four-point cardinal collar has a 10 mm anterior midpoint displacement
 *    and a 5.625 mm quarter-point displacement from the declared quartic.
 * 2. X/Y, collar, upper/lower/crop and rear samples remain unchanged; omission
 *    and explicit zero give the same cage and preserve caller-owned roots.
 * 3. The 40 mm endpoint is admitted; adjacent out-of-range, nonfinite and null
 *    values refuse before any cage mutation.
 */
export const test_subject_neck_submental = (): void => {
  const roots = [
    [30, -60, -50],
    [0, -70, -20],
    [-30, -60, -50],
    [0, -30, -80],
  ];
  const exterior = roots.map(([x, y, z]) => [
    x * 1.1,
    y + 5,
    -50 + (z + 50) * 1.1,
  ]);
  const original = structuredClone(roots);
  const fresh = () => ({
    positions: structuredClone(roots),
    indices: [] as number[],
    groups: [] as number[],
  });
  const build = (submentalProjection?: number, cage = fresh()) => {
    appendPortraitNeck(
      cage,
      { boundary: [0, 1, 2, 3], exterior },
      {
        submentalProjection,
        upper: { y: -100, width: 20, front: 15, back: 25, centre: -50 },
        lower: { y: -120, width: 24, front: 17, back: 27, centre: -55 },
        crop: { y: -125, width: 25, front: 18, back: 28, centre: -60 },
      },
    );
    return cage;
  };
  const baseline = build(),
    padded = build(10);
  TestValidator.equals("zero is exact omission", build(0), baseline);
  TestValidator.equals("same topology", padded.indices, baseline.indices);
  TestValidator.equals("same labels", padded.groups, baseline.groups);
  for (let vertex = 0; vertex < baseline.positions.length; vertex++) {
    const before = baseline.positions[vertex],
      after = padded.positions[vertex];
    TestValidator.equals(
      "transverse and height fixed",
      after.slice(0, 2),
      before.slice(0, 2),
    );
    const row = Math.floor(vertex / 4),
      anterior = vertex % 4 === 1;
    if (row === 0 || row >= 12 || !anterior)
      TestValidator.predicate(
        "attachments and other sectors fixed",
        Math.abs(after[2] - before[2]) < 1e-12,
      );
  }
  for (const [row, expected] of [
    [3, 5.625],
    [6, 10],
    [9, 5.625],
  ]) {
    const vertex = row * 4 + 1;
    TestValidator.predicate(
      "independent quartic samples",
      Math.abs(
        padded.positions[vertex][2] - baseline.positions[vertex][2] - expected,
      ) < 1e-12,
    );
  }
  TestValidator.predicate(
    "inclusive maximum",
    Math.abs(build(40).positions[25][2] - baseline.positions[25][2] - 40) <
      1e-12,
  );
  // The five-point first derivative is exact for the quartic displacement.
  for (const reverse of [false, true]) {
    const derivative = [-25, 48, -36, 16, -3].reduce(
      (sum, coefficient, step) => {
        const vertex = (reverse ? 12 - step : step) * 4 + 1;
        return (
          sum +
          coefficient *
            (padded.positions[vertex][2] - baseline.positions[vertex][2])
        );
      },
      0,
    );
    TestValidator.predicate(
      "both join tangents retained",
      Math.abs(derivative) < 1e-10,
    );
  }
  for (const value of [
    -0.001,
    40.001,
    NaN,
    Infinity,
    -Infinity,
    null as unknown as number,
  ]) {
    const cage = fresh(),
      before = structuredClone(cage);
    TestValidator.predicate(
      "invalid projection refused",
      throwsError(() => build(value, cage)),
    );
    TestValidator.equals("refusal leaves cage untouched", cage, before);
  }
  TestValidator.equals("source roots retained", roots, original);
};
