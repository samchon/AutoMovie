import { IAutoMovieProjectile, projectileAt } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

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
  TestValidator.equals(
    "finite position follows closed-form projectile equation",
    namedFacts([
      ["ncloseStatePosition", () => nclose(state.position.x, 9)],
      ["ncloseStatePosition2", () => nclose(state.position.y, -8)],
      ["ncloseStatePosition3", () => nclose(state.position.z, 19)],
    ]),
    {
      ncloseStatePosition: true,
      ncloseStatePosition2: true,
      ncloseStatePosition3: true,
    },
  );
  TestValidator.equals(
    "finite velocity follows closed-form projectile equation",
    namedFacts([
      ["ncloseStateVelocity", () => nclose(state.velocity.x, 4)],
      ["ncloseStateVelocity2", () => nclose(state.velocity.y, -15)],
      ["ncloseStateVelocity3", () => nclose(state.velocity.z, 10)],
    ]),
    {
      ncloseStateVelocity: true,
      ncloseStateVelocity2: true,
      ncloseStateVelocity3: true,
    },
  );
};
