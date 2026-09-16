import { refinePortraitSurfaceSampling } from "@automovie/human/geometry/refinePortraitSurfaceSampling";
import type { IControlMesh } from "@automovie/human/geometry/subdivideControlMesh";
import type { IAutoMovieMeshDeformationField } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Narrow skin details receive conforming samples without smoothing identity.
 *
 * Scenarios:
 * 1. A 4 mm square at 3 mm spacing produces eight coplanar triangles with
 *    shared midpoint identities, conserved area and inherited region labels.
 * 2. One- and two-edge splits retain winding; distant faces and empty fields
 *    preserve their surface. A second pass is an exact no-op.
 * 3. A unit octahedron's radial endpoint normals place an interior edge sample
 *    at (0.625,0.625,0), the hand-calculated cubic point-normal midpoint.
 * 4. Invalid spacing and a midpoint below floating-point resolution refuse.
 */
export const test_subject_skin_sampling = (): void => {
  const field: IAutoMovieMeshDeformationField = {
    center: { x: 0, y: 0, z: 0 },
    radius: { x: 0.01, y: 0.01, z: 0.01 },
    displacement: { x: 0, y: 0, z: -0.001 },
    stretch: { x: 0, y: 0, z: 0 },
  };
  const square: IControlMesh = {
    positions: [
      [0, 0, 0],
      [4, 0, 0],
      [4, 4, 0],
      [0, 4, 0],
    ],
    indices: [0, 1, 2, 0, 2, 3],
    groups: [7, 8],
  };
  const before = structuredClone(square),
    refined = refinePortraitSurfaceSampling(square, [field], 3);
  TestValidator.equals("caller untouched", square, before);
  TestValidator.equals(
    "original identities retained",
    refined.positions.slice(0, 4),
    square.positions,
  );
  TestValidator.equals(
    "one common diagonal midpoint",
    refined.positions.length,
    9,
  );
  TestValidator.equals(
    "four children per material",
    refined.groups,
    [7, 7, 7, 7, 8, 8, 8, 8],
  );
  let area = 0;
  for (let face = 0; face < refined.indices.length; face += 3) {
    const p = refined.indices
      .slice(face, face + 3)
      .map((i) => refined.positions[i]);
    const twice =
      (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
      (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    TestValidator.predicate("positive winding", twice > 0);
    for (let edge = 0; edge < 3; edge++)
      TestValidator.predicate(
        "resolved spacing",
        Math.hypot(...p[edge].map((x, axis) => x - p[(edge + 1) % 3][axis])) <=
          3,
      );
    area += twice / 2;
  }
  TestValidator.predicate("area conserved", nclose(area, 16));
  TestValidator.predicate(
    "second pass preserves object",
    refinePortraitSurfaceSampling(refined, [field], 3) === refined,
  );
  for (const [height, spacing, count] of [
    [4, 4, 2],
    [2, 3, 3],
  ]) {
    const triangle: IControlMesh = {
      positions: [
        [0, 0, 0],
        [4, 0, 0],
        [0, height, 0],
        [100, 100, 0],
        [104, 100, 0],
        [100, 104, 0],
      ],
      indices: [0, 1, 2, 3, 4, 5],
      groups: [1, 2],
    };
    for (let rotate = 0; rotate < 3; rotate++) {
      triangle.indices.splice(0, 3, rotate, (rotate + 1) % 3, (rotate + 2) % 3);
      const r = refinePortraitSurfaceSampling(triangle, [field], spacing);
      TestValidator.equals(
        "only local triangle splits",
        r.groups.length,
        count + 1,
      );
      TestValidator.equals(
        "remote triangle unchanged",
        r.indices.slice(-3),
        [3, 4, 5],
      );
      TestValidator.equals("child material", r.groups, [
        ...new Array(count).fill(1),
        2,
      ]);
    }
  }
  TestValidator.predicate(
    "empty supports identity",
    refinePortraitSurfaceSampling(square, [], 1) === square,
  );
  const octahedron = {
    positions: [
      [1, 0, 0],
      [0, 1, 0],
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ],
    indices: [
      0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3, 5,
    ],
    groups: new Array(8).fill(0),
  };
  const curved = refinePortraitSurfaceSampling(octahedron, [field], 1);
  TestValidator.predicate(
    "cubic radial midpoint",
    curved.positions.some(
      (p) => nclose(p[0], 0.625) && nclose(p[1], 0.625) && nclose(p[2], 0),
    ),
  );
  TestValidator.equals(
    "curvature retains original vertices",
    curved.positions.slice(0, 6),
    octahedron.positions,
  );
  for (const spacing of [0, -1, NaN, Infinity])
    TestValidator.predicate(
      "spacing refusal",
      throwsError(() =>
        refinePortraitSurfaceSampling(square, [field], spacing),
      ),
    );
  const huge = {
    positions: [
      [1e16, 0, 0],
      [1e16 + 2, 0, 0],
      [1e16, 2, 0],
    ],
    indices: [0, 1, 2],
    groups: [0],
  };
  TestValidator.predicate(
    "unrepresentable midpoint refusal",
    throwsError(() =>
      refinePortraitSurfaceSampling(
        huge,
        [{ ...field, center: { x: 1e13, y: 0, z: 0 } }],
        1,
      ),
    ),
  );
  huge.indices = [1, 0, 2];
  TestValidator.predicate(
    "opposite rounded endpoint refusal",
    throwsError(() =>
      refinePortraitSurfaceSampling(
        huge,
        [{ ...field, center: { x: 1e13, y: 0, z: 0 } }],
        1,
      ),
    ),
  );
};
