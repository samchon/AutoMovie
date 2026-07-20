import { projectileAt, solveBallisticLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const GRAVITY: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };
const ORIGIN: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };

/** The projectile lands on `target` when the solved flight runs `hitTime`. */
const landsOn = (
  solution: { velocity: IAutoMovieVector3; hitTime: number },
  target: IAutoMovieVector3,
): boolean =>
  vclose(
    projectileAt(
      { origin: ORIGIN, velocity: solution.velocity, gravity: GRAVITY },
      solution.hitTime,
    ).position,
    target,
    1e-3,
  );

/**
 * The purely-vertical branch of `solveBallisticLaunch` must honour the `arc`
 * selection like the general range equation does (#1142): `direct` is the
 * faster, lower flight, `high` the lobbed one. Before the fix the branch never
 * read `arc`: a target below always got the up-and-over lob (a "direct" shot
 * seconds late) and a target overhead never got the descending re-crossing a
 * "high" shot asks for; the react `compileLaunch` schedules at `start +
 * hitTime` fired at the wrong instant.
 *
 * Scenarios (hand-computed closed-form oracles; every flight re-simulated onto
 * the target via `projectileAt`):
 *
 * 1. Target 20 m straight below, speed 20, `direct` → fired straight down, `t =
 *    (−s + √(s²+2g·20))/g = 0.7796…` s.
 * 2. The same target, `high` → fired straight up and falling past, `t = (s +
 *    √(s²+2g·20))/g = 4.8574…` s; both arcs land on the target.
 * 3. Target 10 m straight overhead, speed 20, `direct` → the rising first crossing
 *    `(s − √(s²−2gh))/g = 0.5835…` s (unchanged semantics).
 * 4. The same target, `high` → the descending re-crossing `(s + √(s²−2gh))/g =
 *    3.4939…` s, fired up; both land on the target.
 * 5. Negative twins: an overhead target beyond `s²/2g` is out of range for BOTH
 *    arcs; zero gravity keeps the straight sightline shot for both.
 */
export const test_physics_ballistic_vertical_arc = (): void => {
  // 1./2. Below: h = −20, s = 20 → disc = 400 + 2·9.81·20 = 792.4;
  //       √792.4 = 28.1495988…
  const below: IAutoMovieVector3 = { x: 0, y: -20, z: 0 };
  const directDown = solveBallisticLaunch(
    ORIGIN,
    below,
    20,
    GRAVITY,
    "direct",
  )!;
  TestValidator.predicate(
    "direct below fires straight down",
    vclose(directDown.velocity, { x: 0, y: -20, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "direct below hits at the downward root",
    nclose(directDown.hitTime, (28.1495988 - 20) / 9.81, 1e-4),
  );
  TestValidator.predicate(
    "the direct drop lands on the target",
    landsOn(directDown, below),
  );

  const highDown = solveBallisticLaunch(ORIGIN, below, 20, GRAVITY, "high")!;
  TestValidator.predicate(
    "high below fires straight up and falls past",
    vclose(highDown.velocity, { x: 0, y: 20, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "high below hits at the lobbed root",
    nclose(highDown.hitTime, (20 + 28.1495988) / 9.81, 1e-4),
  );
  TestValidator.predicate(
    "the lob lands on the target",
    landsOn(highDown, below),
  );

  // 3./4. Overhead: h = 10, s = 20 → disc = 400 − 2·9.81·10 = 203.8;
  //       √203.8 = 14.2758537…
  const overhead: IAutoMovieVector3 = { x: 0, y: 10, z: 0 };
  const directUp = solveBallisticLaunch(
    ORIGIN,
    overhead,
    20,
    GRAVITY,
    "direct",
  )!;
  TestValidator.predicate(
    "direct overhead keeps the rising first contact",
    nclose(directUp.hitTime, (20 - 14.2758537) / 9.81, 1e-4),
  );
  const highUp = solveBallisticLaunch(ORIGIN, overhead, 20, GRAVITY, "high")!;
  TestValidator.predicate(
    "high overhead takes the descending re-crossing",
    nclose(highUp.hitTime, (20 + 14.2758537) / 9.81, 1e-4),
  );
  TestValidator.predicate(
    "high overhead still fires straight up",
    vclose(highUp.velocity, { x: 0, y: 20, z: 0 }, 1e-9),
  );
  TestValidator.predicate(
    "both overhead arcs land on the target",
    landsOn(directUp, overhead) && landsOn(highUp, overhead),
  );

  // 5. Negative twins.
  //    Out of range overhead: s²/2g = 100/19.62 = 5.0968 m < 6 m at s = 10.
  const unreachable: IAutoMovieVector3 = { x: 0, y: 6, z: 0 };
  TestValidator.predicate(
    "an overhead target beyond s²/2g is out of range for both arcs",
    solveBallisticLaunch(ORIGIN, unreachable, 10, GRAVITY, "direct") === null &&
      solveBallisticLaunch(ORIGIN, unreachable, 10, GRAVITY, "high") === null,
  );
  const weightless: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };
  const straight = solveBallisticLaunch(
    { x: 0, y: 5, z: 0 },
    weightless,
    10,
    { x: 0, y: 0, z: 0 },
    "high",
  )!;
  TestValidator.predicate(
    "zero gravity keeps the straight sightline shot for either arc",
    vclose(straight.velocity, { x: 0, y: -10, z: 0 }, 1e-9) &&
      nclose(straight.hitTime, 0.5, 1e-9),
  );
};
