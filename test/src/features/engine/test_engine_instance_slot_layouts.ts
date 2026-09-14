import {
  IAutoMovieInstanceSetPlacement,
  instanceSlot,
} from "@automovie/engine";
import { IAutoMovieWorldRoute } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  qclose,
  throwsError,
  vclose,
} from "../internal/predicates";

/** Six members, two rows of three, turned a quarter to the left. */
const placement = (
  overrides: Partial<IAutoMovieInstanceSetPlacement> = {},
): IAutoMovieInstanceSetPlacement => ({
  id: "trees",
  count: 6,
  modelRecipe: "tree",
  layout: { kind: "grid", rows: 2, columns: 3, spacing: { x: 2, z: 3 } },
  route: null,
  anchor: { x: 10, y: 1, z: -5 },
  facingDeg: 90,
  seed: 7,
  variation: { scale: { min: 1, max: 1 }, palette: ["#336633"], traits: [] },
  ...overrides,
});

/** Three ten-metre legs: east, north, then back west; thirty metres long. */
const road: IAutoMovieWorldRoute = {
  id: "road",
  waypoints: [
    { x: 0, z: 0 },
    { x: 10, z: 0 },
    { x: 10, z: 10 },
    { x: 0, z: 10 },
  ],
  allowedFormationWidth: 4,
};

const onRoad = (
  overrides: Partial<IAutoMovieInstanceSetPlacement> = {},
): IAutoMovieInstanceSetPlacement =>
  placement({
    count: 4,
    layout: { kind: "along-route", route: "road", lateralJitter: 0 },
    route: road,
    anchor: { x: 0, y: 2, z: 0 },
    ...overrides,
  });

/**
 * One instance member stands where its layout law puts it, from the compiled
 * shape alone.
 *
 * The member regenerator is the one law the compiled instance-set kernel and
 * the shot-source oracle share, so every placement below is read against hand
 * geometry rather than against another implementation. A local layout is laid
 * out in the set frame, turned by the heading about the anchor, and raised by
 * the anchor's height; a route member walks the route snapshot by arc length,
 * ignores the heading, and stands at the anchor's height.
 *
 * Scenarios:
 *
 * 1. A grid member at a quarter turn: column -1 of row 0 lands two metres toward
 *    +z of the anchor, and the middle column of row 1 lands three metres toward
 *    +x, which pins the rotation sense of the heading.
 * 2. A lattice member takes its layer, row and column from the slot index, with
 *    the layer rising along local Y.
 * 3. A scatter member stays inside its radius, and turning the heading rotates
 *    it about the anchor without changing its distance.
 * 4. An explicit member takes its authored translation, rotation, scale,
 *    palette, trait value and visibility, while a sibling that states none keeps
 *    the set's own values; a block missing a declared slot refuses that slot and
 *    only that slot.
 * 5. A route member is spaced by arc length on the leg that contains it: the
 *    first leg, the second leg reached after skipping the first, and the final
 *    leg reached after skipping both. The heading changes none of them, and a
 *    lateral jitter pushes a member only across its own leg, never along it.
 * 6. Refusals, each against a twin that is accepted: a slot outside the set, a
 *    missing, renamed or one-point route, a route without finite positive
 *    length, a non-finite scale, trait or anchor, and an empty palette that an
 *    explicit colour then satisfies.
 */
