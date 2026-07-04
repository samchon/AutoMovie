import { solveBallisticLaunch, solveMovingLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Ballistic solvers work on world vectors. Non-finite coordinates must reject
 * the solve before vector normalization/range math can emit `NaN` components.
 *
 * Scenario: static and moving launch solvers return `null` for non-finite
 * origin, target, gravity, and moving-target coordinates.
 */
export const test_physics_ballistic_non_finite_vectors = (): void => {
  const origin: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };
  const target: IAutoMovieVector3 = { x: 8, y: 1, z: 0 };
  const gravity: IAutoMovieVector3 = { x: 0, y: -9.81, z: 0 };

  TestValidator.predicate(
    "static origin x nan is null",
    solveBallisticLaunch({ x: Number.NaN, y: 1, z: 0 }, target, 10) === null,
  );
  TestValidator.predicate(
    "static target y infinite is null",
    solveBallisticLaunch(origin, { x: 8, y: Infinity, z: 0 }, 10) === null,
  );
  TestValidator.predicate(
    "static gravity z nan is null",
    solveBallisticLaunch(origin, target, 10, {
      x: 0,
      y: -9.81,
      z: Number.NaN,
    }) === null,
  );

  TestValidator.predicate(
    "moving origin x nan is null",
    solveMovingLaunch({ x: Number.NaN, y: 1, z: 0 }, () => target, 10) === null,
  );
  TestValidator.predicate(
    "moving gravity z nan is null",
    solveMovingLaunch(origin, () => target, 10, {
      x: 0,
      y: -9.81,
      z: Number.NaN,
    }) === null,
  );
  TestValidator.predicate(
    "moving initial target y infinite is null",
    solveMovingLaunch(origin, () => ({ x: 8, y: Infinity, z: 0 }), 10) === null,
  );
  TestValidator.predicate(
    "moving iterated target x nan is null",
    solveMovingLaunch(
      origin,
      (t) => (t === 0 ? target : { x: Number.NaN, y: 1, z: 0 }),
      10,
      gravity,
    ) === null,
  );
};
