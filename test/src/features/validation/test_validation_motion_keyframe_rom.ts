import { validateMotion } from "@automovie/engine";
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
 * Motion validation folds full pose validation into each keyframe, so an
 * anatomically impossible pose buried in a clip is caught and reported under
 * that keyframe's path, not just at the clip level. Pins that the ROM verifier
 * reaches inside motion.
 *
 * Scenario: a clip whose second keyframe bends the elbow to 175° fails, with a
 * `rom` violation under the `keyframes[...]` path.
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
