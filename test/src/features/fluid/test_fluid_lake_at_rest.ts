import { simulateFluidDomain } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { exactArray, fluidDomain } from "../internal/fluidFixtures";
import { namedFacts } from "../internal/predicates";

const BED = [
  0, 0, 0.25, 0.5, 0, 0.25, 0.5, 0.75, 0.25, 0.5, 0.75, 0.75, 0.5, 0.75, 0.75,
  0.75,
];
const LEVEL = 0.5;
const DEPTH = BED.map((bed) => (bed < LEVEL ? LEVEL - bed : 0));

const restingPond = (depth: number[] = DEPTH) =>
  fluidDomain({
    id: "still-pond",
    grid: {
      columns: 4,
      rows: 4,
      cellX: 0.5,
      cellZ: 0.5,
      origin: { x: 0, y: 0, z: 0 },
    },
    solver: {
      fixedStepSeconds: 0.015625,
      gravity: 8,
      drag: 0,
      dryDepth: 0,
      referenceDepth: 0.5,
      maxSteps: 5_000,
    },
    bed: BED,
    depth,
    solid: new Array(16).fill(false),
  });

/**
 * An indoor still pond over an uneven bed with a dry shore is a numerically
 * **exact** fixed point of the solver, and a pond one drop out of level is
 * not.
 *
 * This is the well-balanced (C-property) oracle of the shallow-water scheme,
 * and it is what makes a mirror pool in an atrium hold still instead of
 * developing spurious currents down its own bed slope. It holds exactly, not
 * approximately, because the pressure term reads the free surface `η = b + h`
 * rather than the depth: with every bed and level a dyadic rational, `Δη` is
 * exactly zero and the face velocity stays exactly zero forever.
 *
 * The shore covers both wetting-and-drying arms: a cell whose bed stands
 * strictly above the water (`0.75 > 0.5`) and the exact-tie cell whose bed sits
 * precisely at the water level (`0.5 == 0.5`), which must also refuse to draw
 * water uphill.
 *
 * Scenarios:
 *
 * 1. After 300 steps every depth is bit-identical to the authored one.
 * 2. After 300 steps every face velocity is still exactly zero.
 * 3. The volume is exactly the hand-computed 0.5625 m³ and the ledger is empty.
 * 4. The negative twin: raising one interior cell by 0.0625 m breaks the level,
 *    and one single step already moves both the surface and the velocity
 *    field.
 */
export const test_fluid_lake_at_rest = (): void => {
  const domain = restingPond();
  const settled = simulateFluidDomain(domain, 300);
  TestValidator.equals(
    "a level pond over an uneven bed never moves",
    namedFacts([
      ["depth", () => exactArray(settled.depth, DEPTH)],
      [
        "velocityX",
        () => settled.velocityX.every((value) => Object.is(value, 0)),
      ],
      [
        "velocityZ",
        () => settled.velocityZ.every((value) => Object.is(value, 0)),
      ],
      ["volume", () => Object.is(settled.volume, 0.5625)],
      ["ledger", () => Object.is(settled.outflowVolume, 0)],
    ]),
    {
      depth: true,
      velocityX: true,
      velocityZ: true,
      volume: true,
      ledger: true,
    },
  );

  const tilted = DEPTH.slice();
  tilted[0] = DEPTH[0] + 0.0625;
  const disturbed = simulateFluidDomain(restingPond(tilted), 1);
  TestValidator.equals(
    "one drop out of level and the pond is no longer at rest",
    namedFacts([
      ["depthMoved", () => exactArray(disturbed.depth, tilted) === false],
      ["velocityMoved", () => disturbed.velocityX.some((value) => value !== 0)],
      [
        "velocityMovedZ",
        () => disturbed.velocityZ.some((value) => value !== 0),
      ],
    ]),
    { depthMoved: true, velocityMoved: true, velocityMovedZ: true },
  );
};
