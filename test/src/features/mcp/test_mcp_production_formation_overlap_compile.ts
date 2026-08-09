import type {
  IAutoMovieDiagnostic,
  IAutoMovieFormationDesign,
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  fixtureWorldDesign,
  formationDesign,
  modelRecipe,
  productionCompileSucceeded,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
} from "./productionFixtures";

/**
 * The two runtimes a member of this unit may be drawn as.
 *
 * Two tiers rather than one, because which tier a member is drawn at is the
 * camera's decision: the widest pair fills half a metre between two axes and
 * the narrowest fills four tenths, and a refusal has to hold whichever the
 * camera picks. Four tenths is therefore the number every refusal below is
 * measured against, and reading the widest instead would refuse an arrangement
 * that is correct at the far tier.
 */
const NEAR_RADIUS = 0.25;
const FAR_RADIUS = 0.2;
const LEAST_CLEARANCE = 2 * FAR_RADIUS;
const WIDEST_CLEARANCE = 2 * NEAR_RADIUS;

/** Intervals the unit is laid out at, on either side of that number. */
const TIGHT = 0.3;
const OPEN = 0.8;

/**
 * How steeply the world's own terrain climbs along `z`.
 *
 * Steep enough that one rank's depth carries the rank behind it clear above the
 * rank in front: `0.3 * 2 = 0.6` m, past the half metre two of the widest
 * members fill in height. That is what makes the ranks below an arrangement the
 * relief decides rather than the intervals.
 */
const SLOPE = 2;

/** One sphere-shaped runtime a member may be drawn as. */
const sphere = (id: string, radius: number): IAutoMovieModelRecipe => ({
  ...modelRecipe(),
  id,
  role: "prop",
  archetype: "primitive-prop",
  parameters: { shape: "sphere", radius },
  capabilities: [],
  attachments: [],
  lod: [{ tier: "hero", maxDistance: null, recipe: id }],
});

/** The world, with its one surface climbing along `z` or level as stated. */
const world = (slope: number): IAutoMovieWorldDesign => {
  const design = fixtureWorldDesign();
  return {
    ...design,
    surfaces: design.surfaces.map((surface) => ({
      ...surface,
      height: { kind: "plane", originHeight: 0, slopeX: 0, slopeZ: slope },
    })),
  };
};

/** The unit, laid out at stated intervals in each of its two axes. */
const unit = (props: {
  lateral: number;
  depth: number;
}): IAutoMovieFormationDesign => ({
  ...formationDesign({
    kind: "line",
    ranks: 2,
    files: 3,
    spacing: { lateral: props.lateral, depth: props.depth },
  }),
  modelRecipe: "unit",
});

/** Refusals naming a member standing where another body already is. */
const overlaps = (diagnostics: readonly IAutoMovieDiagnostic[]): string[] =>
  diagnostics
    .map((diagnostic) => diagnostic.message)
    .filter((message) =>
      message.includes("must not stand a member where another body already is"),
    );

class ProductionOverlapCompileCleanupError extends AggregateError {}

/** Remove the compile fixture without replacing its primary failure. */
const preserveProductionOverlapCompileCleanup = (
  failure: { error: unknown } | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionOverlapCompileCleanupError(
      [failure.error, cleanupFailure],
      "Formation-overlap compile fixture teardown failed after the test failed.",
    );
  }
};

/**
 * A production may not compile a shot that stands one member inside another.
 *
 * The gate itself is measured directly elsewhere; what this pins is that a
 * compile runs it at all. A refusal reachable only by calling the validator by
 * hand refuses nothing: the pipeline would go on emitting a shot whose crowd
 * stands through itself, and the one caller that could have stopped it is the
 * one nothing proved calls it.
 *
 * The unit here is one a camera may draw at two tiers, standing on terrain that
 * climbs, which is what makes the arithmetic a production's own rather than a
 * fixture's: the clearance is the least of the tiers and the height between two
 * ranks is the terrain's, and both reach the gate through the compiler that
 * built them.
 *
 * Scenarios:
 *
 * 1. Intervals open in width and ranks the terrain lifts clear of one another
 *    compile: the gate leaves alone the arrangement it exists beside, and the
 *    accepted baseline is what makes the two refusals below readings of the
 *    gate rather than of a broken fixture.
 * 2. Intervals inside the members' own width are refused by the compile, naming
 *    the shot, the unit, which two members, how far apart they stand and the
 *    width they were measured against. That width is the LEAST of the two
 *    tiers, so the refusal is one the camera cannot escape by drawing the far
 *    one.
 * 3. The same unit on level ground is refused for its ranks, which the climbing
 *    terrain accepted: the height between two members is the terrain's own, and
 *    it reaches the gate because the compiler placed the unit on it.
 */
