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

const gait = (period: number): IAutoMovieGait => ({
  name: "walk",
  period,
  limbs: [
    { bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 },
    { bone: "rightUpperLeg", phase: 0.5, duty: 0.5, amplitude: 30 },
  ],
});

/**
 * `gaitMotion` uses `period` as both the clip duration and the denominator for
 * limb/root-bob phase math. Invalid periods must fail as authoring errors
 * instead of producing non-finite, zero-duration, or negative-time clips.
 *
 * Scenarios:
 *
 * 1. Non-finite and non-positive periods throw before synthesis.
 * 2. A small positive period remains valid and controls the emitted duration.
 */
export const test_motion_gait_period = (): void => {
  for (const period of [Number.NaN, Infinity, 0, -1])
    TestValidator.predicate(
      `period ${period} throws`,
      throws(() => {
        gaitMotion("invalid", "sk", gait(period), 1);
      }),
    );

  const short = gaitMotion("short", "sk", gait(0.25), 1);
  TestValidator.predicate(
    "positive period is preserved",
    nclose(short.duration, 0.25) &&
      nclose(short.keyframes[0]!.time, 0) &&
      nclose(short.keyframes[1]!.time, 0.25),
  );
};
