import { IAutoMovieImpactBody, resolveImpact } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const v = (x: number, y: number, z: number) => ({ x, y, z });

const BODY: IAutoMovieImpactBody = {
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
 * Impact velocity vectors feed the relative-velocity dot product, closing
 * speed, impulse, and post-impact velocities. A non-finite body velocity must
 * fail before that response math can emit non-finite impact results.
 *
 * Scenarios:
 *
 * 1. Non-finite velocity components on either body throw before impact math.
 * 2. Finite body velocities keep the existing inelastic impulse behavior.
 */
export const test_physics_impact_body_velocity = (): void => {
  const moving: IAutoMovieImpactBody = { ...BODY, velocity: v(0, 0, 10) };
  const normal = v(0, 0, 1);

  TestValidator.predicate(
    "body a non-finite velocity throws",
    throws(() =>
      resolveImpact(
        { ...moving, velocity: v(Number.NaN, 0, 10) },
        BODY,
        normal,
      ),
    ),
  );
  TestValidator.predicate(
    "body b non-finite velocity throws",
    throws(() =>
      resolveImpact(moving, { ...BODY, velocity: v(0, Infinity, 0) }, normal),
    ),
  );

  const impact = resolveImpact(moving, BODY, normal);
  TestValidator.predicate(
    "finite closing speed remains 10",
    nclose(impact.speed, 10),
  );
  TestValidator.predicate(
    "finite impulse remains 5",
    nclose(impact.impulse.z, 5),
  );
  TestValidator.predicate(
    "finite post-impact velocities remain inelastic",
    nclose(impact.velocityA.z, 5) && nclose(impact.velocityB.z, 5),
  );
};
