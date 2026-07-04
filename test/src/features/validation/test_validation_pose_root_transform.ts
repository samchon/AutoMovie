import { validatePoseResult } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, joint, makePose } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const ROOT: IAutoMovieTransform = {
  translation: { x: 0, y: 1, z: 2 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const poseWith = (root: IAutoMovieTransform) =>
  makePose([joint("leftLowerArm", { flexion: 30 })], root);

/**
 * Pose root transforms are renderer/export-facing TRS data. Their numeric
 * components must be finite, and scale must remain positive.
 *
 * Scenarios:
 *
 * 1. A valid root transform still validates.
 * 2. Non-finite translation is a range violation.
 * 3. Non-finite rotation is a range violation.
 * 4. Non-positive scale is a range violation.
 */
export const test_validation_pose_root_transform = (): void => {
  const skeleton = createSkeleton();
  TestValidator.equals(
    "valid root transform succeeds",
    validatePoseResult(poseWith(ROOT), skeleton).success,
    true,
  );

  const badTranslation = validatePoseResult(
    poseWith({
      ...ROOT,
      translation: { ...ROOT.translation, x: Number.NaN },
    }),
    skeleton,
  );
  TestValidator.equals(
    "non-finite root translation fails",
    badTranslation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on root translation",
    hasViolation(badTranslation, "range", "$input.root.translation.x"),
  );

  const badRotation = validatePoseResult(
    poseWith({
      ...ROOT,
      rotation: { ...ROOT.rotation, w: Number.POSITIVE_INFINITY },
    }),
    skeleton,
  );
  TestValidator.equals(
    "non-finite root rotation fails",
    badRotation.success,
    false,
  );
  TestValidator.predicate(
    "range violation on root rotation",
    hasViolation(badRotation, "range", "$input.root.rotation.w"),
  );

  const badScale = validatePoseResult(
    poseWith({
      ...ROOT,
      scale: { ...ROOT.scale, y: 0 },
    }),
    skeleton,
  );
  TestValidator.equals(
    "non-positive root scale fails",
    badScale.success,
    false,
  );
  TestValidator.predicate(
    "range violation on root scale",
    hasViolation(badScale, "range", "$input.root.scale.y"),
  );
};
