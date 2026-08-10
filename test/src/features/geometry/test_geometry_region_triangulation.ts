import {
  IAutoMovieRegionTriangulation,
  triangulateAutoMovieRegion,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

interface IPlanarPoint {
  x: number;
  y: number;
}

const signedArea = (points: readonly IPlanarPoint[]): number => {
  let total = 0;
  for (let index = 0; index < points.length; ++index) {
    const from = points[index]!;
    const to = points[(index + 1) % points.length]!;
    total += from.x * to.y - to.x * from.y;
  }
  return total / 2;
};

const triangleAreas = (plan: IAutoMovieRegionTriangulation): number[] => {
  const areas: number[] = [];
  for (let at = 0; at < plan.triangles.length; at += 3)
    areas.push(
      signedArea([
        plan.points[plan.triangles[at]!]!,
        plan.points[plan.triangles[at + 1]!]!,
        plan.points[plan.triangles[at + 2]!]!,
      ]),
    );
  return areas;
};

/**
 * A triangulation covers the region exactly when its triangles are all wound
 * counter-clockwise and their areas add up to the region's own area: a fan that
 * strayed outside the contour would need an inverted triangle to cancel the
 * excess, so the two sums disagreeing is the witness of both failures at once.
 */
const coversExactly = (
  plan: IAutoMovieRegionTriangulation,
  area: number,
): boolean => {
  const areas = triangleAreas(plan);
  return (
    areas.every((one) => one > 0) &&
    nclose(
      areas.reduce((total, one) => total + one, 0),
      area,
      1e-12,
    ) &&
    nclose(plan.area, area, 1e-12)
  );
};

const ringOf = (
  plan: IAutoMovieRegionTriangulation,
  at: number,
): IPlanarPoint[] =>
  plan.points.slice(
    plan.rings[at]!.start,
    plan.rings[at]!.start + plan.rings[at]!.count,
  );

const ell = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 3, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 3 },
  { x: 0, y: 3 },
];

const square = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
];

const inner = [
  { x: 1, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 3 },
  { x: 1, y: 3 },
];

/**
 * The free-form region triangulator: an arbitrary contour less its holes.
 *
 * Every expectation is hand math against the authored outline. An L of legs 3x1
 * and 1x2 encloses 5 m² and a simple hexagon resolves to four triangles; a 4 m
 * square holding a 2 m square hole encloses 12 m² and the ten corners the
 * bridge leaves resolve to eight. Coverage is checked as a pair of sums rather
 * than a triangle count, because a count alone cannot tell a triangulation from
 * a fan that strayed outside the contour and cancelled the excess with an
 * inverted triangle.
 *
 * Scenarios:
 *
 * 1. A concave contour triangulates to `points - 2` counter-clockwise triangles
 *    covering exactly its own area, which the convex kernel refuses outright.
 * 2. A square holding a square hole bridges into one ring of ten corners, resolves
 *    to eight triangles, and covers the outer ring less the hole.
 * 3. Two holes bridge independently, and a hole inside a concave outer ring
 *    bridges against a contour that is not convex.
 * 4. Winding is canonicalized, not demanded: a clockwise outer ring and a
 *    counter-clockwise hole come back counter-clockwise and clockwise, and the
 *    triangles are identical to the ones the canonical authoring produces.
 * 5. Determinism: the same authored region rebuilds byte-identically.
 * 6. Negative twins: each refusal fires one property away from a region that
 *    triangulates, covering short, non-finite, repeated, spiked, empty,
 *    self-crossing, touching, escaped, and nested rings.
 */
