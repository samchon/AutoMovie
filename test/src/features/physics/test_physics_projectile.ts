import { projectileAt } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * `projectileAt` — closed-form ballistic evaluation: `p = origin + v·t +
 * ½·g·t²`, `v(t) = v + g·t`.
 *
 * Scenarios:
 *
 * 1. At t=0 the state is the launch state.
 * 2. Under gravity (0,−10,0) with launch (0,10,0) and velocity (5,0,0): at t=1 the
 *    body has fallen ½·10·1²=5 → position (5,5,0), velocity (5,−10,0).
 * 3. At the apex of a straight-up throw the vertical velocity is zero.
 */
export const test_physics_projectile = (): void => {
  const g = { x: 0, y: -10, z: 0 };

  // 1. t=0 → launch
  const s0 = projectileAt(
    {
      origin: { x: 1, y: 2, z: 3 },
      velocity: { x: 4, y: 5, z: 6 },
      gravity: g,
    },
    0,
  );
  TestValidator.predicate(
    "t=0 is the launch state",
    nclose(s0.position.x, 1) &&
      nclose(s0.position.y, 2) &&
      nclose(s0.position.z, 3) &&
      nclose(s0.velocity.y, 5),
  );

  // 2. arc after 1s
  const s1 = projectileAt(
    {
      origin: { x: 0, y: 10, z: 0 },
      velocity: { x: 5, y: 0, z: 0 },
      gravity: g,
    },
    1,
  );
  TestValidator.predicate(
    "position after 1s",
    nclose(s1.position.x, 5) &&
      nclose(s1.position.y, 5) &&
      nclose(s1.position.z, 0),
  );
  TestValidator.predicate(
    "velocity after 1s",
    nclose(s1.velocity.x, 5) && nclose(s1.velocity.y, -10),
  );

  // 3. apex of a vertical throw (v0=10, g=10) is at t=1, vy=0
  const apex = projectileAt(
    {
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 10, z: 0 },
      gravity: g,
    },
    1,
  );
  TestValidator.predicate(
    "apex vertical velocity is zero",
    nclose(apex.velocity.y, 0),
  );
  TestValidator.predicate(
    "apex height = v0²/2g = 5",
    nclose(apex.position.y, 5),
  );
};
