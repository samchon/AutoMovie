import { IAutoMovieHeightRule } from "@automovie/interface";
import {
  IAutoMovieProductionDesignGraph,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  acceptanceScenarios,
  formationDesign,
  modelRecipe,
  productionDesign,
  shotContract,
  worldDesign,
} from "./productionFixtures";

/** A well-formed two-by-two lattice, as every malformed one is varied from. */
const lattice = (
  overrides: Partial<
    Extract<IAutoMovieHeightRule, { kind: "heightfield" }>
  > = {},
): IAutoMovieHeightRule => ({
  kind: "heightfield",
  originX: -5,
  originZ: -5,
  spacingX: 10,
  spacingZ: 10,
  columns: 2,
  rows: 2,
  samples: [0, 1, 2, 3],
  ...overrides,
});

/**
 * A sampled height rule is validated as strictly as the two that preceded it.
 *
 * A `heightfield` is the one height rule with internal structure: a pitch, a
 * lattice size, and an array that has to be exactly that lattice. Every one of
 * those can be authored wrong by a model emitting structured output, and a
 * wrong one is not loud. A zero pitch divides by nothing; a lattice of a single
 * line has no cell to interpolate across; an array one short reads a row of
 * relief nobody wrote, and an array one long silently drops one that was
 * written. None of those throw, so unless the design gate refuses them the
 * production compiles and the terrain is quietly not the terrain that was
 * authored.
 *
 * The gate reads exactly the record: the sample count is checked against the
 * declared lattice rather than used to infer it, so a design cannot state one
 * shape and carry another.
 *
 * Scenarios:
 *
 * 1. A well-formed field passes, so what follows is the gate refusing malformed
 *    records rather than the gate refusing the rule.
 * 2. A non-finite origin is refused on the axis that carries it, since a lattice
 *    with no place in the world cannot be sampled anywhere.
 * 3. A pitch of zero or below is refused: the lattice coordinate of a point is a
 *    division by it, and a design that reached the engine with one would answer
 *    every query with the same edge sample or with nothing at all.
 * 4. A lattice too small or not whole on either axis is refused, because two lines
 *    per axis is the least that has anything between them to interpolate.
 * 5. A sample array that is not exactly the declared lattice is refused both ways
 *    round, short and long, and the refusal states the count it expected so the
 *    author can correct the record rather than guess at it.
 * 6. A non-finite sample is refused, so relief cannot carry a hole that would
 *    spread `NaN` through every placement standing on it.
 */
export const test_mcp_production_heightfield_validation = (): void => {
  const graph = (
    height: IAutoMovieHeightRule,
  ): IAutoMovieProductionDesignGraph => {
    const world = worldDesign();
    // Only the rule changes: the starter's own footprint, id and walkability
    // stay, so what a refusal below names is the height record and nothing the
    // surface around it was already carrying.
    world.surfaces = [{ ...world.surfaces[0]!, height }];
    return {
      production: productionDesign(),
      models: new Map([["sentinel", modelRecipe()]]),
      world,
      formations: new Map([["line", formationDesign()]]),
      shots: new Map([["opening", shotContract()]]),
      acceptance: new Map(acceptanceScenarios().map((item) => [item.id, item])),
    };
  };
  const refuses = (height: IAutoMovieHeightRule, fragment: string): boolean =>
    validateAutoMovieProductionGraph(graph(height)).some(
      (diagnostic) =>
        diagnostic.code === "design-range-invalid" &&
        diagnostic.message.includes(fragment),
    );

  TestValidator.predicate(
    "a well-formed sampled field passes the design gate",
    validateAutoMovieProductionGraph(graph(lattice())).every(
      (diagnostic) => diagnostic.target !== "world",
    ),
  );

  TestValidator.equals(
    "a lattice with no place, no pitch, or no cell is refused",
    namedFacts([
      [
        "originX",
        () =>
          refuses(
            lattice({ originX: Number.NaN }),
            "surface.height.originX must be finite",
          ),
      ],
      [
        "originZ",
        () =>
          refuses(
            lattice({ originZ: Number.POSITIVE_INFINITY }),
            "surface.height.originZ must be finite",
          ),
      ],
      [
        "spacingX",
        () =>
          refuses(
            lattice({ spacingX: 0 }),
            "surface.height.spacingX must be a finite value above zero",
          ),
      ],
      [
        "spacingZ",
        () =>
          refuses(
            lattice({ spacingZ: -2 }),
            "surface.height.spacingZ must be a finite value above zero",
          ),
      ],
      [
        "oneColumn",
        () =>
          refuses(
            lattice({ columns: 1, samples: [0, 1] }),
            "has 1 columns and 2 rows",
          ),
      ],
      [
        "fractionalRows",
        () => refuses(lattice({ rows: 2.5 }), "has 2 columns and 2.5 rows"),
      ],
    ]),
    {
      originX: true,
      originZ: true,
      spacingX: true,
      spacingZ: true,
      oneColumn: true,
      fractionalRows: true,
    },
  );

  TestValidator.equals(
    "the sample array must be exactly the lattice it declares",
    namedFacts([
      [
        "short",
        () =>
          refuses(
            lattice({ samples: [0, 1, 2] }),
            "carries 3 samples for a 2 by 2 lattice. Store exactly 4",
          ),
      ],
      [
        "long",
        () =>
          refuses(
            lattice({ samples: [0, 1, 2, 3, 4] }),
            "carries 5 samples for a 2 by 2 lattice. Store exactly 4",
          ),
      ],
      [
        "nonFinite",
        () =>
          refuses(
            lattice({ samples: [0, 1, 2, Number.NaN] }),
            "surface.height.samples must be finite",
          ),
      ],
    ]),
    { short: true, long: true, nonFinite: true },
  );
};
