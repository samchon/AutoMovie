import { simulateSoftBody } from "@automovie/engine";
import { IAutoMovieSoftBodyDomain } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

const COLUMNS = 5;
const ROWS = 4;

/**
 * A curtain whose rest mesh, masses, anchors, colliders and draught are all
 * mirror images of themselves about the plane `x = 0`.
 *
 * The odd column count puts a particle exactly on the mirror plane, which is
 * the strictest case: its own left and right corrections must cancel to exactly
 * zero rather than to an ulp.
 */
const symmetric = (): IAutoMovieSoftBodyDomain =>
  softPanel({
    columns: COLUMNS,
    rows: ROWS,
    origin: { x: -0.5, y: 0, z: 0 },
    overrides: {
      id: "mirror",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: -8, z: 0 },
        drag: 0.5,
        iterations: 3,
        stiffness: { structural: 1, shear: 0.5, bend: 0.25 },
        referenceSpeed: 4,
        maxSteps: 512,
      },
      anchors: [
        { id: "hook-left", particle: 0, position: null },
        { id: "hook-right", particle: COLUMNS - 1, position: null },
      ],
      colliders: [
        {
          kind: "plane",
          id: "floor",
          normal: { x: 0, y: 2, z: 0 },
          offset: -0.78125,
        },
        {
          kind: "sphere",
          id: "bolster",
          center: { x: 0, y: -1, z: 0 },
          radius: 0.25,
        },
      ],
      wind: {
        direction: { x: 0, y: 0, z: 1 },
        acceleration: 0.5,
        gustAcceleration: 2,
        gustHz: 4,
      },
    },
  });

/** True when the two mirror partners of every particle are exact reflections. */
const reflected = (values: number[]): boolean => {
  for (let row = 0; row < ROWS; ++row)
    for (let column = 0; column < COLUMNS; ++column) {
      const here = (row * COLUMNS + column) * 3;
      const there = (row * COLUMNS + (COLUMNS - 1 - column)) * 3;
      if (values[there] !== -values[here]) return false;
      if (values[there + 1] !== values[here + 1]) return false;
      if (values[there + 2] !== values[here + 2]) return false;
    }
  return true;
};

/**
 * A symmetrically authored panel stays symmetric to the last bit, however long
 * it is integrated.
 *
 * This is not a cosmetic property. Mirroring a lattice swaps every constraint
 * with its partner and negates one coordinate, so a solver that summed a
 * particle's incident corrections as one running total would compute the two
 * halves in different orders. Floating-point addition is commutative for two
 * terms and **not** associative for more, so a four-term or twelve-term running
 * sum drifts by an ulp per particle per sweep and a curtain that should hang
 * straight develops a lean nobody authored. The solver therefore folds each
 * mirror pair as its own two-term sum before the families are combined, and
 * this case is what holds that structure in place.
 *
 * The panel is deliberately hard: gravity, drag, a gusting draught, a
 * reflecting floor, a ball to drape over, two anchors and an odd column count
 * so one particle sits exactly on the mirror plane.
 *
 * Scenarios:
 *
 * 1. After 128 steps every particle's position is the exact negation in `x`, and
 *    the exact equal in `y` and `z`, of its mirror partner's.
 * 2. The same holds for velocities, so the symmetry is a property of the state and
 *    not only of where the particles happened to land.
 * 3. The particle on the mirror plane keeps `x` exactly zero rather than a
 *    residual, which is what the two-term fold buys over a running total.
 * 4. The panel really did move and really did touch a collider, so the symmetry is
 *    being asserted about a live solve and not about an untouched rest mesh.
 * 5. Breaking the authored symmetry by one anchor breaks the reflection, which
 *    proves the check can fail.
 */
export const test_soft_body_mirror_symmetry = (): void => {
  const domain = symmetric();
  const solved = simulateSoftBody(domain, 128);
  TestValidator.equals(
    "a symmetric panel stays bit-exactly symmetric",
    namedFacts([
      ["positions", () => reflected(solved.positions)],
      ["velocities", () => reflected(solved.velocities)],
      [
        "centreColumn",
        () =>
          [0, 1, 2, 3].every((row) =>
            Object.is(solved.positions[(row * COLUMNS + 2) * 3], 0),
          ),
      ],
      ["moved", () => solved.maxSpeed > 0],
      ["touched", () => solved.contacts > 0],
    ]),
    {
      positions: true,
      velocities: true,
      centreColumn: true,
      moved: true,
      touched: true,
    },
  );

  const lopsided = symmetric();
  lopsided.anchors[1] = {
    id: "hook-right",
    particle: COLUMNS - 1,
    position: { x: 0.25, y: 0, z: 0 },
  };
  TestValidator.equals(
    "breaking the authored symmetry breaks the reflection",
    reflected(simulateSoftBody(lopsided, 128).positions),
    false,
  );
};
