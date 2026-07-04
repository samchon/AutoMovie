import { IAutoMovieBody, resolveImpact } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const v = (x: number, y: number, z: number) => ({ x, y, z });

const BODY: IAutoMovieBody = {
  mass: 1,
  velocity: v(0, 0, 0),
  restitution: 0.2,
  hardness: 0.5,
  penetrability: 0.1,
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
 * `resolveImpact` normalizes the contact normal and returns it as a unit vector
 * in the impact result. Invalid contact normals must fail before normalization
 * can erase a collision direction or propagate non-finite impact data.
 *
 * Scenarios:
 *
 * 1. A zero contact normal throws before it can become a silent deflect.
 * 2. Non-finite contact normals throw before they can produce NaN impact fields.
 */
export const test_physics_impact_contact_normal = (): void => {
  const moving = { ...BODY, velocity: v(0, 0, 10) };

  TestValidator.predicate(
    "zero normal throws",
    throws(() => resolveImpact(moving, BODY, v(0, 0, 0))),
  );
  TestValidator.predicate(
    "nan normal throws",
    throws(() => resolveImpact(moving, BODY, v(Number.NaN, 0, 1))),
  );
  TestValidator.predicate(
    "infinite normal throws",
    throws(() => resolveImpact(moving, BODY, v(Infinity, 0, 1))),
  );
};
