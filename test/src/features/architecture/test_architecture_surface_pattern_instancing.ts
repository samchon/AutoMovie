import {
  Quaternion,
  autoMoviePatternInstanceTransforms,
  generateAutoMovieSurfacePattern,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { pattern, rectangle, zone } from "../internal/patternFixtures";
import {
  namedFacts,
  nclose,
  qunit,
  throwsError,
  vclose,
} from "../internal/predicates";

const WALL = {
  origin: { x: 0, y: 0, z: 0 },
  u: { x: 1, y: 0, z: 0 },
  v: { x: 0, y: 1, z: 0 },
};

const FLOOR = {
  origin: { x: 0, y: 0, z: 0 },
  u: { x: 0, y: 0, z: 1 },
  v: { x: 1, y: 0, z: 0 },
};

/**
 * Laid modules become exact instance slots, and cut pieces refuse to pretend.
 *
 * A repeated tile is the case GPU instancing exists for, so a pattern run has
 * to leave as full-TRS slots rather than as duplicated vertex data: the
 * occurrence id becomes the slot id, the in-plane rotation becomes a real unit
 * quaternion instead of a yaw, and the module's two face dimensions plus its
 * thickness become a per-axis scale instead of a uniform one. A cut piece is
 * the one thing an instance cannot be, and is handed back by id instead of
 * being scaled into something the wrong shape.
 *
 * Scenarios:
 *
 * 1. Eight whole modules on a wall face become eight slots at the module centres,
 *    with identity rotation and a scale that is not uniform.
 * 2. On a floor face whose axes are a different handedness of the same frame, the
 *    quaternion carries the prototype's local axes onto the module's own U
 *    axis, its V axis, and the face normal.
 * 3. A module rotated ninety degrees in the face plane turns its local X onto the
 *    face V axis, which a yaw about the world up axis could not express.
 * 4. Cut occurrences produce no slot and are returned by id.
 * 5. A prototype table is indexed by the occurrence's own seeded variant, the same
 *    variant twice for the same seed, and every variant stays inside the
 *    declared count. With one variant the draw is always zero.
 * 6. A frame that is not orthonormal, a non-positive thickness, and a prototype
 *    table that cannot cover a drawn variant are each refused.
 */
export const test_architecture_surface_pattern_instancing = (): void => {
  const laid = generateAutoMovieSurfacePattern({
    pattern: pattern({ variants: 3, seed: 20260810 }),
  });
  const wall = autoMoviePatternInstanceTransforms({
    result: laid,
    frame: WALL,
    thickness: 0.012,
  });

  TestValidator.equals(
    "every whole module becomes one slot carrying its own occurrence id",
    wall.transforms.map((one) => one.id),
    laid.placements.map((one) => one.id),
  );
  TestValidator.equals(
    "a wall face places modules at their centres with a non-uniform scale",
    namedFacts([
      ["cut", () => wall.cut.length === 0],
      [
        "first",
        () =>
          vclose(wall.transforms[0]!.translation, { x: 0.25, y: 0.25, z: 0 }),
      ],
      [
        "last",
        () =>
          vclose(wall.transforms[7]!.translation, { x: 1.75, y: 0.75, z: 0 }),
      ],
      [
        "identity",
        () =>
          wall.transforms.every((one) =>
            vclose(
              Quaternion.rotateVector(one.rotation, { x: 1, y: 0, z: 0 }),
              {
                x: 1,
                y: 0,
                z: 0,
              },
            ),
          ),
      ],
      ["unit", () => wall.transforms.every((one) => qunit(one.rotation))],
      [
        "scale",
        () =>
          wall.transforms.every(
            (one) =>
              nclose(one.scale.x, 0.5, 1e-12) &&
              nclose(one.scale.y, 0.5, 1e-12) &&
              nclose(one.scale.z, 0.012, 1e-12),
          ),
      ],
      [
        "nonUniform",
        () => wall.transforms[0]!.scale.x !== wall.transforms[0]!.scale.z,
      ],
    ]),
    {
      cut: true,
      first: true,
      last: true,
      identity: true,
      unit: true,
      scale: true,
      nonUniform: true,
    },
  );

  const floor = autoMoviePatternInstanceTransforms({
    result: laid,
    frame: FLOOR,
    thickness: 0.02,
  });
  const floorRotation = floor.transforms[0]!.rotation;
  TestValidator.equals(
    "the quaternion carries the prototype axes onto the face axes",
    namedFacts([
      [
        "translation",
        () =>
          vclose(floor.transforms[0]!.translation, { x: 0.25, y: 0, z: 0.25 }),
      ],
      [
        "localX",
        () =>
          vclose(Quaternion.rotateVector(floorRotation, { x: 1, y: 0, z: 0 }), {
            x: 0,
            y: 0,
            z: 1,
          }),
      ],
      [
        "localY",
        () =>
          vclose(Quaternion.rotateVector(floorRotation, { x: 0, y: 1, z: 0 }), {
            x: 1,
            y: 0,
            z: 0,
          }),
      ],
      [
        "localZ",
        () =>
          vclose(Quaternion.rotateVector(floorRotation, { x: 0, y: 0, z: 1 }), {
            x: 0,
            y: 1,
            z: 0,
          }),
      ],
      ["unit", () => qunit(floorRotation)],
    ]),
    {
      translation: true,
      localX: true,
      localY: true,
      localZ: true,
      unit: true,
    },
  );

  const turned = autoMoviePatternInstanceTransforms({
    result: generateAutoMovieSurfacePattern({
      pattern: pattern({
        zones: [
          zone({
            region: rectangle(0, 0, 1, 1),
            period: { u: 1, v: 1 },
            reach: { u: 0.7, v: 0.85 },
            generate: ({ column, row, origin }) => [
              {
                id: `t-${column}-${row}`,
                center: { u: origin.u + 0.5, v: origin.v + 0.5 },
                size: { u: 0.6, v: 0.3 },
                rotationDeg: 90,
                grainDeg: 0,
              },
            ],
          }),
        ],
      }),
    }),
    frame: WALL,
    thickness: 0.012,
  });
  TestValidator.equals(
    "an in-plane rotation is a real quaternion, not a yaw about world up",
    namedFacts([
      [
        "localX",
        () =>
          vclose(
            Quaternion.rotateVector(turned.transforms[0]!.rotation, {
              x: 1,
              y: 0,
              z: 0,
            }),
            { x: 0, y: 1, z: 0 },
          ),
      ],
      [
        "localY",
        () =>
          vclose(
            Quaternion.rotateVector(turned.transforms[0]!.rotation, {
              x: 0,
              y: 1,
              z: 0,
            }),
            { x: -1, y: 0, z: 0 },
          ),
      ],
      [
        "scale",
        () =>
          nclose(turned.transforms[0]!.scale.x, 0.6, 1e-12) &&
          nclose(turned.transforms[0]!.scale.y, 0.3, 1e-12),
      ],
    ]),
    { localX: true, localY: true, scale: true },
  );

  const narrow = generateAutoMovieSurfacePattern({
    pattern: pattern({
      zones: [zone({ region: rectangle(0, 0, 1.75, 1) })],
      minimumPiece: 0.4,
    }),
  });
  const partial = autoMoviePatternInstanceTransforms({
    result: narrow,
    frame: WALL,
    thickness: 0.012,
  });
  TestValidator.equals(
    "a cut piece produces no slot and is named for the caller to build",
    {
      slots: partial.transforms.length,
      cut: partial.cut,
    },
    { slots: 6, cut: ["field/t-3-0", "field/t-3-1"] },
  );

  const prototypes = ["worn", "clean", "chipped"];
  const varied = autoMoviePatternInstanceTransforms({
    result: laid,
    frame: WALL,
    thickness: 0.012,
    prototypes,
  });
  TestValidator.equals(
    "the seeded variant selects the prototype, the same way every run",
    namedFacts([
      [
        "inRange",
        () =>
          laid.placements.every((one) => one.variant >= 0 && one.variant < 3),
      ],
      [
        "indexed",
        () =>
          varied.transforms.every(
            (one, index) =>
              one.prototype === prototypes[laid.placements[index]!.variant],
          ),
      ],
      [
        "varies",
        () => new Set(laid.placements.map((one) => one.variant)).size > 1,
      ],
      [
        "repeatable",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({ variants: 3, seed: 20260810 }),
          })
            .placements.map((one) => one.variant)
            .join() === laid.placements.map((one) => one.variant).join(),
      ],
      [
        "seedMatters",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({ variants: 3, seed: 20260811 }),
          })
            .placements.map((one) => one.variant)
            .join() !== laid.placements.map((one) => one.variant).join(),
      ],
      [
        "single",
        () =>
          generateAutoMovieSurfacePattern({
            pattern: pattern({ variants: 1 }),
          }).placements.every((one) => one.variant === 0),
      ],
      [
        "noTable",
        () => wall.transforms.every((one) => one.prototype === undefined),
      ],
    ]),
    {
      inRange: true,
      indexed: true,
      varies: true,
      repeatable: true,
      seedMatters: true,
      single: true,
      noTable: true,
    },
  );

  TestValidator.equals(
    "a frame that is not orthonormal and a table that cannot cover a variant are refused",
    namedFacts([
      [
        "thickness",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: WALL,
                thickness: 0,
              }),
            "pattern module thickness must be a finite number > 0",
          ),
      ],
      [
        "nonFiniteU",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: { ...WALL, u: { x: Number.NaN, y: 0, z: 0 } },
                thickness: 0.01,
              }),
            "pattern face frame u must be finite",
          ),
      ],
      [
        "shortU",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: { ...WALL, u: { x: 2, y: 0, z: 0 } },
                thickness: 0.01,
              }),
            "pattern face frame u must be a unit vector",
          ),
      ],
      [
        "shortV",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: { ...WALL, v: { x: 0, y: 0.5, z: 0 } },
                thickness: 0.01,
              }),
            "pattern face frame v must be a unit vector",
          ),
      ],
      [
        "nonFiniteOrigin",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: {
                  ...WALL,
                  origin: { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
                },
                thickness: 0.01,
              }),
            "pattern face frame origin must be finite",
          ),
      ],
      [
        "notPerpendicular",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: {
                  ...WALL,
                  v: { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 },
                },
                thickness: 0.01,
              }),
            "pattern face frame axes must be perpendicular",
          ),
      ],
      [
        "emptyTable",
        () =>
          throwsError(
            () =>
              autoMoviePatternInstanceTransforms({
                result: laid,
                frame: WALL,
                thickness: 0.01,
                prototypes: [],
              }),
            ["which the 0 declared prototypes do not cover"],
          ),
      ],
    ]),
    {
      thickness: true,
      nonFiniteU: true,
      shortU: true,
      shortV: true,
      nonFiniteOrigin: true,
      notPerpendicular: true,
      emptyTable: true,
    },
  );
};
