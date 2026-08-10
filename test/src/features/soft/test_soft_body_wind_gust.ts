import { simulateSoftBody } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { softPanel } from "../internal/softFixtures";

/** A weightless two-particle strip pushed only by the declared draught. */
const breeze = (props: {
  direction: IAutoMovieVector3;
  acceleration: number;
  gustAcceleration: number;
  gustHz: number;
}) =>
  softPanel({
    columns: 1,
    rows: 2,
    overrides: {
      id: "streamer",
      solver: {
        fixedStepSeconds: 0.015625,
        gravity: { x: 0, y: 0, z: 0 },
        drag: 0,
        iterations: 2,
        stiffness: { structural: 1, shear: 1, bend: 1 },
        referenceSpeed: 4,
        maxSteps: 256,
      },
      wind: {
        direction: props.direction,
        acceleration: props.acceleration,
        gustAcceleration: props.gustAcceleration,
        gustHz: props.gustHz,
      },
    },
  });

/**
 * The draught is a triangular gust evaluated from exactly specified arithmetic,
 * and it reproduces its own closed form.
 *
 * A sinusoidal gust would be the obvious choice and is the wrong one:
 * ECMAScript leaves `Math.sin` implementation-approximated, so a curtain's
 * folds would depend on which engine built the frame. The solver therefore
 * evaluates `4·|φ − ½| − 1` over the unit phase `φ = f·t − ⌊f·t⌋`, which uses
 * only multiplication, subtraction, `Math.abs` and `Math.floor` and is
 * therefore bit-reproducible everywhere.
 *
 * With `f = 4 Hz` and `dt = 1/64 s`, `φ(n) = n/16 − ⌊n/16⌋`, so the gust runs
 * `+1, +0.75, +0.5, +0.25, 0, …` and reaches `−1` at `n = 8`. Under
 * `gustAcceleration = 2` and no steady component, the accelerations of the
 * first four steps are exactly `2, 1.5, 1, 0.5`, which integrate to
 *
 * ```text
 *   v₄ = (2 + 1.5 + 1 + 0.5)/64 = 5/64
 *   p₄ = (v₁ + v₂ + v₃ + v₄)/64 = (15/64)/64 = 15/4096
 * ```
 *
 * Scenarios:
 *
 * 1. Four steps of the gust reproduce `v₄ = 5/64` and `p₄ = 15/4096` exactly, on
 *    both particles, with the transverse coordinates untouched.
 * 2. A non-unit direction is normalized rather than scaling the force: `(2,0,0)`
 *    produces exactly the same state as `(1,0,0)`.
 * 3. The gust is genuinely signed: by step 12 the draught has reversed, so the
 *    strip is slower than it was at its peak rather than monotonically faster.
 * 4. `gustHz = 0` holds the gust at its peak, so the acceleration is exactly the
 *    steady component plus the full amplitude and the motion is a plain
 *    constant-acceleration ramp.
 * 5. A panel with no declared draught does not move at all, which pins the
 *    contribution as the draught's rather than the integrator's.
 */
export const test_soft_body_wind_gust = (): void => {
  const gusting = breeze({
    direction: { x: 1, y: 0, z: 0 },
    acceleration: 0,
    gustAcceleration: 2,
    gustHz: 4,
  });
  const blown = simulateSoftBody(gusting, 4);
  TestValidator.equals(
    "a triangular gust integrates to its own closed form exactly",
    namedFacts([
      [
        "velocity",
        () =>
          blown.velocities.every((value, index) =>
            index % 3 === 0 ? Object.is(value, 5 / 64) : Object.is(value, 0),
          ),
      ],
      [
        "positions",
        () =>
          blown.positions.every((value, index) =>
            index % 3 === 0
              ? Object.is(value, gusting.rest[index] + 15 / 4096)
              : Object.is(value, gusting.rest[index]),
          ),
      ],
      ["strain", () => Object.is(blown.maxStrain, 0)],
    ]),
    { velocity: true, positions: true, strain: true },
  );

  const scaled = simulateSoftBody(
    breeze({
      direction: { x: 2, y: 0, z: 0 },
      acceleration: 0,
      gustAcceleration: 2,
      gustHz: 4,
    }),
    4,
  );
  TestValidator.equals(
    "a non-unit draught direction is normalized, not amplified",
    namedFacts([
      ["velocity", () => Object.is(scaled.velocities[0], 5 / 64)],
      ["position", () => Object.is(scaled.positions[0], blown.positions[0])],
    ]),
    { velocity: true, position: true },
  );

  TestValidator.equals(
    "the gust reverses rather than pushing forever",
    simulateSoftBody(gusting, 12).velocities[0] <
      simulateSoftBody(gusting, 4).velocities[0],
    true,
  );

  const steady = breeze({
    direction: { x: 1, y: 0, z: 0 },
    acceleration: 1,
    gustAcceleration: 2,
    gustHz: 0,
  });
  const ramp = simulateSoftBody(steady, 4);
  TestValidator.equals(
    "a zero gust frequency holds the gust at its peak",
    namedFacts([
      ["velocity", () => Object.is(ramp.velocities[0], (3 * 4) / 64)],
      [
        "position",
        () =>
          Object.is(
            ramp.positions[0],
            steady.rest[0] + (3 * (1 + 2 + 3 + 4)) / 4096,
          ),
      ],
    ]),
    { velocity: true, position: true },
  );

  const still = simulateSoftBody(
    softPanel({
      columns: 1,
      rows: 2,
      overrides: {
        id: "still",
        solver: {
          fixedStepSeconds: 0.015625,
          gravity: { x: 0, y: 0, z: 0 },
          drag: 0,
          iterations: 2,
          stiffness: { structural: 1, shear: 1, bend: 1 },
          referenceSpeed: 4,
          maxSteps: 256,
        },
      },
    }),
    4,
  );
  TestValidator.equals(
    "still air moves nothing",
    still.velocities.every((value) => Object.is(value, 0)),
    true,
  );
};
