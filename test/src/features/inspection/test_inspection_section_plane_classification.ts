import {
  IAutoMovieSectionPlane,
  autoMovieSectionPlaneDistance,
  autoMovieSectionPlanesKeepPoint,
  classifyAutoMovieSectionPlaneBox,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/** A horizontal cut at y = 3: everything ABOVE it is removed. */
const CEILING: IAutoMovieSectionPlane = {
  point: { x: 0, y: 3, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
};

/** A vertical cut at x = 0 removing everything to the WEST, deliberately
 * declared with a non-unit normal so normalization is exercised. */
const WEST_WALL: IAutoMovieSectionPlane = {
  point: { x: 0, y: 0, z: 0 },
  normal: { x: -4, y: 0, z: 0 },
};

const box = (
  min: [number, number, number],
  max: [number, number, number],
): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
} => ({
  min: { x: min[0], y: min[1], z: min[2] },
  max: { x: max[0], y: max[1], z: max[2] },
});

/**
 * Section planes: the inspection-owned cut that lets a reviewer read a floor
 * plan of the building an authoring agent just built.
 *
 * A cutaway is what `#1902`'s reference images were, and what the product could
 * not reproduce of its own result: outside hides the interior, inside shows one
 * room, and deleting a wall to see past it reviews a different production. This
 * pins the half-space arithmetic that answers it, and above all the boundary,
 * because a cut taken at a floor's own level puts every vertex of that floor at
 * exactly zero — dropping them would delete the surface the reviewer asked for,
 * and it would disagree with `three.js`, which discards only a strictly
 * negative signed distance.
 *
 * The oracles are hand geometry, not the code's own output: a point 1 m under a
 * y = 3 cut is at −1 m, a non-unit normal of length 4 must still report metres,
 * and a box straddling the cut is `crossed` while one entirely above it is
 * `cut`.
 *
 * Scenarios:
 *
 * 1. Signed distance below, above and exactly on a horizontal cut: −1, +1, 0,
 *    with zero on the kept side. Guards the boundary rule itself.
 * 2. A non-unit normal (length 4) reports the same metres as its unit twin, so
 *    the caller is not asked to pre-normalize. Guards the division.
 * 3. A zero normal and a non-finite normal are refused with `RangeError`
 *    instead of silently meaning "keep everything". Guards both halves of the
 *    degenerate check.
 * 4. Point keep: kept under the cut, removed above it, and kept exactly on it;
 *    an empty plane list keeps a point that any declared plane would remove.
 *    Guards the "no section is the absence of a declaration" rule.
 * 5. Two planes intersect rather than union: a point west of x = 0 AND under
 *    y = 3 is removed by the first plane even though the second keeps it.
 * 6. Box classification with the removed side on the positive axis: a box
 *    entirely below is `kept`, entirely above is `cut`, straddling is
 *    `crossed`. Guards the support-corner choice for a positive normal.
 * 7. Box classification with the removed side on the NEGATIVE axis
 *    (`WEST_WALL`), which picks the opposite corners. Without this the corner
 *    selection could be inverted and every test above would still pass.
 * 8. A box whose top face lies exactly ON the cut is `kept`, and one whose
 *    bottom face lies exactly on it is `crossed` rather than `cut`, because the
 *    touching face survives. The exact-boundary twin of case 6.
 * 9. An empty plane list classifies any box as `kept`, the regression that
 *    keeps an uncut scene reading exactly as it did before section planes
 *    existed.
 */
export const test_inspection_section_plane_classification = (): void => {
  // 1. signed distance, including the boundary
  TestValidator.predicate(
    "one metre under a y=3 cut is -1",
    nclose(autoMovieSectionPlaneDistance(CEILING, { x: 7, y: 2, z: -5 }), -1),
  );
  TestValidator.predicate(
    "one metre over a y=3 cut is +1",
    nclose(autoMovieSectionPlaneDistance(CEILING, { x: 7, y: 4, z: -5 }), 1),
  );
  TestValidator.equals(
    "a point exactly on the cut is exactly zero",
    autoMovieSectionPlaneDistance(CEILING, { x: 7, y: 3, z: -5 }),
    0,
  );

  // 2. a non-unit normal still reports metres
  TestValidator.predicate(
    "a length-4 normal reports the same metres as its unit twin",
    nclose(
      autoMovieSectionPlaneDistance(WEST_WALL, { x: -2.5, y: 1, z: 0 }),
      2.5,
    ),
  );

  // 3. degenerate normals are refused, not defaulted
  TestValidator.predicate(
    "a zero normal is refused",
    throwsError(() =>
      autoMovieSectionPlaneDistance(
        { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } },
        { x: 1, y: 1, z: 1 },
      ),
    ),
  );
  TestValidator.predicate(
    "a non-finite normal is refused",
    throwsError(() =>
      autoMovieSectionPlaneDistance(
        { point: { x: 0, y: 0, z: 0 }, normal: { x: Number.NaN, y: 1, z: 0 } },
        { x: 1, y: 1, z: 1 },
      ),
    ),
  );

  // 4. point keep, including the boundary and the empty declaration
  TestValidator.equals(
    "a point under the cut is kept",
    autoMovieSectionPlanesKeepPoint([CEILING], { x: 0, y: 2.9, z: 0 }),
    true,
  );
  TestValidator.equals(
    "a point over the cut is removed",
    autoMovieSectionPlanesKeepPoint([CEILING], { x: 0, y: 3.1, z: 0 }),
    false,
  );
  TestValidator.equals(
    "a point exactly on the cut is kept",
    autoMovieSectionPlanesKeepPoint([CEILING], { x: 0, y: 3, z: 0 }),
    true,
  );
  TestValidator.equals(
    "no declared plane keeps everything",
    autoMovieSectionPlanesKeepPoint([], { x: 0, y: 900, z: 0 }),
    true,
  );

  // 5. planes intersect rather than union
  TestValidator.equals(
    "one removing plane removes the point even when another keeps it",
    autoMovieSectionPlanesKeepPoint([WEST_WALL, CEILING], {
      x: -1,
      y: 1,
      z: 0,
    }),
    false,
  );

  // 6. box classification, removed side on the positive axis
  TestValidator.equals(
    "a box entirely under the cut is kept",
    classifyAutoMovieSectionPlaneBox({
      planes: [CEILING],
      ...box([-1, 0, -1], [1, 2, 1]),
    }),
    "kept",
  );
  TestValidator.equals(
    "a box entirely over the cut is cut",
    classifyAutoMovieSectionPlaneBox({
      planes: [CEILING],
      ...box([-1, 4, -1], [1, 6, 1]),
    }),
    "cut",
  );
  TestValidator.equals(
    "a box straddling the cut is crossed",
    classifyAutoMovieSectionPlaneBox({
      planes: [CEILING],
      ...box([-1, 2, -1], [1, 4, 1]),
    }),
    "crossed",
  );

  // 7. the mirrored corner choice: removed side on the negative axis
  TestValidator.equals(
    "a box entirely east of a west-removing cut is kept",
    classifyAutoMovieSectionPlaneBox({
      planes: [WEST_WALL],
      ...box([1, 0, -1], [3, 2, 1]),
    }),
    "kept",
  );
  TestValidator.equals(
    "a box entirely west of a west-removing cut is cut",
    classifyAutoMovieSectionPlaneBox({
      planes: [WEST_WALL],
      ...box([-3, 0, -1], [-1, 2, 1]),
    }),
    "cut",
  );
  TestValidator.equals(
    "a box straddling a west-removing cut is crossed",
    classifyAutoMovieSectionPlaneBox({
      planes: [WEST_WALL],
      ...box([-1, 0, -1], [1, 2, 1]),
    }),
    "crossed",
  );

  // 8. exact contact on either face
  TestValidator.equals(
    "a box whose top face lies on the cut is kept whole",
    classifyAutoMovieSectionPlaneBox({
      planes: [CEILING],
      ...box([-1, 1, -1], [1, 3, 1]),
    }),
    "kept",
  );
  TestValidator.equals(
    "a box whose bottom face lies on the cut is crossed, not cut",
    classifyAutoMovieSectionPlaneBox({
      planes: [CEILING],
      ...box([-1, 3, -1], [1, 5, 1]),
    }),
    "crossed",
  );

  // 9. regression: an uncut scene
  TestValidator.equals(
    "no declared plane classifies any box as kept",
    classifyAutoMovieSectionPlaneBox({
      planes: [],
      ...box([-100, -100, -100], [100, 100, 100]),
    }),
    "kept",
  );
};