export const test_geometry_region_triangulation = (): void => {
  const concave = triangulateAutoMovieRegion({ outer: ell });
  TestValidator.equals(
    "a concave contour triangulates to exactly its own area",
    namedFacts([
      ["triangles", () => concave.triangles.length === (ell.length - 2) * 3],
      ["rings", () => concave.rings.length === 1],
      [
        "span",
        () =>
          concave.rings[0]!.start === 0 &&
          concave.rings[0]!.count === ell.length,
      ],
      ["covers", () => coversExactly(concave, 5)],
    ]),
    { triangles: true, rings: true, span: true, covers: true },
  );

  const holed = triangulateAutoMovieRegion({ outer: square, holes: [inner] });
  TestValidator.equals(
    "a square holding a square hole bridges into one ring and covers the remainder",
    namedFacts([
      // Four outer corners, four hole corners, and the bridge repeating one of
      // each: ten corners, so ten minus two triangles.
      ["triangles", () => holed.triangles.length === 8 * 3],
      ["points", () => holed.points.length === 8],
      [
        "rings",
        () =>
          holed.rings.length === 2 &&
          holed.rings[1]!.start === 4 &&
          holed.rings[1]!.count === 4,
      ],
      ["outerWinding", () => signedArea(ringOf(holed, 0)) === 16],
      ["holeWinding", () => signedArea(ringOf(holed, 1)) === -4],
      ["covers", () => coversExactly(holed, 12)],
    ]),
    {
      triangles: true,
      points: true,
      rings: true,
      outerWinding: true,
      holeWinding: true,
      covers: true,
    },
  );

  const twoHoles = triangulateAutoMovieRegion({
    outer: square,
    holes: [
      [
        { x: 0.5, y: 0.5 },
        { x: 1.5, y: 0.5 },
        { x: 1.5, y: 1.5 },
        { x: 0.5, y: 1.5 },
      ],
      [
        { x: 2.5, y: 2.5 },
        { x: 3.5, y: 2.5 },
        { x: 3.5, y: 3.5 },
        { x: 2.5, y: 3.5 },
      ],
    ],
  });
  // A hole inside a concave outer ring, so the contour the bridge is chosen
  // against is not convex.
  const notched = triangulateAutoMovieRegion({
    outer: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 3.5, y: 6 },
      { x: 3.5, y: 2 },
      { x: 2.5, y: 2 },
      { x: 2.5, y: 6 },
      { x: 0, y: 6 },
    ],
    holes: [
      [
        { x: 4.5, y: 3 },
        { x: 5.5, y: 3 },
        { x: 5.5, y: 4 },
        { x: 4.5, y: 4 },
      ],
    ],
  });
  TestValidator.equals(
    "several holes and a hole inside a concave contour each bridge and cover",
    namedFacts([
      ["twoHoles", () => coversExactly(twoHoles, 16 - 1 - 1)],
      ["twoHoleTriangles", () => twoHoles.triangles.length === 14 * 3],
      ["notched", () => coversExactly(notched, 6 * 6 - 1 * 4 - 1)],
      ["notchedTriangles", () => notched.triangles.length === 12 * 3],
    ]),
    {
      twoHoles: true,
      twoHoleTriangles: true,
      notched: true,
      notchedTriangles: true,
    },
  );

  const reversed = triangulateAutoMovieRegion({
    outer: [...square].reverse(),
    holes: [[...inner].reverse()],
  });
  TestValidator.equals(
    "a region authored the other way round is canonicalized, not refused",
    namedFacts([
      ["outerWinding", () => signedArea(ringOf(reversed, 0)) === 16],
      ["holeWinding", () => signedArea(ringOf(reversed, 1)) === -4],
      ["covers", () => coversExactly(reversed, 12)],
    ]),
    { outerWinding: true, holeWinding: true, covers: true },
  );

  TestValidator.equals(
    "the same authored region rebuilds byte-identically",
    JSON.stringify(
      triangulateAutoMovieRegion({ outer: square, holes: [inner] }),
    ),
    JSON.stringify(holed),
  );

  const invalids: Array<readonly [string, () => unknown, string]> = [
    [
      "short ring",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      "polygon outer ring needs at least three points",
    ],
    [
      "non-finite corner",
      () =>
        triangulateAutoMovieRegion({
          outer: [{ x: 0, y: Number.POSITIVE_INFINITY }, ...ell.slice(1)],
        }),
      "polygon outer ring[0] must be finite",
    ],
    [
      "repeated corner",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
          ],
        }),
      "polygon outer ring[0] repeats the point beside it",
    ],
    [
      "spike",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 2 },
          ],
        }),
      "polygon outer ring[1] doubles back along its own edge",
    ],
    [
      "collinear ring",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 2, y: 0 },
          ],
        }),
      "polygon outer ring encloses no area",
    ],
    [
      "ring whose halves cancel",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 2, y: 2 },
            { x: 2, y: 0 },
            { x: 0, y: 2 },
          ],
        }),
      "polygon outer ring encloses no area",
    ],
    [
      "self-crossing ring",
      () =>
        triangulateAutoMovieRegion({
          outer: [
            { x: 0, y: 0 },
            { x: 4, y: 4 },
            { x: 4, y: 0 },
            { x: 0, y: 3 },
          ],
        }),
      "polygon outer ring crosses itself between edge 0 and edge 2",
    ],
    [
      "hole crossing the outer ring",
      () =>
        triangulateAutoMovieRegion({
          outer: square,
          holes: [
            [
              { x: 3, y: 1 },
              { x: 5, y: 1 },
              { x: 5, y: 3 },
              { x: 3, y: 3 },
            ],
          ],
        }),
      "polygon outer ring and polygon hole[0] touch or cross",
    ],
    [
      "hole touching the outer ring",
      () =>
        triangulateAutoMovieRegion({
          outer: square,
          holes: [
            [
              { x: 1, y: 1 },
              { x: 4, y: 1 },
              { x: 4, y: 3 },
              { x: 1, y: 3 },
            ],
          ],
        }),
      "polygon outer ring and polygon hole[0] touch or cross",
    ],
    [
      "hole outside the outer ring",
      () =>
        triangulateAutoMovieRegion({
          outer: square,
          holes: [
            [
              { x: 6, y: 6 },
              { x: 7, y: 6 },
              { x: 7, y: 7 },
              { x: 6, y: 7 },
            ],
          ],
        }),
      "polygon hole[0] must lie inside polygon outer ring",
    ],
    [
      "hole nested in another hole",
      () =>
        triangulateAutoMovieRegion({
          outer: square,
          holes: [
            inner,
            [
              { x: 1.5, y: 1.5 },
              { x: 2.5, y: 1.5 },
              { x: 2.5, y: 2.5 },
              { x: 1.5, y: 2.5 },
            ],
          ],
        }),
      "polygon hole[1] must lie outside polygon hole[0]",
    ],
  ];
  for (const [name, callback, message] of invalids)
    TestValidator.predicate(
      `${name} is refused by its own diagnostic`,
      throwsError(callback, message),
    );
};
