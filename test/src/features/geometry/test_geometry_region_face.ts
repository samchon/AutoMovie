import {
  buildAutoMovieRegionFace,
  inspectAutoMovieMeshTopology,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * A region face is one oriented surface, not the two coincident sides emitted
 * by the legacy zero-height plane primitive. That identity is what lets an
 * author place separate interior and exterior material layers without adding a
 * camera-dependent optical shader.
 *
 * Scenarios:
 *
 * 1. A rectangle with a rectangular void becomes a positive-Z, open mesh whose
 *    positions and UVs retain the authored metre coordinates.
 * 2. Reversing both authored rings produces the identical canonical mesh, so
 *    input winding does not make an interior layer face the wrong way.
 * 3. A self-crossing boundary keeps the shared planar-region refusal rather
 *    than producing an ambiguous material surface.
 */
export const test_geometry_region_face = (): void => {
  const outer = [
    { x: -2, y: -1 },
    { x: 2, y: -1 },
    { x: 2, y: 1 },
    { x: -2, y: 1 },
  ] as const;
  const hole = [
    { x: -0.5, y: -0.25 },
    { x: 0.5, y: -0.25 },
    { x: 0.5, y: 0.25 },
    { x: -0.5, y: 0.25 },
  ] as const;
  const face = buildAutoMovieRegionFace({ outer, holes: [hole] });
  const topology = inspectAutoMovieMeshTopology(face);

  TestValidator.equals(
    "one canonical positive-Z face retains metric coordinates and its opening",
    namedFacts([
      ["vertex count", () => face.positions.length === 24],
      ["normal count", () => face.normals?.length === face.positions.length],
      [
        "positive Z",
        () =>
          face.normals?.every((n, index) => index % 3 !== 2 || n === 1) ===
          true,
      ],
      [
        "zero X/Y normals",
        () =>
          face.normals?.every((n, index) => index % 3 === 2 || n === 0) ===
          true,
      ],
      [
        "metric UVs",
        () =>
          face.uvs?.every(
            (value, index) =>
              value === face.positions[(index >> 1) * 3 + (index % 2)],
          ) === true,
      ],
      [
        "open boundary",
        () => topology.watertight === false && topology.boundaryEdges === 8,
      ],
      ["not degenerate", () => topology.degenerate === 0],
      ["one side only", () => face.indices?.length === 24],
    ]),
    {
      "vertex count": true,
      "normal count": true,
      "positive Z": true,
      "zero X/Y normals": true,
      "metric UVs": true,
      "open boundary": true,
      "not degenerate": true,
      "one side only": true,
    },
  );

  TestValidator.equals(
    "authored winding cannot reverse the material-facing side",
    buildAutoMovieRegionFace({
      outer: [...outer].reverse(),
      holes: [[...hole].reverse()],
    }),
    face,
  );

  TestValidator.predicate(
    "an ambiguous boundary is refused before it becomes a surface",
    throwsError(
      () =>
        buildAutoMovieRegionFace({
          outer: [
            { x: 0, y: 0 },
            { x: 4, y: 4 },
            { x: 4, y: 0 },
            { x: 0, y: 3 },
          ],
        }),
      "crosses itself",
    ),
  );
};
