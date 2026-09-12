import {
  instanceSlot,
  materializeCompiledInstanceSet,
} from "@automovie/engine";
import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSetDesign,
} from "@automovie/interface";
import { regenerateInstanceSlot } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

const LANE = {
  id: "lane",
  waypoints: [
    { x: -6, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 8 },
  ],
  allowedFormationWidth: 3,
};

/** The laws every set below shares: a seed and a two-swatch palette. */
const base = (
  props: Pick<IAutoMovieInstanceSetDesign, "id" | "count" | "layout">,
): IAutoMovieInstanceSetDesign => ({
  modelRecipe: "post",
  anchor: { x: 2, y: 0.25, z: -3 },
  facingDeg: 30,
  seed: 4_242,
  variation: {
    scale: { min: 0.75, max: 1.4 },
    palette: ["#224466", "#664422"],
    traits: [{ name: "lean", min: -1, max: 1 }],
  },
  ...props,
});

/** One set per layout, the scattered one declaring every optional law. */
const designs = (): IAutoMovieInstanceSetDesign[] => [
  base({
    id: "fence",
    count: 6,
    layout: { kind: "grid", rows: 2, columns: 3, spacing: { x: 1.2, z: 0.8 } },
  }),
  {
    ...base({ id: "crowd", count: 40, layout: { kind: "scatter", radius: 9 } }),
    prototypes: [
      { id: "tall", modelRecipe: "tall", weight: 2 },
      { id: "short", modelRecipe: "short", weight: 1 },
    ],
    variation: {
      scale: { min: 0.8, max: 1.2 },
      scale3: {
        min: { x: 0.9, y: 0.7, z: 0.9 },
        max: { x: 1.1, y: 1.5, z: 1.1 },
      },
      rotationDeg: {
        x: { min: -3, max: 3 },
        y: { min: 0, max: 360 },
        z: { min: -3, max: 3 },
      },
      visibleProbability: 0.8,
      palette: ["#aa3311", "#11aa33", "#3311aa"],
      traits: [{ name: "lean", min: -1, max: 1 }],
    },
  },
  base({
    id: "shelf",
    count: 12,
    layout: {
      kind: "lattice",
      rows: 2,
      columns: 3,
      layers: 2,
      spacing: { x: 0.5, y: 0.4, z: 0.6 },
    },
  }),
  {
    ...base({
      id: "statues",
      count: 3,
      layout: {
        kind: "explicit",
        transforms: [
          {
            id: "left",
            translation: { x: -2, y: 0, z: 1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 2, z: 1 },
            prototype: "tall",
            palette: "#ffffff",
            traits: { lean: 0.5 },
            visible: false,
          },
          {
            id: "centre",
            translation: { x: 0, y: 0, z: 0 },
            rotation: {
              x: 0,
              y: 0.3826834323650898,
              z: 0,
              w: 0.9238795325112867,
            },
            scale: { x: 1.5, y: 1.5, z: 1.5 },
          },
          {
            id: "right",
            translation: { x: 2, y: 0, z: 1 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
          },
        ],
      },
    }),
    prototypes: [{ id: "tall", modelRecipe: "tall", weight: 1 }],
  },
  base({
    id: "lamps",
    count: 9,
    layout: { kind: "along-route", route: "lane", lateralJitter: 0.6 },
  }),
];

/**
 * The viewer regenerates an instance member with the engine's member law.
 *
 * A compiled instance set stores laws rather than members, and the viewer draws
 * every member it regenerates. The formation determinism contract makes that
 * one-member answer the state the compiled runtime holds, so the viewer's
 * member is pinned, slot for slot, to the engine regenerator the compiled set
 * was measured with. A viewer copy of the law agreed on every valid record but
 * refused less: it drew a set whose route snapshot was renamed or had no
 * length, whose variation derived a non-finite value, or whose palette was
 * empty, all of which the engine refuses.
 *
 * Scenarios:
 *
 * 1. Every member of a grid, a scatter with prototypes, per-axis scale, seeded
 *    rotation, visibility and traits, a lattice, an explicit block with
 *    overrides, and a route set is regenerated exactly as the engine
 *    regenerates it.
 * 2. The comparison discriminates: neighbouring members of every set stand in
 *    different places.
 * 3. A route snapshot renamed away from its layout's route, a route snapshot of
 *    zero length, a scale range that derives a non-finite value, and an empty
 *    palette each refuse with the engine's refusal, while the records they were
 *    edited from regenerate.
 */
export const test_viewer_instance_slot_regeneration = (): void => {
  const world = { routes: [LANE] };
  const sets = designs().map((instanceSet) =>
    materializeCompiledInstanceSet({ instanceSet, world }),
  );
  const [fence, , , , lamps] = sets as [
    IAutoMovieCompiledInstanceSet,
    IAutoMovieCompiledInstanceSet,
    IAutoMovieCompiledInstanceSet,
    IAutoMovieCompiledInstanceSet,
    IAutoMovieCompiledInstanceSet,
  ];

  TestValidator.equals(
    "a viewer member is the engine's member on every slot",
    sets.map((set) =>
      Array.from({ length: set.count }, (_, slot) =>
        regenerateInstanceSlot(set, slot),
      ),
    ),
    sets.map((set) =>
      Array.from({ length: set.count }, (_, slot) => instanceSlot(set, slot)),
    ),
  );

  TestValidator.equals(
    "neighbouring viewer members stand apart",
    sets.map(
      (set) =>
        JSON.stringify(regenerateInstanceSlot(set, 0).position) !==
        JSON.stringify(regenerateInstanceSlot(set, 1).position),
    ),
    sets.map(() => true),
  );

  const nonFinite =
    'Instance set "fence" slot 1 derived non-finite variation or an empty palette.';
  TestValidator.equals(
    "a viewer member refuses the records the engine refuses",
    namedFacts([
      [
        "routeRenamed",
        () =>
          throwsError(
            () =>
              regenerateInstanceSlot(
                { ...lamps, route: { ...lamps.route!, id: "renamed" } },
                1,
              ),
            'Instance set "lamps" references unavailable route "lane".',
          ),
      ],
      [
        "routeWithoutLength",
        () =>
          throwsError(
            () =>
              regenerateInstanceSlot(
                {
                  ...lamps,
                  route: {
                    ...lamps.route!,
                    waypoints: [
                      { x: 1, z: 1 },
                      { x: 1, z: 1 },
                    ],
                  },
                },
                1,
              ),
            'Instance set "lamps" route "lane" must have finite non-zero length.',
          ),
      ],
      [
        "nonFiniteScale",
        () =>
          throwsError(
            () =>
              regenerateInstanceSlot(
                {
                  ...fence,
                  variation: {
                    ...fence.variation,
                    scale: { min: Number.NaN, max: 1 },
                  },
                },
                1,
              ),
            nonFinite,
          ),
      ],
      [
        "emptyPalette",
        () =>
          throwsError(
            () =>
              regenerateInstanceSlot(
                { ...fence, variation: { ...fence.variation, palette: [] } },
                1,
              ),
            nonFinite,
          ),
      ],
      [
        "twinsRegenerate",
        () =>
          regenerateInstanceSlot(lamps, 1).slot === 1 &&
          regenerateInstanceSlot(fence, 1).slot === 1,
      ],
    ]),
    {
      routeRenamed: true,
      routeWithoutLength: true,
      nonFiniteScale: true,
      emptyPalette: true,
      twinsRegenerate: true,
    },
  );
};
