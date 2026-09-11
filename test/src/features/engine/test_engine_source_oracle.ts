import {
  compiledFormationSlot,
  createAutoMovieSourceOracle,
  instanceSlot,
  materializeCompiledFormation,
  materializeCompiledInstanceSet,
  worldRamp,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";

const COUNT = 2_000;

/** Ground rising from 1 m at z = 0 to 5 m at z = 10, ten metres across. */
const slope = worldRamp({
  id: "slope",
  from: { x: 0, z: 0 },
  to: { x: 0, z: 10 },
  width: 10,
  baseHeight: 1,
  rise: 4,
  walkable: true,
});

const formation = materializeCompiledFormation({
  formation: {
    id: "unit",
    modelRecipe: "member",
    count: 12,
    layout: {
      kind: "line",
      files: 4,
      ranks: 3,
      spacing: { lateral: 1, depth: 1 },
    },
    anchor: { x: 0, y: 1, z: 1 },
    facingDeg: 0,
    seed: 5,
    capabilities: [],
    heroOverrides: [{ slot: 2, actor: "leader" }],
  },
  surfaces: [slope],
});

/** A crowd whose design table, default excluded, is tall 2 and short 1. */
const crowd = materializeCompiledInstanceSet({
  instanceSet: {
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
    seed: 99,
    variation: { scale: { min: 1, max: 1 }, palette: ["#ffffff"], traits: [] },
  },
  world: { routes: [] },
});

/**
 * A shot source's deterministic helpers answer from the compiled runtime the
 * production holds.
 *
 * The oracle is what a shot source calls while it is still being compiled, so
 * a member it reports has to be the member the compiled record regenerates.
 * The regression this pins is concrete: reading a compiled instance set as a
 * design counted its default prototype twice, so a source asking for a member
 * could be told a different prototype than the one drawn for it.
 *
 * Scenarios:
 *
 * 1. Distance is Euclidean: a 3-4-12 offset is 13 metres.
 * 2. Ground height is the slope's height under a point on it, and zero over no
 *    surface at all.
 * 3. A formation member is the compiled record's member, hero included, on its
 *    terrain; an instance member is the compiled set's member for every slot.
 * 4. Across two thousand members the default, tall and short prototypes are
 *    chosen about 25%, 50% and 25%, not the 40%, 40% and 20% a doubled default
 *    would give.
 * 5. An id without a compiled record refuses by name, including one only an
 *    inherited object property would answer.
 */
export const test_engine_source_oracle = (): void => {
  const oracle = createAutoMovieSourceOracle({
    world: { surfaces: [slope] },
    formationRuntime: { unit: formation },
    instanceSetRuntime: { crowd },
  });
  const members = Array.from({ length: COUNT }, (_, slot) =>
    oracle.instanceSlot("crowd", slot),
  );
  const share = (prototype: string): number =>
    members.filter((member) => member.prototype === prototype).length / COUNT;

  TestValidator.equals(
    "the source oracle's formation members are the compiled record's",
    Array.from({ length: 12 }, (_, slot) => oracle.formationSlot("unit", slot)),
    Array.from({ length: 12 }, (_, slot) =>
      compiledFormationSlot(formation, slot),
    ),
  );
  TestValidator.equals(
    "the source oracle's instance members are the compiled set's",
    members,
    Array.from({ length: COUNT }, (_, slot) => instanceSlot(crowd, slot)),
  );

  TestValidator.equals(
    "the source oracle answers geometry and refuses unknown runtimes",
    namedFacts([
      [
        "distance",
        () =>
          oracle.distance({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 15 }) === 13,
      ],
      [
        "groundOnSlope",
        () => nclose(oracle.groundHeight({ x: 0, z: 5 }), 3, 1e-12),
      ],
      [
        "groundOverNothing",
        () => oracle.groundHeight({ x: 100, z: 100 }) === 0,
      ],
      [
        "heroOnTerrain",
        () => oracle.formationSlot("unit", 2).node === "leader",
      ],
      ["default", () => Math.abs(share("default") - 0.25) < 0.04],
      ["tall", () => Math.abs(share("tall") - 0.5) < 0.04],
      ["short", () => Math.abs(share("short") - 0.25) < 0.04],
      [
        "unknownFormation",
        () =>
          throwsError(
            () => oracle.formationSlot("missing", 0),
            'Formation "missing" is unavailable.',
          ),
      ],
      [
        "inheritedFormation",
        () =>
          throwsError(
            () => oracle.formationSlot("toString", 0),
            'Formation "toString" is unavailable.',
          ),
      ],
      [
        "unknownInstanceSet",
        () =>
          throwsError(
            () => oracle.instanceSlot("missing", 0),
            'Instance set "missing" is unavailable.',
          ),
      ],
      [
        "inheritedInstanceSet",
        () =>
          throwsError(
            () => oracle.instanceSlot("constructor", 0),
            'Instance set "constructor" is unavailable.',
          ),
      ],
    ]),
    {
      distance: true,
      groundOnSlope: true,
      groundOverNothing: true,
      heroOnTerrain: true,
      default: true,
      tall: true,
      short: true,
      unknownFormation: true,
      inheritedFormation: true,
      unknownInstanceSet: true,
      inheritedInstanceSet: true,
    },
  );
};
