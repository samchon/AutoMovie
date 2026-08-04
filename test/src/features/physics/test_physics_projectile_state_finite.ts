import { IAutoMovieProjectile, projectileAt } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const PROJECTILE: IAutoMovieProjectile = {
  origin: { x: 1, y: 2, z: 3 },
  velocity: { x: 4, y: 5, z: 6 },
  gravity: { x: 0, y: -10, z: 2 },
};

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * `projectileAt` is the public closed-form evaluator for projectile state.
 * Every scalar input must be finite so callers cannot receive non-finite
 * positions or velocities from an exported physics helper.
 *
 * Scenarios:
 *
 * 1. Non-finite time and projectile vector components throw before evaluation.
 * 2. Finite projectile state still follows the closed-form ballistic equation.
 */
export const test_physics_projectile_state_finite = (): void => {
  TestValidator.predicate(
    "nan time throws",
    throws(() => projectileAt(PROJECTILE, Number.NaN)),
  );
  TestValidator.predicate(
    "infinite time throws",
    throws(() => projectileAt(PROJECTILE, Infinity)),
  );
  TestValidator.predicate(
    "non-finite origin throws",
    throws(() =>
      projectileAt(
        { ...PROJECTILE, origin: { ...PROJECTILE.origin, x: Number.NaN } },
        1,
      ),
    ),
  );
  TestValidator.predicate(
    "non-finite velocity throws",
    throws(() =>
      projectileAt(
        { ...PROJECTILE, velocity: { ...PROJECTILE.velocity, y: Infinity } },
        1,
      ),
    ),
  );
  TestValidator.predicate(
    "non-finite gravity throws",
    throws(() =>
      projectileAt(
        { ...PROJECTILE, gravity: { ...PROJECTILE.gravity, z: -Infinity } },
        1,
      ),
    ),
  );

  const state = projectileAt(PROJECTILE, 2);
  TestValidator.predicate(
    "finite position follows closed-form projectile equation",
    nclose(state.position.x, 9) &&
      nclose(state.position.y, -8) &&
      nclose(state.position.z, 19),
  );
  TestValidator.predicate(
    "finite velocity follows closed-form projectile equation",
    nclose(state.velocity.x, 4) &&
      nclose(state.velocity.y, -15) &&
      nclose(state.velocity.z, 10),
  );
};
