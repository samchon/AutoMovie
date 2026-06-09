import { dampedSpring } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The 1-D damped spring used for secondary motion (tail/ear follow-through).
 * Pinned by hand-computed semi-implicit Euler: `v += (k·(target−x) − c·v)·dt; x
 * += v·dt`.
 *
 * Scenarios:
 *
 * 1. Resting exactly on the target with no velocity stays put (zero force).
 * 2. One step from below the target gains positive velocity and moves toward it
 *    (k=20, x=0→target 10, dt=0.1 ⇒ v=20, x=2).
 * 3. Pure damping (k=0) bleeds velocity: v=50, c=10, dt=0.1 ⇒ v=0, x unchanged.
 * 4. Iterating many steps converges onto the target and comes to rest.
 */
export const test_motion_damped_spring = (): void => {
  // 1. at rest on target
  const a = dampedSpring(5, 0, 5, { stiffness: 50, damping: 8 }, 0.1);
  TestValidator.predicate("rest value holds", nclose(a.value, 5));
  TestValidator.predicate("rest velocity holds", nclose(a.velocity, 0));

  // 2. pulled toward a higher target
  const b = dampedSpring(0, 0, 10, { stiffness: 20, damping: 4 }, 0.1);
  TestValidator.predicate("velocity = k·Δ·dt", nclose(b.velocity, 20));
  TestValidator.predicate("value = v·dt", nclose(b.value, 2));

  // 3. pure damping kills velocity
  const c = dampedSpring(0, 50, 0, { stiffness: 0, damping: 10 }, 0.1);
  TestValidator.predicate("damped velocity → 0", nclose(c.velocity, 0));
  TestValidator.predicate("value unchanged", nclose(c.value, 0));

  // 4. converges onto the target
  let s = { value: 0, velocity: 0 };
  for (let i = 0; i < 400; ++i)
    s = dampedSpring(
      s.value,
      s.velocity,
      1,
      { stiffness: 120, damping: 20 },
      1 / 60,
    );
  TestValidator.predicate("converges to target", nclose(s.value, 1, 1e-3));
  TestValidator.predicate("settles to rest", nclose(s.velocity, 0, 1e-3));
};
