import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  buildPortraitEars,
  portraitEarShape,
} from "../../subjects/generated-korean-girl-01/ears";
import { throwsError } from "../internal/predicates";

/**
 * Ear placement follows each actual temporal surface instead of a fixed X
 * estimate that becomes buried when another component changes the head.
 *
 * Scenarios:
 * 1. Asymmetric planar sides move outward by different known distances. Every
 *    vertex on its corresponding pinna follows that side and retains Y/Z.
 * 2. Positive scales/projection and zero embedding remain valid; nonfinite
 *    placement, nonpositive dimensions and missing host intersections refuse.
 */
export const test_subject_ear_attachment = (): void => {
  const host = (right: number, left: number): IAutoMovieMesh => ({
    positions: [right, left].flatMap((x) => [
      x,
      -0.2,
      -0.2,
      x,
      0.2,
      -0.2,
      x,
      0.2,
      0.2,
      x,
      -0.2,
      0.2,
    ]),
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    normals: null,
    uvs: null,
    skin: null,
  });
  const before = buildPortraitEars(host(-0.07, 0.07));
  const after = buildPortraitEars(host(-0.08, 0.09));
  TestValidator.equals("one shell per anatomical side", before.length, 4);
  for (let i = 0; i < before.length; i++) {
    const a = before[i].geometry,
      b = after[i].geometry;
    if (a.type !== "mesh" || b.type !== "mesh")
      throw new Error("Expected resident pinna meshes.");
    const shift = before[i].id.startsWith("right-") ? -0.01 : 0.02;
    TestValidator.predicate(
      "actual host side drives placement",
      a.mesh.positions.every(
        (value, j) =>
          Math.abs(b.mesh.positions[j] - value - (j % 3 === 0 ? shift : 0)) <
          1e-10,
      ),
    );
  }
  buildPortraitEars(host(-0.07, 0.07), { ...portraitEarShape, embedding: 0 });
  for (const change of [
    { centerY: NaN },
    { centerZ: Infinity },
    { heightScale: 0 },
    { depthScale: -1 },
    { projection: 0 },
    { embedding: -1 },
  ])
    TestValidator.predicate(
      "invalid pinna dimensions refused",
      throwsError(() =>
        buildPortraitEars(host(-0.07, 0.07), {
          ...portraitEarShape,
          ...change,
        }),
      ),
    );
  TestValidator.predicate(
    "missing temporal support refused",
    throwsError(() =>
      buildPortraitEars({
        positions: [],
        indices: [],
        normals: null,
        uvs: null,
        skin: null,
      }),
    ),
  );
};