export const test_engine_instance_slot_layouts = (): void => {
  // 1. Grid at a quarter turn.
  const grid = placement();
  TestValidator.equals(
    "a grid member is laid out in the set frame and turned about the anchor",
    namedFacts([
      [
        "firstColumn",
        () =>
          vclose(instanceSlot(grid, 0).position, { x: 10, y: 1, z: -3 }, 1e-12),
      ],
      [
        "secondRowMiddle",
        () =>
          vclose(instanceSlot(grid, 4).position, { x: 13, y: 1, z: -5 }, 1e-12),
      ],
      [
        "node",
        () => instanceSlot(grid, 4).node === "instance:trees:slot:000004",
      ],
    ]),
    { firstColumn: true, secondRowMiddle: true, node: true },
  );

  // 2. Lattice layers rise along local Y.
  const lattice = placement({
    count: 8,
    facingDeg: 0,
    anchor: { x: 0, y: 0, z: 0 },
    layout: {
      kind: "lattice",
      rows: 2,
      columns: 2,
      layers: 2,
      spacing: { x: 1, y: 2, z: 3 },
    },
  });
  TestValidator.equals(
    "a lattice member takes its layer, row and column from the slot",
    namedFacts([
      [
        "first",
        () =>
          vclose(
            instanceSlot(lattice, 0).position,
            { x: -0.5, y: 0, z: 0 },
            1e-12,
          ),
      ],
      [
        "last",
        () =>
          vclose(
            instanceSlot(lattice, 7).position,
            { x: 0.5, y: 2, z: 3 },
            1e-12,
          ),
      ],
    ]),
    { first: true, last: true },
  );

  // 3. Scatter stays in its disk; the heading only rotates it.
  const scatter = (facingDeg: number) =>
    placement({
      count: 64,
      facingDeg,
      anchor: { x: 3, y: 0, z: 4 },
      layout: { kind: "scatter", radius: 5 },
    });
  const level = Array.from(
    { length: 64 },
    (_, slot) => instanceSlot(scatter(0), slot).position,
  );
  const turned = Array.from(
    { length: 64 },
    (_, slot) => instanceSlot(scatter(90), slot).position,
  );
  TestValidator.equals(
    "a scatter member stays inside its radius and turns about the anchor",
    namedFacts([
      [
        "insideRadius",
        () =>
          level.every(
            (point) => Math.hypot(point.x - 3, point.z - 4) <= 5 + 1e-12,
          ),
      ],
      [
        "quarterTurn",
        () =>
          level.every((point, slot) =>
            vclose(
              turned[slot]!,
              { x: 3 + (point.z - 4), y: 0, z: 4 - (point.x - 3) },
              1e-9,
            ),
          ),
      ],
    ]),
    { insideRadius: true, quarterTurn: true },
  );

  // 4. Explicit members.
  const quarterAboutX = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
  const explicit = placement({
    count: 3,
    facingDeg: 0,
    anchor: { x: 10, y: 0, z: 0 },
    variation: {
      scale: { min: 1, max: 1 },
      palette: ["#336633"],
      traits: [{ name: "height", min: 1, max: 2 }],
    },
    layout: {
      kind: "explicit",
      transforms: [
        {
          id: "oak",
          translation: { x: 1, y: 2, z: 3 },
          rotation: quarterAboutX,
          scale: { x: 2, y: 3, z: 4 },
          palette: "#aa0000",
          traits: { height: 9 },
          visible: false,
        },
        {
          id: "elm",
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
      ],
    },
  });
  const oak = instanceSlot(explicit, 0);
  const elm = instanceSlot(explicit, 1);
  TestValidator.equals(
    "an explicit member keeps what it states and a sibling keeps the set's values",
    namedFacts([
      ["node", () => oak.node === "instance:trees:oak"],
      ["position", () => vclose(oak.position, { x: 11, y: 2, z: 3 }, 1e-12)],
      ["rotation", () => qclose(oak.rotation!, quarterAboutX, 1e-12)],
      ["scale", () => vclose(oak.scale3!, { x: 2, y: 3, z: 4 }, 0)],
      ["palette", () => oak.palette === "#aa0000"],
      ["trait", () => oak.traits.height === 9],
      ["hidden", () => oak.visible === false],
      ["defaultPrototype", () => oak.prototype === "default"],
      ["siblingPalette", () => elm.palette === "#336633"],
      [
        "siblingTrait",
        () => elm.traits.height! >= 1 && elm.traits.height! <= 2,
      ],
      ["siblingVisible", () => elm.visible === true],
      [
        "siblingIdentity",
        () => qclose(elm.rotation!, { x: 0, y: 0, z: 0, w: 1 }, 1e-12),
      ],
      [
        "missingSlot",
        () =>
          throwsError(
            () => instanceSlot(explicit, 2),
            "slot 2 has no explicit transform",
          ),
      ],
    ]),
    {
      node: true,
      position: true,
      rotation: true,
      scale: true,
      palette: true,
      trait: true,
      hidden: true,
      defaultPrototype: true,
      siblingPalette: true,
      siblingTrait: true,
      siblingVisible: true,
      siblingIdentity: true,
      missingSlot: true,
    },
  );

  // 5. Route members by arc length. Total 30 m, four members at 3.75 m, 11.25
  // m, 18.75 m and 26.25 m along it.
  const route = onRoad();
  const turnedRoute = onRoad({ facingDeg: 45 });
  const jittered = onRoad({
    layout: { kind: "along-route", route: "road", lateralJitter: 1 },
  });
  TestValidator.equals(
    "a route member is spaced by arc length on the leg that contains it",
    namedFacts([
      [
        "firstLeg",
        () =>
          vclose(
            instanceSlot(route, 0).position,
            { x: 3.75, y: 2, z: 0 },
            1e-12,
          ),
      ],
      [
        "secondLeg",
        () =>
          vclose(
            instanceSlot(route, 1).position,
            { x: 10, y: 2, z: 1.25 },
            1e-12,
          ),
      ],
      [
        "secondLegLater",
        () =>
          vclose(
            instanceSlot(route, 2).position,
            { x: 10, y: 2, z: 8.75 },
            1e-12,
          ),
      ],
      [
        "finalLeg",
        () =>
          vclose(
            instanceSlot(route, 3).position,
            { x: 3.75, y: 2, z: 10 },
            1e-12,
          ),
      ],
      [
        "headingIgnored",
        () =>
          [0, 1, 2, 3].every((slot) =>
            vclose(
              instanceSlot(turnedRoute, slot).position,
              instanceSlot(route, slot).position,
              0,
            ),
          ),
      ],
      [
        "jitterAcrossFirstLeg",
        () => {
          const point = instanceSlot(jittered, 0).position;
          return nclose(point.x, 3.75, 1e-12) && Math.abs(point.z) <= 1;
        },
      ],
      [
        "jitterAcrossSecondLeg",
        () => {
          const point = instanceSlot(jittered, 1).position;
          return nclose(point.z, 1.25, 1e-12) && Math.abs(point.x - 10) <= 1;
        },
      ],
    ]),
    {
      firstLeg: true,
      secondLeg: true,
      secondLegLater: true,
      finalLeg: true,
      headingIgnored: true,
      jitterAcrossFirstLeg: true,
      jitterAcrossSecondLeg: true,
    },
  );

  // 6. Refusals against accepted twins.
  const unavailable = 'references unavailable route "road"';
  const noLength = 'route "road" must have finite non-zero length';
  const nonFinite = "derived non-finite variation or an empty palette";
  TestValidator.equals(
    "an instance member refuses what it cannot place and accepts its twin",
    namedFacts([
      ["lastSlotAccepted", () => instanceSlot(grid, 5).slot === 5],
      [
        "pastCount",
        () =>
          throwsError(() => instanceSlot(grid, 6), "slot 6 is outside 0..5"),
      ],
      [
        "negative",
        () =>
          throwsError(() => instanceSlot(grid, -1), "slot -1 is outside 0..5"),
      ],
      [
        "fractional",
        () =>
          throwsError(
            () => instanceSlot(grid, 1.5),
            "slot 1.5 is outside 0..5",
          ),
      ],
      ["routeAccepted", () => instanceSlot(route, 0).slot === 0],
      [
        "routeMissing",
        () =>
          throwsError(
            () => instanceSlot(onRoad({ route: null }), 0),
            unavailable,
          ),
      ],
      [
        "routeRenamed",
        () =>
          throwsError(
            () => instanceSlot(onRoad({ route: { ...road, id: "lane" } }), 0),
            unavailable,
          ),
      ],
      [
        "routeOnePoint",
        () =>
          throwsError(
            () =>
              instanceSlot(
                onRoad({ route: { ...road, waypoints: [{ x: 0, z: 0 }] } }),
                0,
              ),
            unavailable,
          ),
      ],
      [
        "routeZeroLength",
        () =>
          throwsError(
            () =>
              instanceSlot(
                onRoad({
                  route: {
                    ...road,
                    waypoints: [
                      { x: 1, z: 1 },
                      { x: 1, z: 1 },
                    ],
                  },
                }),
                0,
              ),
            noLength,
          ),
      ],
      [
        "routeInfinite",
        () =>
          throwsError(
            () =>
              instanceSlot(
                onRoad({
                  route: {
                    ...road,
                    waypoints: [
                      { x: 0, z: 0 },
                      { x: Number.POSITIVE_INFINITY, z: 0 },
                    ],
                  },
                }),
                0,
              ),
            noLength,
          ),
      ],
      [
        "infiniteScale",
        () =>
          throwsError(
            () =>
              instanceSlot(
                placement({
                  variation: {
                    scale: { min: 1, max: Number.POSITIVE_INFINITY },
                    palette: ["#336633"],
                    traits: [],
                  },
                }),
                0,
              ),
            nonFinite,
          ),
      ],
      [
        "infiniteTrait",
        () =>
          throwsError(
            () =>
              instanceSlot(
                placement({
                  variation: {
                    scale: { min: 1, max: 1 },
                    palette: ["#336633"],
                    traits: [
                      { name: "height", min: 0, max: Number.POSITIVE_INFINITY },
                    ],
                  },
                }),
                0,
              ),
            nonFinite,
          ),
      ],
      [
        "infiniteAnchor",
        () =>
          throwsError(
            () =>
              instanceSlot(
                placement({
                  anchor: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
                }),
                0,
              ),
            nonFinite,
          ),
      ],
      [
        "emptyPalette",
        () =>
          throwsError(
            () =>
              instanceSlot(
                placement({
                  variation: {
                    scale: { min: 1, max: 1 },
                    palette: [],
                    traits: [],
                  },
                }),
                0,
              ),
            nonFinite,
          ),
      ],
      [
        "explicitColourSatisfiesEmptyPalette",
        () =>
          instanceSlot(
            placement({
              count: 1,
              variation: { scale: { min: 1, max: 1 }, palette: [], traits: [] },
              layout: {
                kind: "explicit",
                transforms: [
                  {
                    id: "only",
                    translation: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0, w: 1 },
                    scale: { x: 1, y: 1, z: 1 },
                    palette: "#123456",
                  },
                ],
              },
            }),
            0,
          ).palette === "#123456",
      ],
    ]),
    {
      lastSlotAccepted: true,
      pastCount: true,
      negative: true,
      fractional: true,
      routeAccepted: true,
      routeMissing: true,
      routeRenamed: true,
      routeOnePoint: true,
      routeZeroLength: true,
      routeInfinite: true,
      infiniteScale: true,
      infiniteTrait: true,
      infiniteAnchor: true,
      emptyPalette: true,
      explicitColourSatisfiesEmptyPalette: true,
    },
  );
};
