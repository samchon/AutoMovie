import {
  builtConvexCellVertices,
  builtSpaceVolumeBounds,
} from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { boxCell } from "../internal/envelopeFixtures";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * A room is stated as the planes that cut it, so its corners have to be solved.
 *
 * Every question an interior observation asks starts from where the room
 * actually is, and a half-space cell says that only implicitly. Three planes
 * whose normals are independent meet at one point, and that point belongs to the
 * cell when every other plane admits it, which is the whole solve. What matters
 * for a review population is that the failures are honest rather than
 * approximated: a half-space that closes nothing produces no corners and
 * therefore no extent, instead of a box around the origin that a camera would
 * then be aimed into.
 *
 * Scenarios:
 *
 * 1. A unit cube's six planes produce its eight corners exactly once each, with
 *    the parallel triples that meet nowhere and the triples that meet outside
 *    the cell both discarded.
 * 2. Six planes through one point produce that point once rather than eight
 *    times, because a corner over-determined by its own planes is one corner.
 * 3. A plane whose normal is zero states no half-space and is skipped, so a cell
 *    carrying one is read from the planes that remain.
 * 4. A single half-space closes nothing and produces no corners at all.
 * 5. A celled space reports the extent of the corners its cells cut, a shelled
 *    space the extent of its own vertices, and a space stating neither reports
 *    nothing rather than a box at the origin.
 */
export const test_architecture_convex_cell_vertices = (): void => {
  TestValidator.equals(
    "a unit cube's planes cut exactly its own eight corners",
    ordered(
      builtConvexCellVertices(
        boxCell("cube", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }),
      ),
    ),
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 1, 1],
    ],
  );

  TestValidator.equals(
    "degenerate and redundant planes are read for what they state",
    namedFacts([
      [
        "six planes through one point cut that point once",
        () =>
          ordered(
            builtConvexCellVertices(
              boxCell("point", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
            ),
          ).length === 1,
      ],
      [
        "a plane with no normal states no half-space",
        () =>
          ordered(
            builtConvexCellVertices({
              id: "with-null-plane",
              planes: [
                { normal: { x: 0, y: 0, z: 0 }, offset: 7 },
                ...boxCell("cube", { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 })
                  .planes,
              ],
            }),
          ).length === 8,
      ],
      [
        "and one half-space closes nothing",
        () =>
          builtConvexCellVertices({
            id: "sky",
            planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: 3 }],
          }).length === 0,
      ],
    ]),
    {
      "six planes through one point cut that point once": true,
      "a plane with no normal states no half-space": true,
      "and one half-space closes nothing": true,
    },
  );

  TestValidator.equals(
    "both stated-volume spellings measure, and an unstated one measures nothing",
    namedFacts([
      [
        "a celled space measures the corners its planes cut",
        () => {
          const box = builtSpaceVolumeBounds({
            id: "hall",
            kind: "room",
            parent: null,
            cells: [
              boxCell("a", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 1 }),
              boxCell("b", { x: 0, y: 0, z: 1 }, { x: 1, y: 3, z: 4 }),
            ],
          });
          return (
            box !== null &&
            vclose(box.min, { x: 0, y: 0, z: 0 }) &&
            vclose(box.max, { x: 4, y: 3, z: 4 })
          );
        },
      ],
      [
        "a shelled space measures its own vertices",
        () => {
          const box = builtSpaceVolumeBounds({
            id: "hall",
            kind: "room",
            parent: null,
            cells: [],
            shell: {
              vertices: [
                { x: 0, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
                { x: 0, y: 1, z: 0 },
                { x: 0, y: 0, z: 1 },
              ],
              triangles: [0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3],
            },
          });
          return (
            box !== null &&
            vclose(box.min, { x: 0, y: 0, z: 0 }) &&
            vclose(box.max, { x: 1, y: 1, z: 1 })
          );
        },
      ],
      [
        "a space stating no volume measures nothing",
        () =>
          builtSpaceVolumeBounds({
            id: "hall",
            kind: "zone",
            parent: null,
            cells: [],
          }) === null,
      ],
      [
        "and a space whose cell closes nothing measures nothing either",
        () =>
          builtSpaceVolumeBounds({
            id: "hall",
            kind: "room",
            parent: null,
            cells: [
              {
                id: "sky",
                planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: 3 }],
              },
            ],
          }) === null,
      ],
    ]),
    {
      "a celled space measures the corners its planes cut": true,
      "a shelled space measures its own vertices": true,
      "a space stating no volume measures nothing": true,
      "and a space whose cell closes nothing measures nothing either": true,
    },
  );
};

/**
 * Solved corners as rounded triples in one deterministic order.
 *
 * A linear solve returns metres, not exact integers, so each coordinate is
 * rounded to the nanometre before comparison; a corner of a unit cube is not
 * wrong by one part in a quadrillion.
 */
const ordered = (
  vertices: readonly IAutoMovieVector3[],
): Array<[number, number, number]> =>
  vertices
    .map((vertex): [number, number, number] => [
      Math.round(vertex.x * 1e9) / 1e9,
      Math.round(vertex.y * 1e9) / 1e9,
      Math.round(vertex.z * 1e9) / 1e9,
    ])
    .sort(
      (left, right) =>
        left[0] - right[0] || left[1] - right[1] || left[2] - right[2],
    );
