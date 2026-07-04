import {
  IAutoMovieBallisticSolution,
  solveMovingLaunch,
} from "@automovie/engine";
import { IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const origin: IAutoMovieVector3 = { x: 0, y: 1.6, z: 0 };
const target = (t: number): IAutoMovieVector3 => ({
  x: 6 + 3 * t,
  y: 1,
  z: 0,
});

/**
 * `solveMovingLaunch` uses `iterations` as the fixed-point loop cap. Invalid
 * caps must fail like the solver's other invalid scalar inputs rather than
 * becoming fractional or unbounded loop limits.
 *
 * Scenarios:
 *
 * 1. Non-finite, non-integer, and less-than-one iteration counts return `null`.
 * 2. The valid boundary `iterations = 1` still returns a best-so-far partial
 *    solve.
 */
export const test_physics_moving_launch_iterations = (): void => {
  for (const iterations of [Number.NaN, Infinity, 1.5, 0, -1])
    TestValidator.predicate(
      `iterations ${iterations} returns null`,
      solveMovingLaunch(origin, target, 20, undefined, "direct", iterations) ===
        null,
    );

  const partial: IAutoMovieBallisticSolution | null = solveMovingLaunch(
    origin,
    target,
    20,
    undefined,
    "direct",
    1,
  );
  TestValidator.predicate(
    "one iteration remains a valid partial solve",
    partial !== null && partial.hitTime > 0,
  );
};
