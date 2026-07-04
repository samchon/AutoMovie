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
 * `resolveImpact` material heuristics interpret restitution, hardness, and
 * penetrability as `[0,1]` coefficients. Invalid coefficients must fail before
 * comparisons can silently steer an impact into the wrong qualitative kind.
 *
 * Scenarios:
 *
 * 1. Body `a` rejects invalid material coefficients.
 * 2. Body `b` rejects invalid material coefficients.
 */
export const test_physics_impact_material_coefficients = (): void => {
  const moving = { ...BODY, velocity: v(0, 0, 10) };
  const normal = v(0, 0, 1);
  const fields = ["restitution", "hardness", "penetrability"] as const;

  for (const field of fields)
    for (const value of [-0.1, 1.1, Number.NaN, Infinity]) {
      TestValidator.predicate(
        `body a ${field} ${value} throws`,
        throws(() =>
          resolveImpact({ ...moving, [field]: value }, BODY, normal),
        ),
      );
      TestValidator.predicate(
        `body b ${field} ${value} throws`,
        throws(() =>
          resolveImpact(moving, { ...BODY, [field]: value }, normal),
        ),
      );
    }
};
