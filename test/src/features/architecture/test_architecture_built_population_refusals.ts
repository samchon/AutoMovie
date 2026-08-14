import {
  builtEnvironmentSpacePopulations,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltPopulation,
  IAutoMovieInstanceSetDesign,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts, throwsError } from "../internal/predicates";

const population = (
  input: Partial<IAutoMovieInstanceSetDesign> = {},
  space = "place",
  prototypeBounds: IAutoMovieBuiltPopulation["prototypeBounds"] = {
    min: { x: -0.5, y: 0, z: -0.5 },
    max: { x: 0.5, y: 1, z: 0.5 },
  },
): IAutoMovieBuiltPopulation => ({
  space,
  prototypeBounds,
  set: {
    id: "casks",
    modelRecipe: "cask",
    count: 4,
    layout: { kind: "grid", rows: 2, columns: 2, spacing: { x: 1, z: 1 } },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 0,
    seed: 3,
    variation: { scale: { min: 1, max: 1 }, palette: ["#808080"], traits: [] },
    ...input,
  },
});

const work = (
  populations: IAutoMovieBuiltPopulation[],
): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "work",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "place" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: null,
      space: "place",
    },
  ],
  populations,
  spaces: [{ id: "place", kind: "building", parent: null, cells: [] }],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

const refuses = (
  populations: IAutoMovieBuiltPopulation[],
  path: string,
  kind: "type" | "range" = "range",
): boolean =>
  hasViolation(
    validateBuiltEnvironment({ environment: work(populations) }),
    kind,
    path,
  );

/**
 * A building refuses a population it could not answer for.
 *
 * A space query that is handed a population has to bound it, and a population it
 * cannot bound would leave that query choosing between a lie and a silence.
 * So the record checks the subset it owns on its own — the space binding, the
 * identity, and the placement law's own arithmetic — while the production
 * compiler keeps validating the whole set again when the lowered population
 * reaches the world. Each refusal below is one such fact, stated at its own
 * input path.
 *
 * Scenarios:
 *
 * 1. A population naming a space the record never declared is refused, because
 *    nothing could ever fold it in.
 * 2. A blank identity and a repeated one are both refused: two populations
 *    answering to one name cannot be told apart by the node listing that names
 *    them.
 * 3. A prototype-local box may collapse onto an axis or a point, but an
 *    inverted or non-finite axis is refused.
 * 4. `along-route` is refused by layout kind. A route is a production-world
 *    fact and this record carries no field that reaches one.
 * 5. The facts every layout needs are checked: a non-integer or non-positive
 *    slot count, a non-finite anchor, a non-finite heading, and a non-positive
 *    scatter radius.
 * 6. Scale and rotation ranges that affect the world box are finite, positive,
 *    and ordered.
 * 7. A grid's own lattice is checked: non-positive rows and columns, non-finite
 *    or non-positive spacing on either axis, and a lattice too small to seat the
 *    slots it claims. A malformed column count leaves the capacity itself
 *    unusable, and that is reported as the malformed column rather than as a
 *    second confusing complaint about capacity.
 * 8. A lattice's extra axis is checked the same way, layers and rise together.
 * 9. An explicit block must state one transform per slot, and each translation,
 *    rotation, and scale must be usable by the local-to-world bounds fold.
 * 10. A well-formed population, including a point-like prototype, validates, so none of the above passes by
 *    refusing everything.
 * 11. `builtEnvironmentSpacePopulations` refuses an undeclared space id by name,
 *    exactly as every other space query in the file does.
 */
