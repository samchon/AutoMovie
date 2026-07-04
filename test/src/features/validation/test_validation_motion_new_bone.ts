import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

/**
 * The angular-speed check compares a bone's angle to its value in the previous
 * keyframe. A bone that first appears in a later keyframe has no prior value,
 * so it is skipped rather than compared against zero (which could spuriously
 * flag a large first pose as "too fast"). Pins the no-previous-value branch.
 *
 * Scenario: a 1s clip whose first keyframe articulates only the elbow, and
 * whose second adds the shoulder at 20° flexion. The shoulder has no previous
 * frame to measure speed against, and the elbow moves slowly, so the clip
 * validates.
 */
export const test_validation_motion_new_bone = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(
        1,
        makePose([
          joint("leftLowerArm", { flexion: 30 }),
          joint("leftUpperArm", { flexion: 20 }),
        ]),
      ),
    ],
    1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals(
    "a newly-introduced bone does not trip the speed check",
    result.success,
    true,
  );
};
