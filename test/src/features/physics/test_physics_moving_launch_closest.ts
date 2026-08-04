import { solveBallisticLaunch, solveMovingLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const origin: IAutoMovieVector3 = { x: 0, y: 1.6, z: 0 };
const GRAVITY: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };

/**
 * A target accelerating away (`x = 20 + 5t²`) makes `solveMovingLaunch`'s fixed
 * point **oscillate** instead of settle: the flight-time residual `|hitTime −
 * guess|` falls to a minimum and then rises again. When the loop is capped
 * before it diverges, the solver must return the **closest** iterate it visited
 * (the one the JSDoc promises), not merely the last guess, which is farther
 * from a fixed point.
 *
 * The fixed-point walk is reconstructed here from the static aim
 * ({@link solveBallisticLaunch}), the exact per-iterate oracle
 * `solveMovingLaunch` uses internally, so the closest and last iterates are
 * named rather than snapshotted. With this accelerating target the residual
 * bottoms out at iterate 2 and climbs at iterate 3, so a 4-iterate cap returns
 * iterate 2's solve, distinct from iterate 3's.
 */
export const test_physics_moving_launch_closest = (): void => {
  const speed = 20;
  const accel = (t: number): IAutoMovieVector3 => ({
    x: 20 + 5 * t * t,
    y: 1,
    z: 0,
  });

  // Walk the same fixed point the solver walks, capturing each iterate's
  // hit-time and residual. The guess for iterate 0 is the target's current
  // distance over the speed, exactly as solveMovingLaunch seeds it.
  const init = accel(0);
  let guess =
    Math.hypot(init.x - origin.x, init.y - origin.y, init.z - origin.z) / speed;
  const iterates: Array<{ hitTime: number; residual: number }> = [];
  for (let i = 0; i < 4; ++i) {
    const solve = solveBallisticLaunch(origin, accel(guess), speed, GRAVITY)!;
    iterates.push({
      hitTime: solve.hitTime,
      residual: Math.abs(solve.hitTime - guess),
    });
    guess = solve.hitTime;
  }

  const closest = iterates.reduce((a, b) => (b.residual < a.residual ? b : a));
  const last = iterates[iterates.length - 1]!;
  TestValidator.predicate(
    "the residual is non-monotone, the fixed point does not settle within four",
    closest !== last && last.residual > closest.residual,
  );

  // Capped at four iterates the moving-launch solve must be the closest iterate
  // (iterate 2, hitTime ~1.7355), NOT the last one visited (iterate 3, ~1.9894).
  const led = solveMovingLaunch(origin, accel, speed, GRAVITY, "direct", 4);
  TestValidator.predicate(
    "the capped moving launch returns the closest iterate, not the last",
    led !== null &&
      nclose(led.hitTime, closest.hitTime, 1e-9) &&
      !nclose(led.hitTime, last.hitTime, 1e-6),
  );
};
