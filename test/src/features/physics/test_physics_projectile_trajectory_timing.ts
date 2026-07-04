import { IAutoMovieProjectile, projectileTrajectory } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const PROJECTILE: IAutoMovieProjectile = {
  origin: { x: 0, y: 1, z: 0 },
  velocity: { x: 5, y: 8, z: 0 },
  gravity: { x: 0, y: -9.81, z: 0 },
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
 * `projectileTrajectory` derives its key count from `duration * fps`. Invalid
 * timing scalars must fail before that multiplication can produce `NaN` counts
 * or unbounded sampling.
 *
 * Scenario: non-finite/non-positive duration and frame rate values all throw
 * before trajectory sampling starts.
 */
export const test_physics_projectile_trajectory_timing = (): void => {
  TestValidator.predicate(
    "nan duration throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, Number.NaN, 30)),
  );
  TestValidator.predicate(
    "infinite duration throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, Infinity, 30)),
  );
  TestValidator.predicate(
    "zero duration throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, 0, 30)),
  );
  TestValidator.predicate(
    "nan fps throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, 1, Number.NaN)),
  );
  TestValidator.predicate(
    "infinite fps throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, 1, Infinity)),
  );
  TestValidator.predicate(
    "zero fps throws",
    throws(() => projectileTrajectory("arrow", PROJECTILE, 1, 0)),
  );
};
