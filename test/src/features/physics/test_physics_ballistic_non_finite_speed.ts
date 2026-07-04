import { solveBallisticLaunch, solveMovingLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Ballistic speed is a physical magnitude. Non-finite values must behave like
 * invalid speeds and return `null` before the solver can emit `NaN` velocity or
 * hit-time components.
 *
 * Scenario: static and moving launch solvers reject `NaN` and infinities.
 */
export const test_physics_ballistic_non_finite_speed = (): void => {
  const origin: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };
  const target: IAutoMovieVector3 = { x: 8, y: 1, z: 0 };

  for (const speed of [Number.NaN, Infinity, -Infinity]) {
    TestValidator.predicate(
      `static ${String(speed)} speed is null`,
      solveBallisticLaunch(origin, target, speed) === null,
    );
    TestValidator.predicate(
      `moving ${String(speed)} speed is null`,
      solveMovingLaunch(origin, () => target, speed) === null,
    );
  }
};
