import {
  growPlanting,
  validatePlantingCluster,
  validatePlantingDomain,
} from "@automovie/engine";
import {
  AutoMovieViolationKind,
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts, throwsError } from "../internal/predicates";
import { plantingCluster, plantingRecipe } from "../internal/softFixtures";

/** True when one property away from sound produces exactly the named refusal. */
const refuses = (
  overrides: Partial<IAutoMoviePlantingDomain>,
  kind: AutoMovieViolationKind,
  path: string,
): boolean =>
  hasViolation(
    validatePlantingDomain({ domain: plantingRecipe(overrides) }),
    kind,
    path,
  );

/** One property away from a sound cluster. */
const refusesCluster = (
  overrides: Partial<IAutoMoviePlantingCluster>,
  kind: AutoMovieViolationKind,
  path: string,
): boolean =>
  hasViolation(
    validatePlantingCluster({ cluster: plantingCluster(overrides) }),
    kind,
    path,
  );

/** A structure patch that keeps the rest of the branching law intact. */
const structure = (
  patch: Partial<IAutoMoviePlantingDomain["structure"]>,
): Partial<IAutoMoviePlantingDomain> => ({
  structure: { ...plantingRecipe().structure, ...patch },
});

/**
 * Every planting authoring mistake is refused with the path of the offending
 * field, and every neighbouring correct authoring is accepted.
 *
 * A validator that only ever fires is as useless as one that never does, so the
 * complete recipe and the complete cluster are asserted clean first and each
 * refusal below is exactly one property away. The pass is what lets the
 * derivation grow without second-guessing its input: a ratio that does not
 * contract, a growth span that leaves the deepest level unreachable, a zero
 * direction vector, or a branching law larger than the cap the recipe set for
 * itself are all refused rather than quietly clamped.
 *
 * Scenarios:
 *
 * 1. The complete recipe and cluster validate clean.
 * 2. Identity and schema: a blank id, a wrong version, wrong units and a
 *    fractional seed.
 * 3. The branching law: a level count outside its range, a zero trunk axis, a
 *    non-positive length or radius, ratios outside `(0, 1]`, jitters outside
 *    their ranges, a gravitropism outside `[−1, 1]`, an empty and an oversized
 *    child list, a duplicated and a blank child id, a zero child direction and
 *    an offset outside `[0, 1]`.
 * 4. Growth: a stage outside `[0, 1]`, an onset outside `[0, 1]`, and an onset
 *    that would leave the deepest level unable to emerge.
 * 5. Pruning and foliage: an inverted box, a non-positive sphere radius, a
 *    non-positive density, a negative minimum level, a non-positive leaf size
 *    and jitters outside their ranges.
 * 6. Budget: caps outside their ranges, a branching law whose complete tree
 *    exceeds the cap the recipe declared for itself, and a foliage rule that
 *    bears more blades than its own leaf cap allows — with the guard measured
 *    only when the level count is itself in range, so a nonsensical depth is
 *    refused before anything tries to walk it. The leaf cap is what
 *    `growPlanting` enforces by throwing, so a recipe that survived this pass
 *    and then threw inside a binding's own validation would be a crash where a
 *    violation was asked for; a recipe with no foliage rule bears nothing and
 *    is left to the cap's own range check.
 * 7. The cluster: a blank id, an uncited recipe, a member count outside its range,
 *    a non-finite anchor, a negative extent, a fractional seed, a negative
 *    spacing, an attempt count outside its range, a non-positive minimum scale,
 *    a maximum below its minimum, and a yaw jitter outside `[0, 1]`.
 */
