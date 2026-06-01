import { sampleMotion } from "@motica/engine";
import { IMoticaMotion } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
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
 * A looping clip wraps the sample time modulo its duration, so playback repeats
 * seamlessly instead of clamping at the end. Pins that the playhead folds back
 * into [0, duration).
 *
 * Scenario (the 0°→120° elbow clip, 1s, looping): t=1.5 wraps to 0.5 → 60°, and
 * t=2.25 wraps to 0.25 → 30°.
 */
export const test_motion_sample_loop = (): void => {
  const looped = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
    true,
  );
  TestValidator.predicate(
    "1.5 wraps to 0.5 → 60°",
    nclose(elbow(looped, 1.5), 60),
  );
  TestValidator.predicate(
    "2.25 wraps to 0.25 → 30°",
    nclose(elbow(looped, 2.25), 30),
  );
};