export const test_mcp_production_formation_overlap_compile = (): void => {
  const fixture = productionFixture();
  let failure: { error: unknown } | undefined;
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    TestValidator.equals(
      "the two-tier unit and its shot are registered",
      namedFacts([
        [
          "near",
          () =>
            project.setModelRecipe(sphere("unit-near", NEAR_RADIUS)).accepted,
        ],
        [
          "far",
          () => project.setModelRecipe(sphere("unit-far", FAR_RADIUS)).accepted,
        ],
        [
          "tiers",
          () =>
            project.setModelRecipe({
              ...sphere("unit", NEAR_RADIUS),
              lod: [
                { tier: "hero", maxDistance: 5, recipe: "unit" },
                { tier: "near", maxDistance: 12, recipe: "unit-near" },
                { tier: "far", maxDistance: null, recipe: "unit-far" },
              ],
            }).accepted,
        ],
        [
          "participant",
          () =>
            setProductionFixtureShotContract(project, {
              ...shotContract(),
              participants: [
                ...shotContract().participants,
                { kind: "formation", id: formationDesign().id },
              ],
            }).accepted,
        ],
      ]),
      { near: true, far: true, tiers: true, participant: true },
    );

    // 1. the accepted baseline: open in width, and lifted apart in depth.
    TestValidator.equals(
      "a unit whose terrain lifts its ranks clear compiles",
      namedFacts([
        ["world", () => project.setWorldDesign(world(SLOPE)).accepted],
        [
          "unit",
          () =>
            project.setFormationDesign(unit({ lateral: OPEN, depth: TIGHT }))
              .accepted,
        ],
        // The depth interval alone is inside the members' own width, so what
        // accepts this arrangement is the height the terrain puts between the
        // ranks and nothing else.
        ["tightInDepth", () => TIGHT < LEAST_CLEARANCE],
        ["liftedClear", () => TIGHT * SLOPE >= WIDEST_CLEARANCE],
        [
          "compiles",
          () =>
            productionCompileSucceeded(
              "lifted-rank formation fixture",
              compiler.compile({ scope: "source" }),
            ),
        ],
      ]),
      {
        world: true,
        unit: true,
        tightInDepth: true,
        liftedClear: true,
        compiles: true,
      },
    );

    // 2. intervals inside the least of the two tiers are refused by the compile.
    project.setFormationDesign(unit({ lateral: TIGHT, depth: 0.9 }));
    const packed = compiler.compile({ scope: "source" });
    const packedMessages = overlaps(
      packed.success === true ? [] : packed.diagnostics,
    );
    TestValidator.equals(
      "a compile refuses a unit laid out inside its own members",
      namedFacts([
        ["refused", () => packed.success === false],
        ["one", () => packedMessages.length === 1],
        [
          "code",
          () =>
            packed.success === false &&
            packed.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "engine-validation-failed" &&
                diagnostic.target === "shot:opening" &&
                diagnostic.category === "error",
            ),
        ],
        [
          "unit",
          () =>
            packedMessages[0]!.startsWith(`formation:${formationDesign().id} `),
        ],
        ["members", () => packedMessages[0]!.includes("its slots 0 and 1")],
        ["apart", () => packedMessages[0]!.includes(`${TIGHT}m apart`)],
        // The LEAST of the two tiers, not the widest: a camera drawing the far
        // tier is still drawing two bodies in one place.
        [
          "least",
          () =>
            packedMessages[0]!.includes(
              `${LEAST_CLEARANCE}m their bodies fill`,
            ),
        ],
        [
          "notTheWidest",
          () =>
            packedMessages[0]!.includes(
              `${WIDEST_CLEARANCE}m their bodies fill`,
            ) === false,
        ],
      ]),
      {
        refused: true,
        one: true,
        code: true,
        unit: true,
        members: true,
        apart: true,
        least: true,
        notTheWidest: true,
      },
    );

    // 3. the same lifted arrangement on level ground is two ranks in one place.
    project.setWorldDesign(world(0));
    project.setFormationDesign(unit({ lateral: OPEN, depth: TIGHT }));
    const level = compiler.compile({ scope: "source" });
    const levelMessages = overlaps(
      level.success === true ? [] : level.diagnostics,
    );
    TestValidator.equals(
      "the arrangement the terrain accepted is refused once the terrain is level",
      namedFacts([
        ["refused", () => level.success === false],
        ["one", () => levelMessages.length === 1],
        // The rear rank stands on the front one rather than beside it, which is
        // the pair a level floor leaves inside its own members' width.
        ["members", () => levelMessages[0]!.includes("its slots 0 and 3")],
        ["apart", () => levelMessages[0]!.includes(`${TIGHT}m apart`)],
        [
          "least",
          () =>
            levelMessages[0]!.includes(`${LEAST_CLEARANCE}m their bodies fill`),
        ],
      ]),
      {
        refused: true,
        one: true,
        members: true,
        apart: true,
        least: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveProductionOverlapCompileCleanup(failure, () => fixture.dispose());
  }
};
