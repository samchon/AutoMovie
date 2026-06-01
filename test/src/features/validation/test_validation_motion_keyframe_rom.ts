import { validateMotion } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Per-keyframe pose validation runs inside motion validation: an impossible
 * elbow angle in a keyframe surfaces as a `rom` violation under that keyframe's
 * path.
 */
export const test_validation_motion_keyframe_rom = (): void => {
  const motion = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 175 })])),
    ],
    1,
  );
  const result = validateMotion({ motion, skeleton: createSkeleton() });
  TestValidator.equals("bad keyframe pose fails", result.success, false);
  TestValidator.predicate(
    "rom violation under a keyframe",
    hasViolation(result, "rom", "keyframes["),
  );
};
