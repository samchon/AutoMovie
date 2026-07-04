import {
  IAutoMovieProjectile,
  IAutoMovieSphere,
  projectileSphereHit,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const PROJECTILE: IAutoMovieProjectile = {
  origin: { x: 0, y: 1, z: 0 },
  velocity: { x: 5, y: 0, z: 0 },
  gravity: { x: 0, y: 0, z: 0 },
};

const SPHERE: IAutoMovieSphere = {
  center: { x: 2, y: 1, z: 0 },
  radius: 0.5,
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
 * `projectileSphereHit` samples `[0, tMax]` in `steps` segments. Invalid timing
 * inputs must fail before `dt = tMax / steps` and before the loop bound can
 * skip or run forever.
 *
 * Scenarios:
 *
 * 1. Non-finite/non-positive windows throw before hit sampling starts.
 * 2. Non-finite, non-integer, or less-than-one step counts throw before hit
 *    sampling starts.
 */
export const test_physics_projectile_hit_sampling_timing = (): void => {
  TestValidator.predicate(
    "nan tMax throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, Number.NaN, 10)),
  );
  TestValidator.predicate(
    "infinite tMax throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, Infinity, 10)),
  );
  TestValidator.predicate(
    "zero tMax throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, 0, 10)),
  );
  TestValidator.predicate(
    "nan steps throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, 1, Number.NaN)),
  );
  TestValidator.predicate(
    "infinite steps throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, 1, Infinity)),
  );
  TestValidator.predicate(
    "zero steps throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, 1, 0)),
  );
  TestValidator.predicate(
    "fractional steps throws",
    throws(() => projectileSphereHit(PROJECTILE, SPHERE, 1, 0.5)),
  );
};
