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
 * `resolveImpact` computes impulse with reciprocal body masses. Invalid masses
 * must fail before `1 / mass` can produce `Infinity`, `NaN`, or impossible
 * momentum transfer.
 *
 * Scenarios:
 *
 * 1. Body `a` rejects zero, negative, and non-finite masses before impulse math.
 * 2. Body `b` rejects the same invalid masses before impulse math.
 */
export const test_physics_impact_body_mass = (): void => {
  const moving = { ...BODY, velocity: v(0, 0, 10) };
  const normal = v(0, 0, 1);

  for (const mass of [0, -1, Number.NaN, Infinity]) {
    TestValidator.predicate(
      `body a mass ${mass} throws`,
      throws(() => resolveImpact({ ...moving, mass }, BODY, normal)),
    );
    TestValidator.predicate(
      `body b mass ${mass} throws`,
      throws(() => resolveImpact(moving, { ...BODY, mass }, normal)),
    );
  }
};
