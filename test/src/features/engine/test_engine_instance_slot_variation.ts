import {
  IAutoMovieInstanceSetPlacement,
  instanceSlot,
  materializeCompiledInstanceSet,
} from "@automovie/engine";
import { IAutoMovieInstanceSetDesign } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  qclose,
  throwsError,
} from "../internal/predicates";

const COUNT = 2_000;

/** Two thousand members in a 40 by 50 grid with ranged scale and one trait. */
const crowd = (
  overrides: Partial<IAutoMovieInstanceSetPlacement> = {},
): IAutoMovieInstanceSetPlacement => ({
  id: "crowd",
  count: COUNT,
  modelRecipe: "body",
  layout: { kind: "grid", rows: 50, columns: 40, spacing: { x: 1, z: 1 } },
  route: null,
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 12_345,
  variation: {
    scale: { min: 0.5, max: 1.5 },
    palette: ["#111111", "#222222", "#333333"],
    traits: [{ name: "lean", min: -1, max: 1 }],
  },
  ...overrides,
});

const slots = (placement: IAutoMovieInstanceSetPlacement) =>
  Array.from({ length: placement.count }, (_, slot) =>
    instanceSlot(placement, slot),
  );

/** Share of members that selected each prototype id. */
const shares = (
  members: ReadonlyArray<{ prototype?: string }>,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const member of members) {
    const id = member.prototype ?? "(none)";
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).map(([id, count]) => [id, count / members.length]),
  );
};

const LEGACY_KEYS = [
  "facingDeg",
  "modelRecipe",
  "node",
  "palette",
  "position",
  "scale",
  "slot",
  "traits",
];

const keysOf = (value: object): string[] =>
  Object.keys(value).sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );

/**
 * One instance member's seeded variation obeys its declared law, and the
 * prototype table counts the default exactly once.
 *
 * The expected values are the contract's, not the regenerator's arithmetic: a
 * sampled value stays inside its authored range, a zero-width range yields its
 * one value, a weighted table is chosen in proportion to its weights, and a
 * visibility probability is the share of members shown. Proportions are read
 * over two thousand members, where one percentage point is about two standard
 * deviations of a fair sample, so the tolerances below separate the declared
 * law from the defect they guard without flaking.
 *
 * Scenarios:
 *
 * 1. A set that declares no enhanced feature keeps its original eight fields and
 *    names no prototype; declaring any single one of a prototype table, a
 *    lattice, an explicit block, a per-axis scale, a rotation range or a
 *    visibility probability adds prototype, rotation, per-axis scale and
 *    visibility.
 * 2. Scale, palette choice and trait stay inside their ranges, every palette
 *    entry is used, a zero-width range yields its value, and another seed draws
 *    different values for the same slots.
 * 3. A table of default 1, tall 2 and short 1 selects about 25%, 50% and 25%, and
 *    each member's recipe is its prototype's. A table that counted the default
 *    twice would select about 40%, 40% and 20%, which these bounds refuse.
 * 4. The same table compiled from a design, whose table omits the default,
 *    regenerates from the compiled record in the same proportions: the kernel
 *    prepends the default once and the regenerator does not add another.
 * 5. An explicit member selects the prototype it names, and naming one the table
 *    lacks refuses that member.
 * 6. Visibility: probability zero hides every member, one shows every member,
 *    0.3 shows about 30%, and an absent probability shows all.
 * 7. Rotation: a quarter heading alone turns every member a quarter about +Y,
 *    and a fixed 30 degree X offset composes after that heading.
 * 8. Per-axis scale: each axis stays inside its own range and the axes are drawn
 *    independently, while a set without one repeats the uniform scale on every
 *    axis.
 */
