import { blendPoses, validateMotion } from "@automovie/engine";
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
 * The blend never clamps: a weighted result outside a joint's ROM stays out of
 * range, so `validateMotion` reports it — the model must reweigh or reposition,
 * the engine does not hide it (D007). This proves the additive path passes an
 * out-of-ROM value straight through to validation rather than silently pulling
 * it into gamut.
 *
 * Scenarios:
 *
 * 1. Two layers whose blended elbow flexion (300°) exceeds the joint's range
 *    produce a motion that fails validation with a `rom` violation on the
 *    flexion axis — the blend did not clamp it.
 * 2. A blend well inside ROM validates cleanly (the negative twin).
 */
export const test_perform_blend_rom = (): void => {
  const overshot = blendPoses([
    { pose: makePose([joint("leftLowerArm", { flexion: 300 })]), weight: 1 },
    { pose: makePose([joint("leftLowerArm", { flexion: 300 })]), weight: 1 },
  ]);
  const badMotion = makeMotion(
    [keyframe(0, overshot), keyframe(1, overshot)],
    1,
  );
  const bad = validateMotion({ motion: badMotion, skeleton: createSkeleton() });
  TestValidator.equals("out-of-ROM blend fails validation", bad.success, false);
  TestValidator.predicate(
    "rom violation on the blended flexion axis",
    hasViolation(bad, "rom", ".flexion"),
  );

  const inRange = blendPoses([
    { pose: makePose([joint("leftLowerArm", { flexion: 40 })]), weight: 1 },
    { pose: makePose([joint("leftLowerArm", { flexion: 80 })]), weight: 1 },
  ]);
  const goodMotion = makeMotion(
    [keyframe(0, inRange), keyframe(1, inRange)],
    1,
  );
  TestValidator.equals(
    "in-range blend validates",
    validateMotion({ motion: goodMotion, skeleton: createSkeleton() }).success,
    true,
  );
};
