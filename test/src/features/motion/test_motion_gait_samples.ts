import { gaitMotion } from "@automovie/engine";
import { IAutoMovieGait } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

const gait: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 30 },
  ],
};

/**
 * `gaitMotion` uses `samples` as both the loop cap and the time denominator.
 * Invalid sample counts must fail as authoring errors instead of producing NaN
 * keyframe times, empty clips, fractional frame counts, or unbounded loops.
 *
 * Scenarios:
 *
 * 1. Non-finite, non-integer, and less-than-one sample counts throw.
 * 2. The valid boundary `samples = 1` emits the opening and closing keyframes.
 */
export const test_motion_gait_samples = (): void => {
  for (const samples of [Number.NaN, 1.5, 0, -1])
    TestValidator.predicate(
      `samples ${samples} throws`,
      throws(() => {
        gaitMotion("invalid", "sk", gait, samples);
      }),
    );

  const boundary = gaitMotion("boundary", "sk", gait, 1);
  TestValidator.equals(
    "one sample emits two keyframes",
    boundary.keyframes.length,
    2,
  );
  TestValidator.predicate(
    "boundary times are finite and span one period",
    nclose(boundary.keyframes[0]!.time, 0) &&
      nclose(boundary.keyframes[1]!.time, 1),
  );
};