export const test_planting_validation = (): void => {
  TestValidator.equals(
    "the complete recipe and cluster validate clean",
    namedFacts([
      [
        "recipe",
        () =>
          validatePlantingDomain({ domain: plantingRecipe() }).success === true,
      ],
      [
        "cluster",
        () =>
          validatePlantingCluster({ cluster: plantingCluster() }).success ===
          true,
      ],
    ]),
    { recipe: true, cluster: true },
  );

  TestValidator.equals(
    "identity and schema are named",
    namedFacts([
      ["blankId", () => refuses({ id: " " }, "type", "$input.id")],
      [
        "version",
        () => refuses({ version: 0 as unknown as 1 }, "type", "$input.version"),
      ],
      [
        "units",
        () =>
          refuses(
            { units: "cm" as unknown as "meter" },
            "type",
            "$input.units",
          ),
      ],
      ["seed", () => refuses({ seed: 1.5 }, "type", "$input.seed")],
    ]),
    { blankId: true, version: true, units: true, seed: true },
  );

  TestValidator.equals(
    "the branching law is named",
    namedFacts([
      [
        "levels",
        () => refuses(structure({ levels: 0 }), "type", "structure.levels"),
      ],
      [
        "deepLevels",
        () => refuses(structure({ levels: 13 }), "type", "structure.levels"),
      ],
      [
        "axis",
        () =>
          refuses(
            structure({ axis: { x: 0, y: 0, z: 0 } }),
            "type",
            "structure.axis",
          ),
      ],
      [
        "axisValue",
        () =>
          refuses(
            structure({ axis: { x: Number.NaN, y: 1, z: 0 } }),
            "range",
            "structure.axis.x",
          ),
      ],
      [
        "length",
        () => refuses(structure({ length: 0 }), "range", "structure.length"),
      ],
      [
        "radius",
        () => refuses(structure({ radius: -1 }), "range", "structure.radius"),
      ],
      [
        "lengthRatio",
        () =>
          refuses(
            structure({ lengthRatio: 1.5 }),
            "range",
            "structure.lengthRatio",
          ),
      ],
      [
        "radiusRatio",
        () =>
          refuses(
            structure({ radiusRatio: 0 }),
            "range",
            "structure.radiusRatio",
          ),
      ],
      [
        "directionJitter",
        () =>
          refuses(
            structure({ directionJitter: 2 }),
            "range",
            "structure.directionJitter",
          ),
      ],
      [
        "lengthJitter",
        () =>
          refuses(
            structure({ lengthJitter: -1 }),
            "range",
            "structure.lengthJitter",
          ),
      ],
      [
        "gravitropism",
        () =>
          refuses(
            structure({ gravitropism: -2 }),
            "range",
            "structure.gravitropism",
          ),
      ],
      [
        "noChildren",
        () =>
          refuses(structure({ children: [] }), "type", "structure.children"),
      ],
      [
        "tooManyChildren",
        () =>
          refuses(
            structure({
              children: Array.from({ length: 17 }, (_, index) => ({
                id: `c${index}`,
                direction: { x: 1, y: 1, z: 0 },
                offset: 0.5,
              })),
            }),
            "range",
            "structure.children",
          ),
      ],
      [
        "duplicateChild",
        () =>
          refuses(
            structure({
              children: [
                { id: "a", direction: { x: 1, y: 1, z: 0 }, offset: 0.5 },
                { id: "a", direction: { x: -1, y: 1, z: 0 }, offset: 1 },
              ],
            }),
            "type",
            "structure.children[1].id",
          ),
      ],
      [
        "blankChild",
        () =>
          refuses(
            structure({
              children: [
                { id: "", direction: { x: 1, y: 1, z: 0 }, offset: 0.5 },
              ],
            }),
            "type",
            "structure.children[0].id",
          ),
      ],
      [
        "childDirection",
        () =>
          refuses(
            structure({
              children: [
                { id: "a", direction: { x: 0, y: 0, z: 0 }, offset: 0.5 },
              ],
            }),
            "type",
            "structure.children[0].direction",
          ),
      ],
      [
        "childOffset",
        () =>
          refuses(
            structure({
              children: [
                { id: "a", direction: { x: 1, y: 1, z: 0 }, offset: 2 },
              ],
            }),
            "range",
            "structure.children[0].offset",
          ),
      ],
    ]),
    {
      levels: true,
      deepLevels: true,
      axis: true,
      axisValue: true,
      length: true,
      radius: true,
      lengthRatio: true,
      radiusRatio: true,
      directionJitter: true,
      lengthJitter: true,
      gravitropism: true,
      noChildren: true,
      tooManyChildren: true,
      duplicateChild: true,
      blankChild: true,
      childDirection: true,
      childOffset: true,
    },
  );

  TestValidator.equals(
    "the growth state is named",
    namedFacts([
      [
        "stage",
        () =>
          refuses(
            { growth: { stage: 1.5, onset: 0.25 } },
            "range",
            "growth.stage",
          ),
      ],
      [
        "onset",
        () =>
          refuses(
            { growth: { stage: 1, onset: -0.5 } },
            "range",
            "growth.onset",
          ),
      ],
      [
        "unreachable",
        () =>
          refuses(
            { growth: { stage: 1, onset: 0.5 } },
            "range",
            "growth.onset",
          ),
      ],
      [
        "reachable",
        () =>
          validatePlantingDomain({
            domain: plantingRecipe({ growth: { stage: 1, onset: 0.49 } }),
          }).success === true,
      ],
    ]),
    { stage: true, onset: true, unreachable: true, reachable: true },
  );

  TestValidator.equals(
    "the pruning envelope and the foliage rule are named",
    namedFacts([
      [
        "box",
        () =>
          refuses(
            {
              pruning: {
                kind: "box",
                min: { x: 0, y: 0, z: 0 },
                max: { x: 0, y: 1, z: 1 },
              },
            },
            "range",
            "pruning.max.x",
          ),
      ],
      [
        "boxValue",
        () =>
          refuses(
            {
              pruning: {
                kind: "box",
                min: { x: Number.NaN, y: 0, z: 0 },
                max: { x: 1, y: 1, z: 1 },
              },
            },
            "range",
            "pruning.min.x",
          ),
      ],
      [
        "sphere",
        () =>
          refuses(
            {
              pruning: {
                kind: "sphere",
                center: { x: 0, y: 0, z: 0 },
                radius: 0,
              },
            },
            "range",
            "pruning.radius",
          ),
      ],
      [
        "density",
        () =>
          refuses(
            {
              foliage: {
                density: 0,
                minLevel: 0,
                size: { x: 1, y: 1, z: 1 },
                scaleJitter: 0,
                rollJitter: 0,
              },
            },
            "range",
            "foliage.density",
          ),
      ],
      [
        "minLevel",
        () =>
          refuses(
            {
              foliage: {
                density: 1,
                minLevel: -1,
                size: { x: 1, y: 1, z: 1 },
                scaleJitter: 0,
                rollJitter: 0,
              },
            },
            "type",
            "foliage.minLevel",
          ),
      ],
      [
        "size",
        () =>
          refuses(
            {
              foliage: {
                density: 1,
                minLevel: 0,
                size: { x: 1, y: 0, z: 1 },
                scaleJitter: 0,
                rollJitter: 0,
              },
            },
            "range",
            "foliage.size.y",
          ),
      ],
      [
        "scaleJitter",
        () =>
          refuses(
            {
              foliage: {
                density: 1,
                minLevel: 0,
                size: { x: 1, y: 1, z: 1 },
                scaleJitter: 2,
                rollJitter: 0,
              },
            },
            "range",
            "foliage.scaleJitter",
          ),
      ],
      [
        "rollJitter",
        () =>
          refuses(
            {
              foliage: {
                density: 1,
                minLevel: 0,
                size: { x: 1, y: 1, z: 1 },
                scaleJitter: 0,
                rollJitter: -1,
              },
            },
            "range",
            "foliage.rollJitter",
          ),
      ],
    ]),
    {
      box: true,
      boxValue: true,
      sphere: true,
      density: true,
      minLevel: true,
      size: true,
      scaleJitter: true,
      rollJitter: true,
    },
  );

  TestValidator.equals(
    "the declared budget is named",
    namedFacts([
      [
        "branchCap",
        () =>
          refuses(
            { budget: { maxBranches: 0, maxLeaves: 8 } },
            "type",
            "budget.maxBranches",
          ),
      ],
      [
        "leafCap",
        () =>
          refuses(
            { budget: { maxBranches: 8, maxLeaves: -1 } },
            "type",
            "budget.maxLeaves",
          ),
      ],
      [
        "outgrown",
        () =>
          refuses(
            { budget: { maxBranches: 3, maxLeaves: 8 } },
            "range",
            "budget.maxBranches",
          ),
      ],
      [
        "outleafed",
        () =>
          refuses(
            {
              foliage: {
                density: 4,
                minLevel: 1,
                size: { x: 0.05, y: 0.1, z: 0.05 },
                scaleJitter: 0,
                rollJitter: 0,
              },
              budget: { maxBranches: 64, maxLeaves: 2 },
            },
            "range",
            "budget.maxLeaves",
          ),
      ],
      [
        "outleafedIsWhatTheDerivationWouldThrow",
        () =>
          throwsError(
            () =>
              growPlanting(
                plantingRecipe({
                  foliage: {
                    density: 4,
                    minLevel: 1,
                    size: { x: 0.05, y: 0.1, z: 0.05 },
                    scaleJitter: 0,
                    rollJitter: 0,
                  },
                  budget: { maxBranches: 64, maxLeaves: 2 },
                }),
              ),
            "exceeded its declared cap of 2 leaves",
          ),
      ],
      [
        "leafedInsideItsCapIsAccepted",
        () =>
          validatePlantingDomain({
            domain: plantingRecipe({
              foliage: {
                density: 4,
                minLevel: 1,
                size: { x: 0.05, y: 0.1, z: 0.05 },
                scaleJitter: 0,
                rollJitter: 0,
              },
              budget: { maxBranches: 64, maxLeaves: 8 },
            }),
          }).success === true,
      ],
      [
        "notWalkedWhenDepthIsAbsurd",
        () =>
          validatePlantingDomain({
            domain: plantingRecipe({
              structure: {
                ...plantingRecipe().structure,
                levels: Number.MAX_SAFE_INTEGER,
              },
              budget: { maxBranches: 1, maxLeaves: 0 },
            }),
          }).success === false,
      ],
      [
        "fractionalBranchCapIsNotAlsoOutgrown",
        () => {
          const validation = validatePlantingDomain({
            domain: plantingRecipe({
              budget: { maxBranches: 3.5, maxLeaves: 8 },
            }),
          });
          return (
            validation.success === false &&
            validation.violations.every((item) => item.kind !== "range")
          );
        },
      ],
    ]),
    {
      branchCap: true,
      leafCap: true,
      outgrown: true,
      outleafed: true,
      outleafedIsWhatTheDerivationWouldThrow: true,
      leafedInsideItsCapIsAccepted: true,
      notWalkedWhenDepthIsAbsurd: true,
      fractionalBranchCapIsNotAlsoOutgrown: true,
    },
  );

  TestValidator.equals(
    "the cluster is named",
    namedFacts([
      ["blankId", () => refusesCluster({ id: " " }, "type", "$input.id")],
      ["domain", () => refusesCluster({ domain: "" }, "type", "$input.domain")],
      ["count", () => refusesCluster({ count: 0 }, "type", "$input.count")],
      [
        "tooMany",
        () => refusesCluster({ count: 10_001 }, "type", "$input.count"),
      ],
      [
        "anchor",
        () =>
          refusesCluster(
            { anchor: { x: Number.NaN, y: 0, z: 0 } },
            "range",
            "$input.anchor.x",
          ),
      ],
      [
        "extent",
        () =>
          refusesCluster(
            { extent: { x: -1, z: 2 } },
            "range",
            "$input.extent.x",
          ),
      ],
      [
        "extentZ",
        () =>
          refusesCluster(
            { extent: { x: 1, z: -2 } },
            "range",
            "$input.extent.z",
          ),
      ],
      ["seed", () => refusesCluster({ seed: 0.5 }, "type", "$input.seed")],
      [
        "spacing",
        () => refusesCluster({ minSpacing: -1 }, "range", "$input.minSpacing"),
      ],
      [
        "attempts",
        () => refusesCluster({ attempts: 0 }, "type", "$input.attempts"),
      ],
      [
        "attemptBudget",
        () => refusesCluster({ attempts: 65 }, "type", "$input.attempts"),
      ],
      [
        "minScale",
        () =>
          refusesCluster(
            {
              scale: {
                min: { x: 0, y: 1, z: 1 },
                max: { x: 1, y: 1, z: 1 },
              },
            },
            "range",
            "$input.scale.min.x",
          ),
      ],
      [
        "maxScale",
        () =>
          refusesCluster(
            {
              scale: {
                min: { x: 1, y: 1, z: 1 },
                max: { x: 0.5, y: 1, z: 1 },
              },
            },
            "range",
            "$input.scale.max.x",
          ),
      ],
      [
        "yawJitter",
        () => refusesCluster({ yawJitter: 2 }, "range", "$input.yawJitter"),
      ],
    ]),
    {
      blankId: true,
      domain: true,
      count: true,
      tooMany: true,
      anchor: true,
      extent: true,
      extentZ: true,
      seed: true,
      spacing: true,
      attempts: true,
      attemptBudget: true,
      minScale: true,
      maxScale: true,
      yawJitter: true,
    },
  );
};
