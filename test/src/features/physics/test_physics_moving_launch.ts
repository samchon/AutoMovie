import {
  projectileAt,
  solveBallisticLaunch,
  solveMovingLaunch,
} from "@autofilm/engine";
import { IAutoFilmVector3 } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";

const GRAVITY: IAutoFilmVector3 = { x: 0, y: -9.81, z: 0 };

/**
 * `solveMovingLaunch` — the aim that leads a **moving** target, fixed-point on
 * the time of flight. The contract is the forward oracle: fire the returned
 * velocity and, at the returned hit time, the projectile sits on the target's
 * position at _that_ time (`targetAt(hitTime)`), so the shaft and the mover
 * arrive together.
 *
 * Scenarios:
 *
 * 1. A stationary target reduces to the static solve — same velocity and hit time
 *    as `solveBallisticLaunch` on that point.
 * 2. A target sliding downrange is led: the baked flight meets `targetAt(hitTime)`
 *    to millimetres.
 * 3. Capping the iterations returns the best-so-far solve (a partial lead that has
 *    not settled), not null.
 * 4. A target that outruns the shot at the given speed → null (out of range at
 *    some iterate).
 * 5. A non-positive speed → null.
 */
export const test_physics_moving_launch = (): void => {
  const origin: IAutoFilmVector3 = { x: 0, y: 1.6, z: 0 };

  // 1. stationary → the static solve
  const still: IAutoFilmVector3 = { x: 7, y: 1, z: 2 };
  const moving = solveMovingLaunch(origin, () => still, 16)!;
  const staticSol = solveBallisticLaunch(origin, still, 16)!;
  TestValidator.predicate(
    "a stationary target reduces to the static solve",
    vclose(moving.velocity, staticSol.velocity, 1e-6) &&
      nclose(moving.hitTime, staticSol.hitTime, 1e-6),
  );

  // 2. a target sliding downrange (+x at 3 m/s) is led onto the meeting point
  const slide = (t: number): IAutoFilmVector3 => ({ x: 6 + 3 * t, y: 1, z: 0 });
  const lead = solveMovingLaunch(origin, slide, 20)!;
  const meet = projectileAt(
    { origin, velocity: lead.velocity, gravity: GRAVITY },
    lead.hitTime,
  ).position;
  TestValidator.predicate(
    "the led flight meets the target where it will be",
    vclose(meet, slide(lead.hitTime), 1e-3),
  );
  TestValidator.predicate(
    "the intercept is ahead of the start",
    lead.hitTime > 0,
  );

  // 3. one iteration returns the best-so-far solve (an unsettled partial lead)
  const partial = solveMovingLaunch(origin, slide, 20, GRAVITY, "direct", 1);
  TestValidator.predicate(
    "capped iterations still return a solve",
    partial !== null,
  );
  TestValidator.predicate(
    "and the partial lead has not fully settled onto the meeting point",
    partial !== null && !nclose(partial.hitTime, lead.hitTime, 1e-6),
  );

  // 4. a target that outruns the shot → out of range → null
  const flee = (t: number): IAutoFilmVector3 => ({
    x: 40 + 30 * t,
    y: 1,
    z: 0,
  });
  TestValidator.equals(
    "a target that outruns the shot → null",
    solveMovingLaunch(origin, flee, 10),
    null,
  );

  // 5. a non-positive speed → null
  TestValidator.equals(
    "a non-positive speed → null",
    solveMovingLaunch(origin, () => still, 0),
    null,
  );
};
