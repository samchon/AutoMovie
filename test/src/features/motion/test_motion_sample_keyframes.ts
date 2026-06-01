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
 * Sampling returns exact poses at keyframe times and linearly interpolates
 * between them. Scenario: elbow flexion 0°→120° over 1s with linear easing.
 */
export const test_motion_sample_keyframes = (): void => {
  const clip = createValidMotion();
  TestValidator.predicate("at t=0 → 0°", nclose(elbow(clip, 0), 0));
  TestValidator.predicate("at t=1 → 120°", nclose(elbow(clip, 1), 120));
  TestValidator.predicate(
    "at t=0.5 → 60° (linear)",
    nclose(elbow(clip, 0.5), 60),
  );
  TestValidator.predicate("at t=0.25 → 30°", nclose(elbow(clip, 0.25), 30));
  TestValidator.equals(
    "sampled pose targets the skeleton",
    sampleMotion(clip, 0.5).pose.skeleton,
    "skeleton-1",
  );
};
