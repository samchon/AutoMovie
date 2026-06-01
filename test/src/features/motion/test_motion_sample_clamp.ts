import { sampleMotion } from "@motica/engine";
import { IMoticaMotion } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { createValidMotion } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const elbow = (m: IMoticaMotion, t: number): number => {
  const j = sampleMotion(m, t).pose.joints.find(
    (x) => x.bone === "leftLowerArm",
  );
  if (j === undefined)
    throw new Error("leftLowerArm missing from sampled pose");
  return j.flexion ?? 0;
};

/**
 * A non-looping clip does not extrapolate beyond its keyframes: sampling before
 * the first returns the first pose, and after the last returns the last. Pins
 * that a clip "holds" at its ends rather than flying off when the playhead runs
 * past it.
 *
 * Scenario (the 0°→120° elbow clip over 1s): sampling at t=−0.5 returns the
 * start (0°) and at t=2 returns the end (120°).
 */
export const test_motion_sample_clamp = (): void => {
  const clip = createValidMotion();
  TestValidator.predicate(
    "before start clamps to first",
    nclose(elbow(clip, -0.5), 0),
  );
  TestValidator.predicate(
    "after end clamps to last",
    nclose(elbow(clip, 2), 120),
  );
};
