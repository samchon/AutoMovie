import { retargetHumanoidMotion } from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasWarning, warningCount } from "../internal/predicates";
import {
  LEG_BONES,
  proportionedRig,
  rootShiftClip,
  withJointConstraint,
  withZeroLengthBones,
  withoutBones,
} from "../internal/retargetRigs";

/** A joint that cannot move on any clinical axis. */
const IMMOBILE: IAutoMovieJointConstraint = {
  flexion: null,
  abduction: null,
  twist: null,
};

/**
 * A rig the contact pass cannot solve keeps its authored angles and reports the
 * residual, rather than emitting a half-solved limb or failing the retarget.
 *
 * Three ways a solve can come to nothing are covered together because they must
 * all end the same way: the clip still comes back, the authored joints are
 * still what they were, and any real shortfall is still visible as advice. A
 * correction is only accepted when it measurably beats leaving the limb alone,
 * so a chain that cannot be improved is left alone by construction.
 *
 * Scenarios:
 *
 * 1. A target rig with no legs offers no chain to pin, so the pass returns the
 *    verbatim copy untouched and reports nothing.
 * 2. A target whose thigh segments collapse to zero length makes the two-bone
 *    solve degenerate; the joints stay empty and the residual is warned about.
 * 3. A target whose leg joints declare every axis immobile clamps each candidate
 *    straight back to rest, so no candidate beats the uncorrected limb and the
 *    authored pose is kept — with the residual still reported.
 */
export const test_motion_retarget_contact_degenerate = (): void => {
  const source = proportionedRig("degenerate-source");
  const motion = rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 });
  const proportions = { leg: 1.05, torso: 0.98 };

  const carried = retargetHumanoidMotion({
    motion,
    source,
    target: proportionedRig("degenerate-target", proportions),
    contacts: { enabled: false },
  });
  if (carried.motion === null) throw new Error("carried retarget failed");

  // 1. no legs at all: nothing to pin.
  const legless = retargetHumanoidMotion({
    motion,
    source,
    target: withoutBones(
      proportionedRig("legless-target", proportions),
      LEG_BONES,
    ),
  });
  TestValidator.equals("a legless target still retargets", legless.validation, {
    success: true,
  });
  if (legless.motion === null) throw new Error("legless retarget failed");
  TestValidator.equals(
    "a legless target leaves every pose untouched",
    legless.motion.keyframes.map((kf) => kf.pose.joints),
    [[], []],
  );

  // 2. zero-length thighs: the two-bone solve is degenerate.
  const collapsed = retargetHumanoidMotion({
    motion,
    source,
    target: withZeroLengthBones(
      proportionedRig("collapsed-target", proportions),
      ["leftLowerLeg", "rightLowerLeg"],
    ),
  });
  if (collapsed.motion === null) throw new Error("collapsed retarget failed");
  TestValidator.equals(
    "a degenerate chain leaves the authored joints alone",
    collapsed.motion.keyframes.map((kf) => kf.pose.joints),
    [[], []],
  );
  TestValidator.predicate(
    "a degenerate chain still reports its residual",
    hasWarning(
      collapsed.validation,
      "physics",
      '$input.motion.keyframes[0].pose.joints["leftFoot"]',
    ),
  );

  // 3. immobile leg joints: every candidate clamps back to rest.
  const frozen = retargetHumanoidMotion({
    motion,
    source,
    target: withJointConstraint(
      proportionedRig("frozen-target", proportions),
      ["leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg"],
      IMMOBILE,
    ),
  });
  if (frozen.motion === null) throw new Error("frozen retarget failed");
  TestValidator.equals(
    "an unimprovable correction is not applied",
    frozen.motion.keyframes.map((kf) => kf.pose.joints),
    [[], []],
  );
  TestValidator.equals(
    "both frozen feet report their residual",
    warningCount(frozen.validation),
    2,
  );
  TestValidator.equals(
    "the frozen clip equals the verbatim copy in every keyframe pose",
    frozen.motion.keyframes.map((kf) => kf.pose.root),
    carried.motion.keyframes.map((kf) => kf.pose.root),
  );
};
