import { sampleMotion } from "@automovie/engine";
import { IautomovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createValidMotion } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const elbow = (m: IautomovieMotion, t: number): number => {
  const j = sampleMotion(m, t).pose.joints.find(
    (x) => x.bone === "leftLowerArm",
  );
  if (j === undefined)
    throw new Error("leftLowerArm missing from sampled pose");
  return j.flexion ?? 0;
};

/**
 * Sampling is the bridge from sparse keyframes to per-frame state: it returns
 * each keyframe's pose exactly at that keyframe's time and interpolates between
 * them per the segment's easing. With linear easing the blend is a straight
 * line.
 *
 * Scenario (elbow flexion 0째??20째 over 1s, linear easing): t=0 ??0째, t=1 ?? * 120째, t=0.5 ??60째, t=0.25 ??30째; and the sampled pose carries the clip's
 * target skeleton id so it can be applied to the right rig.
 */
export const test_motion_sample_keyframes = (): void => {
  const clip = createValidMotion();
  TestValidator.predicate("at t=0 ??0째", nclose(elbow(clip, 0), 0));
  TestValidator.predicate("at t=1 ??120째", nclose(elbow(clip, 1), 120));
  TestValidator.predicate(
    "at t=0.5 ??60째 (linear)",
    nclose(elbow(clip, 0.5), 60),
  );
  TestValidator.predicate("at t=0.25 ??30째", nclose(elbow(clip, 0.25), 30));
  TestValidator.equals(
    "sampled pose targets the skeleton",
    sampleMotion(clip, 0.5).pose.skeleton,
    "skeleton-1",
  );
};
