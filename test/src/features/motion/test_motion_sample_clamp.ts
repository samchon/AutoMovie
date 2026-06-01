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
 * For a non-looping clip, sampling before the first keyframe returns the first
 * pose and after the last returns the last (no extrapolation).
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