export const test_engine_instance_slot_variation = (): void => {
  // 1. Legacy and enhanced shapes.
  const legacy = instanceSlot(crowd(), 0);
  const enhanced: Array<[string, IAutoMovieInstanceSetPlacement]> = [
    [
      "prototypes",
      crowd({
        prototypes: [{ id: "default", modelRecipe: "body", weight: 1 }],
      }),
    ],
    [
      "lattice",
      crowd({
        count: 8,
        layout: {
          kind: "lattice",
          rows: 2,
          columns: 2,
          layers: 2,
          spacing: { x: 1, y: 1, z: 1 },
        },
      }),
    ],
    [
      "explicit",
      crowd({
        count: 1,
        layout: {
          kind: "explicit",
          transforms: [
            {
              id: "one",
              translation: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0, w: 1 },
              scale: { x: 1, y: 1, z: 1 },
            },
          ],
        },
      }),
    ],
    [
      "scale3",
      crowd({
        variation: {
          ...crowd().variation,
          scale3: { min: { x: 1, y: 1, z: 1 }, max: { x: 2, y: 2, z: 2 } },
        },
      }),
    ],
    [
      "rotationDeg",
      crowd({
        variation: {
          ...crowd().variation,
          rotationDeg: {
            x: { min: 0, max: 0 },
            y: { min: 0, max: 90 },
            z: { min: 0, max: 0 },
          },
        },
      }),
    ],
    [
      "visibleProbability",
      crowd({ variation: { ...crowd().variation, visibleProbability: 0.5 } }),
    ],
  ];
  TestValidator.equals(
    "only a set declaring an enhanced feature carries the enhanced fields",
    namedFacts([
      ["legacyKeys", () => keysOf(legacy).join(",") === LEGACY_KEYS.join(",")],
      ...enhanced.map(
        ([name, placement]) =>
          [
            name,
            () =>
              keysOf(instanceSlot(placement, 0)).join(",") ===
              [...LEGACY_KEYS, "prototype", "rotation", "scale3", "visible"]
                .sort((left, right) =>
                  left < right ? -1 : left > right ? 1 : 0,
                )
                .join(","),
          ] as const,
      ),
    ]),
    {
      legacyKeys: true,
      prototypes: true,
      lattice: true,
      explicit: true,
      scale3: true,
      rotationDeg: true,
      visibleProbability: true,
    },
  );

  // 2. Ranged values.
  const members = slots(crowd());
  const reseeded = slots(crowd({ seed: 54_321 }));
  const fixed = slots(
    crowd({
      count: 64,
      layout: { kind: "grid", rows: 8, columns: 8, spacing: { x: 1, z: 1 } },
      variation: {
        scale: { min: 1.2, max: 1.2 },
        palette: ["#111111"],
        traits: [{ name: "lean", min: 0.25, max: 0.25 }],
      },
    }),
  );
  TestValidator.equals(
    "a seeded value stays inside its authored range and follows its seed",
    namedFacts([
      [
        "scaleRange",
        () =>
          members.every((member) => member.scale >= 0.5 && member.scale <= 1.5),
      ],
      [
        "traitRange",
        () =>
          members.every(
            (member) => member.traits.lean! >= -1 && member.traits.lean! <= 1,
          ),
      ],
      [
        "everyPaletteEntry",
        () => new Set(members.map((member) => member.palette)).size === 3,
      ],
      [
        "zeroWidth",
        () =>
          fixed.every(
            (member) =>
              nclose(member.scale, 1.2, 1e-12) &&
              nclose(member.traits.lean!, 0.25, 1e-12),
          ),
      ],
      [
        "seedMatters",
        () =>
          members.filter(
            (member, slot) => member.scale !== reseeded[slot]!.scale,
          ).length >
          COUNT * 0.9,
      ],
    ]),
    {
      scaleRange: true,
      traitRange: true,
      everyPaletteEntry: true,
      zeroWidth: true,
      seedMatters: true,
    },
  );

  // 3. Weighted table with the default first.
  const table = crowd({
    prototypes: [
      { id: "default", modelRecipe: "body", weight: 1 },
      { id: "tall", modelRecipe: "tall-body", weight: 2 },
      { id: "short", modelRecipe: "short-body", weight: 1 },
    ],
  });
  const chosen = slots(table);
  const tableShares = shares(chosen);
  const recipeOf: Record<string, string> = {
    default: "body",
    tall: "tall-body",
    short: "short-body",
  };
  TestValidator.equals(
    "a weighted table is chosen in proportion to its weights",
    namedFacts([
      ["default", () => Math.abs(tableShares.default! - 0.25) < 0.04],
      ["tall", () => Math.abs(tableShares.tall! - 0.5) < 0.04],
      ["short", () => Math.abs(tableShares.short! - 0.25) < 0.04],
      [
        "recipeFollowsPrototype",
        () =>
          chosen.every(
            (member) => member.modelRecipe === recipeOf[member.prototype!],
          ),
      ],
    ]),
    { default: true, tall: true, short: true, recipeFollowsPrototype: true },
  );

  // 4. The same table from a design compiles the default in once.
  const design: IAutoMovieInstanceSetDesign = {
    id: "crowd",
    modelRecipe: "body",
    prototypes: [
      { id: "tall", modelRecipe: "tall-body", weight: 2 },
      { id: "short", modelRecipe: "short-body", weight: 1 },
    ],
    count: COUNT,
    layout: { kind: "grid", rows: 50, columns: 40, spacing: { x: 1, z: 1 } },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 12_345,
    variation: crowd().variation,
  };
  const compiled = materializeCompiledInstanceSet({
    instanceSet: design,
    world: { routes: [] },
  });
  const compiledShares = shares(slots(compiled));
  TestValidator.equals(
    "a compiled table regenerates with the default counted once",
    namedFacts([
      [
        "table",
        () =>
          compiled.prototypes!.map((prototype) => prototype.id).join(",") ===
          "default,tall,short",
      ],
      ["default", () => Math.abs(compiledShares.default! - 0.25) < 0.04],
      ["tall", () => Math.abs(compiledShares.tall! - 0.5) < 0.04],
      ["short", () => Math.abs(compiledShares.short! - 0.25) < 0.04],
    ]),
    { table: true, default: true, tall: true, short: true },
  );

  // 5. Explicit prototype selection.
  const named = (prototype: string) =>
    crowd({
      count: 1,
      prototypes: table.prototypes,
      layout: {
        kind: "explicit",
        transforms: [
          {
            id: "named",
            translation: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 },
            prototype,
          },
        ],
      },
    });
  TestValidator.equals(
    "an explicit member selects the prototype it names",
    namedFacts([
      [
        "named",
        () => instanceSlot(named("short"), 0).modelRecipe === "short-body",
      ],
      [
        "missing",
        () =>
          throwsError(
            () => instanceSlot(named("ghost"), 0),
            'slot 0 references missing prototype "ghost"',
          ),
      ],
    ]),
    { named: true, missing: true },
  );

  // 6. Visibility.
  const visibleShare = (visibleProbability?: number) => {
    const shown = slots(
      crowd({
        variation: {
          ...crowd().variation,
          ...(visibleProbability === undefined ? {} : { visibleProbability }),
        },
        ...(visibleProbability === undefined
          ? { prototypes: [{ id: "default", modelRecipe: "body", weight: 1 }] }
          : {}),
      }),
    );
    return shown.filter((member) => member.visible === true).length / COUNT;
  };
  TestValidator.equals(
    "a visibility probability is the share of members shown",
    namedFacts([
      ["never", () => visibleShare(0) === 0],
      ["always", () => visibleShare(1) === 1],
      ["some", () => Math.abs(visibleShare(0.3) - 0.3) < 0.04],
      ["absent", () => visibleShare() === 1],
    ]),
    { never: true, always: true, some: true, absent: true },
  );

  // 7. Rotation composes the heading, then the seeded offset.
  const half = Math.SQRT1_2;
  const sin15 = Math.sin(Math.PI / 12);
  const cos15 = Math.cos(Math.PI / 12);
  const quarter = slots(
    crowd({
      count: 16,
      facingDeg: 90,
      prototypes: [{ id: "default", modelRecipe: "body", weight: 1 }],
    }),
  );
  const offset = slots(
    crowd({
      count: 16,
      facingDeg: 90,
      variation: {
        ...crowd().variation,
        rotationDeg: {
          x: { min: 30, max: 30 },
          y: { min: 0, max: 0 },
          z: { min: 0, max: 0 },
        },
      },
    }),
  );
  TestValidator.equals(
    "a member's rotation is the heading followed by its seeded offset",
    namedFacts([
      [
        "heading",
        () =>
          quarter.every((member) =>
            qclose(member.rotation!, { x: 0, y: half, z: 0, w: half }, 1e-12),
          ),
      ],
      [
        "headingThenOffset",
        () =>
          offset.every((member) =>
            qclose(
              member.rotation!,
              {
                x: half * sin15,
                y: half * cos15,
                z: -half * sin15,
                w: half * cos15,
              },
              1e-12,
            ),
          ),
      ],
    ]),
    { heading: true, headingThenOffset: true },
  );

  // 8. Per-axis scale.
  const perAxis = slots(
    crowd({
      variation: {
        ...crowd().variation,
        scale3: { min: { x: 1, y: 2, z: 3 }, max: { x: 1.5, y: 2.5, z: 3.5 } },
      },
    }),
  );
  const uniform = slots(
    crowd({ prototypes: [{ id: "default", modelRecipe: "body", weight: 1 }] }),
  );
  TestValidator.equals(
    "per-axis scale stays in each axis range and is drawn per axis",
    namedFacts([
      [
        "ranges",
        () =>
          perAxis.every(
            (member) =>
              member.scale3!.x >= 1 &&
              member.scale3!.x <= 1.5 &&
              member.scale3!.y >= 2 &&
              member.scale3!.y <= 2.5 &&
              member.scale3!.z >= 3 &&
              member.scale3!.z <= 3.5,
          ),
      ],
      [
        "independentAxes",
        () =>
          perAxis.filter(
            (member) => member.scale3!.x - 1 !== member.scale3!.y - 2,
          ).length >
          COUNT * 0.9,
      ],
      [
        "uniformRepeats",
        () =>
          uniform.every(
            (member) =>
              member.scale3!.x === member.scale &&
              member.scale3!.y === member.scale &&
              member.scale3!.z === member.scale,
          ),
      ],
    ]),
    { ranges: true, independentAxes: true, uniformRepeats: true },
  );
};
