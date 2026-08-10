import { surfaceHeightAt, tessellateSurface } from "@automovie/engine";
import { IAutoMovieSurface } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** A diamond footprint over a 3x3 lattice carrying a peak, a terrace, a bank. */
const relief = (samples: number[]): IAutoMovieSurface => ({
  id: "relief",
  kind: "floor",
  polygon: [
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 1 },
    { x: 1, y: 0, z: 2 },
  ],
  height: {
    kind: "heightfield",
    originX: 0,
    originZ: 0,
    spacingX: 1,
    spacingZ: 1,
    columns: 3,
    rows: 3,
    samples,
  },
});

/** Every tessellated vertex, as an `(x, z, y)` triple. */
const vertices = (positions: number[]): Array<[number, number, number]> =>
  Array.from({ length: positions.length / 3 }, (_, index) => [
    positions[index * 3]!,
    positions[index * 3 + 2]!,
    positions[index * 3 + 1]!,
  ]);

/**
 * The support surface a viewer draws is the one engine height queries answer.
 *
 * `buildSpaceObject()` used to lift only the footprint's hull corners, so a
 * lattice peak existed for `surfaceHeightAt` and for foot placement while the
 * drawn ground stayed a flat quad: the crowd stood inside the hill. This case
 * pins the fix at its only honest oracle, which is that every emitted vertex's
 * height equals `surfaceHeightAt` at that vertex's own plan position, for a
 * peak, a terrace, and a bank alike.
 *
 * Scenarios:
 *
 * 1. A heightfield footprint splits at every interior lattice coordinate and every
 *    emitted vertex height equals `surfaceHeightAt` exactly.
 * 2. The lattice peak reaches its authored sample, and a terrace (equal
 *    neighbours) and a bank (a one-cell step) reproduce their own bilinear
 *    values rather than the hull's corner interpolation.
 * 3. Sloped relief tilts the emitted normals off vertical; a level patch does not.
 * 4. A footprint whose bounding box contains cells lying entirely outside the hull
 *    drops those cells instead of emitting them.
 * 5. Regression: a constant patch stays one two-triangle fan and a planar ramp
 *    reproduces `origin + slopeX·x + slopeZ·z` exactly, unchanged by the
 *    heightfield path.
 * 6. Negative twin: a collinear footprint encloses no area and tessellates to
 *    nothing at all.
 */
export const test_geometry_surface_heightfield = (): void => {
  const peak = relief([0, 0, 0, 0, 2, 0, 0, 0, 0]);
  const mesh = tessellateSurface(peak)!;
  TestValidator.equals(
    "every heightfield vertex height is the engine's own query at that point",
    namedFacts([
      ["triangles", () => mesh.indices.length > 2 * 3],
      [
        "agrees",
        () =>
          vertices(mesh.positions).every(([x, z, y]) =>
            nclose(y, surfaceHeightAt(peak, x, z), 1e-12),
          ),
      ],
      [
        "peak",
        () =>
          vertices(mesh.positions).some(
            ([x, z, y]) => x === 1 && z === 1 && nclose(y, 2),
          ),
      ],
    ]),
    { triangles: true, agrees: true, peak: true },
  );

  const terraced = relief([1, 1, 1, 1, 1, 1, 0, 0, 4]);
  const terracedMesh = tessellateSurface(terraced)!;
  TestValidator.equals(
    "a terrace and a bank reproduce their own bilinear heights",
    namedFacts([
      ["terrace", () => nclose(surfaceHeightAt(terraced, 0.5, 0.5), 1, 1e-12)],
      ["bank", () => nclose(surfaceHeightAt(terraced, 1.5, 1.5), 1.5, 1e-12)],
      [
        "agrees",
        () =>
          vertices(terracedMesh.positions).every(([x, z, y]) =>
            nclose(y, surfaceHeightAt(terraced, x, z), 1e-12),
          ),
      ],
    ]),
    { terrace: true, bank: true, agrees: true },
  );

  const level = tessellateSurface(relief([0, 0, 0, 0, 0, 0, 0, 0, 0]))!;
  TestValidator.equals(
    "relief tilts normals off vertical and a level lattice does not",
    namedFacts([
      [
        "tilted",
        () =>
          mesh.normals.some(
            (value, index) => index % 3 !== 1 && Math.abs(value) > 1e-6,
          ),
      ],
      [
        "upright",
        () =>
          level.normals.every((value, index) =>
            index % 3 === 1 ? nclose(value, 1) : nclose(value, 0),
          ),
      ],
    ]),
    { tilted: true, upright: true },
  );

  const corner: IAutoMovieSurface = {
    id: "corner",
    kind: "floor",
    polygon: [
      { x: 0, y: 0, z: 0 },
      { x: 4, y: 0, z: 0 },
      { x: 0, y: 0, z: 4 },
    ],
    height: {
      kind: "heightfield",
      originX: 0,
      originZ: 0,
      spacingX: 1,
      spacingZ: 1,
      columns: 5,
      rows: 5,
      samples: Array.from({ length: 25 }, (_, index) => index % 3),
    },
  };
  const cornerMesh = tessellateSurface(corner)!;
  TestValidator.equals(
    "lattice cells lying entirely outside the footprint are dropped",
    namedFacts([
      [
        "inside",
        () =>
          vertices(cornerMesh.positions).every(([x, z]) => x + z <= 4 + 1e-9),
      ],
      [
        "agrees",
        () =>
          vertices(cornerMesh.positions).every(([x, z, y]) =>
            nclose(y, surfaceHeightAt(corner, x, z), 1e-12),
          ),
      ],
    ]),
    { inside: true, agrees: true },
  );

  const ramp: IAutoMovieSurface = {
    ...peak,
    height: { kind: "plane", originHeight: 0.5, slopeX: 0.25, slopeZ: -0.5 },
  };
  const rampMesh = tessellateSurface(ramp)!;
  TestValidator.equals(
    "a constant patch stays one fan and a ramp reproduces its plane exactly",
    namedFacts([
      [
        "fan",
        () =>
          tessellateSurface({
            ...peak,
            height: { kind: "constant", value: 3 },
          })!.indices.length === 6,
      ],
      ["rampFan", () => rampMesh.indices.length === 6],
      [
        "plane",
        () =>
          vertices(rampMesh.positions).every(([x, z, y]) =>
            nclose(y, 0.5 + 0.25 * x - 0.5 * z, 1e-12),
          ),
      ],
    ]),
    { fan: true, rampFan: true, plane: true },
  );

  const anchored = tessellateSurface({
    id: "anchored",
    kind: "floor",
    polygon: peak.polygon,
    anchor: { x: 0, y: 1.75, z: 1 },
    rampTo: null,
  })!;
  TestValidator.equals(
    "a patch stating no height rule falls back to its anchor, still one fan",
    namedFacts([
      ["fan", () => anchored.indices.length === 6],
      [
        "anchor",
        () => vertices(anchored.positions).every(([, , y]) => nclose(y, 1.75)),
      ],
    ]),
    { fan: true, anchor: true },
  );

  TestValidator.equals(
    "a footprint enclosing no area tessellates to nothing",
    tessellateSurface({
      ...peak,
      polygon: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
    }),
    null,
  );
};