export const test_architecture_built_population_refusals = (): void => {
  TestValidator.equals(
    "a population must name a space the record declares, once",
    namedFacts([
      [
        "unresolvedSpace",
        () =>
          refuses([population({}, "cellar")], "populations[0].space", "type"),
      ],
      [
        "blankId",
        () =>
          refuses([population({ id: "  " })], "populations[0].set.id", "type"),
      ],
      [
        "duplicateId",
        () =>
          refuses(
            [population(), population()],
            "populations[1].set.id",
            "type",
          ),
      ],
    ]),
    { unresolvedSpace: true, blankId: true, duplicateId: true },
  );

  TestValidator.equals(
    "a building population may not follow a production-world route",
    refuses(
      [
        population({
          layout: {
            kind: "along-route",
            route: "market-lane",
            lateralJitter: 0.5,
          },
        }),
      ],
      "populations[0].set.layout.kind",
      "type",
    ),
    true,
  );

  TestValidator.equals(
    "prototype bounds may degenerate but may not invert or become non-finite",
    namedFacts([
      [
        "pointAccepted",
        () =>
          validateBuiltEnvironment({
            environment: work([
              population({}, "place", {
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 0, z: 0 },
              }),
            ]),
          }).success === true,
      ],
      [
        "inverted",
        () =>
          hasViolation(
            validateBuiltEnvironment({
              environment: work([
                population({}, "place", {
                  min: { x: 2, y: 0, z: 0 },
                  max: { x: 1, y: 0, z: 0 },
                }),
              ]),
            }),
            "range",
            "populations[0].prototypeBounds.x",
          ),
      ],
      [
        "nonFinite",
        () =>
          hasViolation(
            validateBuiltEnvironment({
              environment: work([
                population({}, "place", {
                  min: { x: 0, y: Number.NaN, z: 0 },
                  max: { x: 0, y: 0, z: 0 },
                }),
              ]),
            }),
            "range",
            "populations[0].prototypeBounds.min.y",
          ),
      ],
    ]),
    { pointAccepted: true, inverted: true, nonFinite: true },
  );

  TestValidator.equals(
    "the facts every layout needs are checked",
    namedFacts([
      [
        "fractionalCount",
        () => refuses([population({ count: 2.5 })], "populations[0].set.count"),
      ],
      [
        "emptyCount",
        () => refuses([population({ count: 0 })], "populations[0].set.count"),
      ],
      [
        "nonFiniteAnchor",
        () =>
          refuses(
            [population({ anchor: { x: 0, y: Number.NaN, z: 0 } })],
            "populations[0].set.anchor.y",
          ),
      ],
      [
        "nonFiniteHeading",
        () =>
          refuses(
            [population({ facingDeg: Number.POSITIVE_INFINITY })],
            "populations[0].set.facingDeg",
          ),
      ],
    ]),
    {
      fractionalCount: true,
      emptyCount: true,
      nonFiniteAnchor: true,
      nonFiniteHeading: true,
    },
  );

  TestValidator.equals(
    "a scatter needs a positive finite radius",
    refuses(
      [
        population({
          layout: { kind: "scatter", radius: 0 },
        }),
      ],
      "populations[0].set.layout.radius",
    ),
    true,
  );

  TestValidator.equals(
    "scale and rotation ranges used by bounds are positive, finite, and ordered",
    namedFacts([
      [
        "uniformMinimum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 0, max: 1 },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale.min",
          ),
      ],
      [
        "uniformMaximum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: Number.NaN },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale.max",
          ),
      ],
      [
        "uniformOrder",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 2, max: 1 },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale",
          ),
      ],
      [
        "axisMinimum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  scale3: {
                    min: { x: 0, y: 1, z: 1 },
                    max: { x: 1, y: 1, z: 1 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale3.min.x",
          ),
      ],
      [
        "axisMaximum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  scale3: {
                    min: { x: 1, y: 1, z: 1 },
                    max: { x: 1, y: Number.POSITIVE_INFINITY, z: 1 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale3.max.y",
          ),
      ],
      [
        "axisOrder",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  scale3: {
                    min: { x: 1, y: 1, z: 3 },
                    max: { x: 1, y: 1, z: 2 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.scale3.z",
          ),
      ],
      [
        "rotationMinimum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  rotationDeg: {
                    x: { min: Number.NaN, max: 0 },
                    y: { min: 0, max: 0 },
                    z: { min: 0, max: 0 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.rotationDeg.x.min",
          ),
      ],
      [
        "rotationMaximum",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  rotationDeg: {
                    x: { min: 0, max: 0 },
                    y: { min: 0, max: Number.NEGATIVE_INFINITY },
                    z: { min: 0, max: 0 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.rotationDeg.y.max",
          ),
      ],
      [
        "rotationOrder",
        () =>
          refuses(
            [
              population({
                variation: {
                  scale: { min: 1, max: 1 },
                  rotationDeg: {
                    x: { min: 0, max: 0 },
                    y: { min: 0, max: 0 },
                    z: { min: 20, max: 10 },
                  },
                  palette: ["#808080"],
                  traits: [],
                },
              }),
            ],
            "populations[0].set.variation.rotationDeg.z",
          ),
      ],
    ]),
    {
      uniformMinimum: true,
      uniformMaximum: true,
      uniformOrder: true,
      axisMinimum: true,
      axisMaximum: true,
      axisOrder: true,
      rotationMinimum: true,
      rotationMaximum: true,
      rotationOrder: true,
    },
  );

  TestValidator.equals(
    "a grid's own lattice is checked, capacity included",
    namedFacts([
      [
        "rows",
        () =>
          refuses(
            [
              population({
                layout: {
                  kind: "grid",
                  rows: 0,
                  columns: 2,
                  spacing: { x: 1, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout.rows",
          ),
      ],
      [
        "spacingX",
        () =>
          refuses(
            [
              population({
                layout: {
                  kind: "grid",
                  rows: 2,
                  columns: 2,
                  spacing: { x: 0, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout.spacing.x",
          ),
      ],
      [
        "spacingZ",
        () =>
          refuses(
            [
              population({
                layout: {
                  kind: "grid",
                  rows: 2,
                  columns: 2,
                  spacing: { x: 1, z: Number.NaN },
                },
              }),
            ],
            "populations[0].set.layout.spacing.z",
          ),
      ],
      [
        "capacityTooSmall",
        () =>
          refuses(
            [
              population({
                count: 5,
                layout: {
                  kind: "grid",
                  rows: 1,
                  columns: 1,
                  spacing: { x: 1, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout",
          ),
      ],
      [
        "malformedColumnsReportOnlyTheColumn",
        () => {
          const validation = validateBuiltEnvironment({
            environment: work([
              population({
                layout: {
                  kind: "grid",
                  rows: 2,
                  columns: Number.NaN,
                  spacing: { x: 1, z: 1 },
                },
              }),
            ]),
          });
          return (
            hasViolation(
              validation,
              "range",
              "populations[0].set.layout.columns",
            ) &&
            validation.success === false &&
            validation.violations.every(
              (violation) =>
                violation.path !== "$input.populations[0].set.layout",
            )
          );
        },
      ],
    ]),
    {
      rows: true,
      spacingX: true,
      spacingZ: true,
      capacityTooSmall: true,
      malformedColumnsReportOnlyTheColumn: true,
    },
  );

  TestValidator.equals(
    "a lattice's extra axis is checked with the rest",
    namedFacts([
      [
        "layers",
        () =>
          refuses(
            [
              population({
                layout: {
                  kind: "lattice",
                  rows: 2,
                  columns: 2,
                  layers: -1,
                  spacing: { x: 1, y: 1, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout.layers",
          ),
      ],
      [
        "rise",
        () =>
          refuses(
            [
              population({
                layout: {
                  kind: "lattice",
                  rows: 2,
                  columns: 2,
                  layers: 2,
                  spacing: { x: 1, y: 0, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout.spacing.y",
          ),
      ],
      [
        "capacityTooSmall",
        () =>
          refuses(
            [
              population({
                count: 9,
                layout: {
                  kind: "lattice",
                  rows: 2,
                  columns: 2,
                  layers: 2,
                  spacing: { x: 1, y: 1, z: 1 },
                },
              }),
            ],
            "populations[0].set.layout",
          ),
      ],
    ]),
    { layers: true, rise: true, capacityTooSmall: true },
  );

  TestValidator.equals(
    "an explicit block states one finite transform per slot",
    namedFacts([
      [
        "tooFewTransforms",
        () =>
          refuses(
            [
              population({
                count: 3,
                layout: {
                  kind: "explicit",
                  transforms: [
                    {
                      id: "slot-0",
                      translation: { x: 0, y: 0, z: 0 },
                      rotation: { x: 0, y: 0, z: 0, w: 1 },
                      scale: { x: 1, y: 1, z: 1 },
                    },
                  ],
                },
              }),
            ],
            "populations[0].set.layout.transforms",
          ),
      ],
      [
        "nonFiniteTranslation",
        () =>
          refuses(
            [
              population({
                count: 1,
                layout: {
                  kind: "explicit",
                  transforms: [
                    {
                      id: "slot-0",
                      translation: {
                        x: 0,
                        y: 0,
                        z: Number.NEGATIVE_INFINITY,
                      },
                      rotation: { x: 0, y: 0, z: 0, w: 1 },
                      scale: { x: 1, y: 1, z: 1 },
                    },
                  ],
                },
              }),
            ],
            "populations[0].set.layout.transforms[0].translation.z",
          ),
      ],
      [
        "nonUnitRotation",
        () =>
          refuses(
            [
              population({
                count: 1,
                layout: {
                  kind: "explicit",
                  transforms: [
                    {
                      id: "slot-0",
                      translation: { x: 0, y: 0, z: 0 },
                      rotation: { x: 0, y: 0, z: 0, w: 2 },
                      scale: { x: 1, y: 1, z: 1 },
                    },
                  ],
                },
              }),
            ],
            "populations[0].set.layout.transforms[0].rotation",
          ),
      ],
      [
        "nonPositiveScale",
        () =>
          refuses(
            [
              population({
                count: 1,
                layout: {
                  kind: "explicit",
                  transforms: [
                    {
                      id: "slot-0",
                      translation: { x: 0, y: 0, z: 0 },
                      rotation: { x: 0, y: 0, z: 0, w: 1 },
                      scale: { x: 1, y: 0, z: 1 },
                    },
                  ],
                },
              }),
            ],
            "populations[0].set.layout.transforms[0].scale.y",
          ),
      ],
    ]),
    {
      tooFewTransforms: true,
      nonFiniteTranslation: true,
      nonUnitRotation: true,
      nonPositiveScale: true,
    },
  );

  TestValidator.equals(
    "a well-formed population validates and answers for its own space",
    namedFacts([
      [
        "validates",
        () =>
          validateBuiltEnvironment({ environment: work([population()]) })
            .success === true,
      ],
      [
        "owned",
        () =>
          builtEnvironmentSpacePopulations(work([population()]), "place")
            .length === 1,
      ],
      [
        "undeclaredSpaceRefused",
        () =>
          throwsError(
            () =>
              builtEnvironmentSpacePopulations(work([population()]), "cellar"),
            ['has no logical space "cellar"'],
          ),
      ],
    ]),
    { validates: true, owned: true, undeclaredSpaceRefused: true },
  );
};
