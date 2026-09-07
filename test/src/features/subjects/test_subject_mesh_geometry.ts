import { TestValidator } from "@nestia/e2e";

import {
  portraitMix,
  portraitNormals,
  portraitPart,
  portraitPatch,
  portraitPoint,
  portraitRegion,
  portraitSpline,
  portraitTube,
} from "../../subjects/geometry";
import { nclose } from "../internal/predicates";

/**
 * Portrait construction must preserve metric scale, winding and shared normals.
 * These oracles come from a planar rectangle and two perpendicular triangles.
 *
 * Scenarios:
 * 1. A 1000 by 2000 mm patch faces +Z and becomes a 1 by 2 metre part.
 * 2. Two equal-area perpendicular faces average to a 45-degree shared normal;
 *    an unused vertex and an empty surface retain zero/empty normals.
 * 3. Region extraction removes unused vertices without changing triangle order
 *    or the parent normal field, including the empty-region boundary.
 * 4. A straight spline clamps both ends and interpolates its midpoint; a swept
 *    vertical path keeps its declared radius at both ends.
 */
export const test_subject_mesh_geometry = (): void => {
  const p = portraitPoint;
  const rectangle = portraitPatch((u, v) => p(1000 * u, 2000 * v, 0), 1, 1);
  TestValidator.equals(
    "rectangle winding",
    rectangle.indices,
    [0, 1, 2, 1, 3, 2],
  );
  TestValidator.equals(
    "rectangle normals",
    rectangle.normals,
    [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  );
  const part = portraitPart("rectangle", rectangle, "finish");
  TestValidator.predicate(
    "metric mesh part",
    part.geometry.type === "mesh" &&
      nclose(Math.max(...part.geometry.mesh.positions), 2),
  );
  TestValidator.equals(
    "interpolation permits extrapolation",
    portraitMix(2, 4, 2),
    6,
  );

  const positions = [0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 1, 9, 9, 9];
  const normals = portraitNormals(positions, [0, 1, 2, 0, 3, 1]);
  TestValidator.predicate(
    "shared area-weighted normal",
    nclose(normals[0], 0) &&
      nclose(normals[1], Math.SQRT1_2) &&
      nclose(normals[2], Math.SQRT1_2),
  );
  TestValidator.equals("unused vertex", normals.slice(12), [0, 0, 0]);
  TestValidator.equals("empty normal field", portraitNormals([], []), []);
  const region = portraitRegion(positions, normals, [0, 3, 1, 0, 1, 3]);
  TestValidator.equals(
    "region remaps repeated vertices",
    region.indices,
    [0, 1, 2, 0, 2, 1],
  );
  TestValidator.equals(
    "region has only referenced positions",
    region.positions,
    [0, 0, 0, 0, 0, 1, 2, 0, 0],
  );
  TestValidator.equals(
    "region keeps parent shading",
    region.normals?.slice(0, 3),
    normals.slice(0, 3),
  );
  TestValidator.equals(
    "empty region",
    portraitRegion(positions, normals, []).positions,
    [],
  );

  const line = [p(0, 0, 0), p(2, 4, 6)];
  TestValidator.equals("spline start clamp", portraitSpline(line, -1), line[0]);
  TestValidator.equals("spline end clamp", portraitSpline(line, 2), line[1]);
  TestValidator.equals(
    "spline midpoint",
    portraitSpline(line, 0.5),
    p(1, 2, 3),
  );
  TestValidator.equals(
    "interior spline segment",
    portraitSpline([p(0, 0, 0), p(1, 2, 3), p(2, 4, 6), p(3, 6, 9)], 0.5),
    p(1.5, 3, 4.5),
  );
  const tube = portraitTube(
    (t) => p(0, 10 * t, 0),
    (t) => 1 + t,
    2,
  );
  TestValidator.predicate(
    "sweep radii follow path progress",
    tube.positions.every(
      (value, i, values) =>
        i % 3 !== 0 ||
        nclose(Math.hypot(value, values[i + 2]), 1 + values[i + 1] / 10),
    ),
  );
};
