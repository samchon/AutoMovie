import { simulateSoftBody } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

/**
 * A panel with no anchor and no collider translates rigidly under gravity, so
 * every distance constraint stays exactly satisfied and the integrator is
 * observable on its own.
 *
 * Every number below is a dyadic rational, so the expectations are exact
 * equalities rather than tolerances.
 */
const freeSheet = (drag: number) =>
  softPanel({
    columns: 3,
    rows: 3,
    overrides: {
      id: "sheet",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: -8, z: 0 },
        drag,
        iterations: 3,
        stiffness: { structural: 1, shear: 1, bend: 1 },
        referenceSpeed: 4,
        maxSteps: 512,
      },
    },
  });

/**
 * The integrator reproduces the closed form of semi-implicit Euler with
 * implicit linear drag, exactly.
 *
 * The expectations are taken from the governing recurrence, not from the
 * solver's own output. With `v₀ = 0`, `v_{n+1} = (v_n + g·dt)/(1 + dt·k)` and
 * `p_{n+1} = p_n + v_{n+1}·dt` give
 *
 * ```text
 *   k = 0 :  v_n = g·dt·n            p_n = p₀ + g·dt²·n(n + 1)/2
 *   k > 0 :  v_n = (g/k)(1 − rⁿ)     p_n = p₀ + (g·dt/k)·(n − r(1 − rⁿ)/(1 − r))
 *            with r = 1/(1 + dt·k)
 * ```
 *
 * A free panel translates rigidly, so every constraint is satisfied at exactly
 * its rest length and every correction is exactly zero; what the assertions
 * read is therefore the integrator alone. The step, gravity and drag are chosen
 * so that every intermediate value is a dyadic rational and the comparison can
 * be an exact equality.
 *
 * Scenarios:
 *
 * 1. Undamped, after 8 steps of `dt = 1/64` under `g = −8`: every velocity is
 *    exactly `−1` and every particle has fallen exactly `72/1024` metres, which
 *    is `g·dt²·n(n+1)/2`.
 * 2. The rigid fall leaves `maxStrain` at exactly zero and `contacts` at zero, so
 *    nothing was corrected or collided on the way down.
 * 3. `maxSpeed` reports exactly the analytic speed, which is the measured evidence
 *    the declared `referenceSpeed` budget is checked against.
 * 4. Damped with `dt·k = 1`, so `r = 1/2`: after 4 steps the velocity is exactly
 *    `−0.125·(1 − 2⁻⁴)` and the drop is exactly `(1/512)·(n − 1 + 2⁻ⁿ)`, the
 *    closed form of the damped sum.
 * 5. Horizontal motion never appears: gravity has no `x` or `z` component, so
 *    those coordinates stay bit-identical to the rest mesh across both runs.
 */
export const test_soft_body_free_fall_hand_math = (): void => {
  const undamped = freeSheet(0);
  const fallen = simulateSoftBody(undamped, 8);
  const drop = 72 / 1024;
  TestValidator.equals(
    "an undamped free fall matches the semi-implicit Euler closed form exactly",
    namedFacts([
      [
        "velocity",
        () =>
          fallen.velocities.every((value, index) =>
            index % 3 === 1 ? Object.is(value, -1) : Object.is(value, 0),
          ),
      ],
      [
        "positions",
        () =>
          fallen.positions.every((value, index) =>
            index % 3 === 1
              ? Object.is(value, undamped.rest[index] - drop)
              : Object.is(value, undamped.rest[index]),
          ),
      ],
      ["strain", () => Object.is(fallen.maxStrain, 0)],
      ["contacts", () => fallen.contacts === 0],
      ["speed", () => Object.is(fallen.maxSpeed, 1)],
      ["time", () => Object.is(fallen.time, 8 / 64)],
    ]),
    {
      velocity: true,
      positions: true,
      strain: true,
      contacts: true,
      speed: true,
      time: true,
    },
  );

  const damped = freeSheet(64);
  const settled = simulateSoftBody(damped, 4);
  const dampedSpeed = 0.125 * (1 - 1 / 16);
  const dampedDrop = (4 - 1 + 1 / 16) / 512;
  TestValidator.equals(
    "implicit linear drag matches its own closed form exactly",
    namedFacts([
      ["velocity", () => Object.is(settled.velocities[1], -dampedSpeed)],
      [
        "positions",
        () =>
          settled.positions.every((value, index) =>
            index % 3 === 1
              ? Object.is(value, damped.rest[index] - dampedDrop)
              : Object.is(value, damped.rest[index]),
          ),
      ],
      ["speed", () => Object.is(settled.maxSpeed, dampedSpeed)],
      [
        "slowerThanUndamped",
        () =>
          dampedDrop <
          undamped.rest[1] - simulateSoftBody(undamped, 4).positions[1],
      ],
    ]),
    {
      velocity: true,
      positions: true,
      speed: true,
      slowerThanUndamped: true,
    },
  );
};
