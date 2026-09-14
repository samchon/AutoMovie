import { portraitNormals } from "@automovie/human/geometry/geometry";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Unrepresentable accumulated areas must refuse instead of returning NaN shading.
 * Scenarios:
 * 1. Two coplanar triangles with representable area sums retain their +Z normals.
 * 2. Individually finite triangle areas whose shared sum overflows refuse.
 * 3. An overflowing cross product and a nonfinite position refuse at the same owner.
 */
export const test_subject_normal_admission = (): void => {
  const positions = (height: number): number[] => [
    0,
    0,
    0,
    160,
    0,
    0,
    0,
    height,
    0,
    160,
    height,
    0,
  ];
  const indices = [0, 1, 2, 1, 3, 2];
  TestValidator.equals(
    "finite shared area retains planar direction",
    portraitNormals(positions(1e305), indices),
    [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  );
  for (const height of [1e306, 1e307, Infinity, NaN])
    for (const rotation of [0, 1, 2]) {
      const coordinates = positions(height);
      const rotated = coordinates.map(
        (_value, i) =>
          coordinates[Math.floor(i / 3) * 3 + ((i + rotation) % 3)],
      );
      TestValidator.predicate(
        "each unrepresentable normal component refuses",
        throwsError(() => portraitNormals(rotated, indices), "normal"),
      );
    }
};
