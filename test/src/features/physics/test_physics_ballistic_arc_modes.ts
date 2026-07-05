import { solveBallisticLaunch, solveMovingLaunch } from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const origin: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };
const target: IAutoMovieVector3 = { x: 8, y: 1, z: 0 };
const invalidArc = "flat" as Parameters<typeof solveBallisticLaunch>[4];

/**
 * Ballistic arc mode is a runtime input at the LLM/JS boundary. Unknown modes
 * must fail like the solver's other invalid inputs instead of silently becoming
 * the direct arc.
 *
 * Scenarios:
 *
 * 1. Static launch returns `null` for an unknown arc mode.
 * 2. Moving launch returns `null` for the same bad mode before sampling the target
 *    callback.
 * 3. Valid `direct` and `high` modes still solve.
 */
export const test_physics_ballistic_arc_modes = (): void => {
  TestValidator.predicate(
    "invalid static arc is null",
    solveBallisticLaunch(origin, target, 14, undefined, invalidArc) === null,
  );

  let sampled = false;
  TestValidator.predicate(
    "invalid moving arc is null",
    solveMovingLaunch(
      origin,
      () => {
        sampled = true;
        return target;
      },
      14,
      undefined,
      invalidArc,
    ) === null,
  );
  TestValidator.equals(
    "invalid moving arc skips target sampling",
    sampled,
    false,
  );

  TestValidator.predicate(
    "direct and high remain valid",
    solveBallisticLaunch(origin, target, 14, undefined, "direct") !== null &&
      solveBallisticLaunch(origin, target, 14, undefined, "high") !== null,
  );
};
