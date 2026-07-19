import { retargetHumanoidMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, nclose, warningCount } from "../internal/predicates";
import {
  keyframeWorld,
  proportionedRig,
  rootShiftClip,
} from "../internal/retargetRigs";

/**
 * A frame with no contact is retargeted exactly as v1 did, so the pass narrows
 * to the frames a contact actually constrains.
 *
 * Contact is what makes a proportion mismatch visible: a foot on the ground has
 * a world position the audience can see slide, while a foot in the air only has
 * the joint angles the author wrote. Correcting an airborne limb toward a
 * mapped position would overwrite authored intent for no observable gain, so
 * detection gates the correction frame by frame rather than clip by clip.
 *
 * Scenarios:
 *
 * 1. A clip whose second keyframe lifts the root a full unit leaves the feet above
 *    the source rig's floor plus tolerance, so only the grounded first keyframe
 *    is corrected and the airborne one keeps its empty authored pose.
 * 2. Declaring a ground plane far below the rig removes every contact, and the
 *    corrected clip becomes deep-equal to the verbatim angle copy — the
 *    no-contact boundary.
 * 3. A single-keyframe clip is rejected by the clip validator, not by a crash
 *    inside the contact pass, and returns a field-located temporal violation.
 */
export const test_motion_retarget_contact_airborne = (): void => {
  const source = proportionedRig("airborne-source");
  const target = proportionedRig("airborne-target", {
    leg: 1.05,
    torso: 0.98,
  });

  // 1. a jump: grounded first keyframe, airborne second.
  const jump = rootShiftClip(source.id, { x: 0, y: 1, z: 0 });
  TestValidator.predicate(
    "the lifted keyframe leaves the source foot above the floor",
    nclose(keyframeWorld(source, jump, 1, "leftFoot").y, 1.1),
  );

  const jumped = retargetHumanoidMotion({ motion: jump, source, target });
  if (jumped.motion === null) throw new Error("jump retarget failed");
  TestValidator.predicate(
    "the grounded keyframe is corrected",
    jumped.motion.keyframes[0]!.pose.joints.length > 0,
  );
  TestValidator.equals(
    "the airborne keyframe keeps its authored pose",
    jumped.motion.keyframes[1]!.pose.joints,
    [],
  );
  TestValidator.equals(
    "a reachable grounded contact reports no warning",
    warningCount(jumped.validation),
    0,
  );

  // 2. no contact anywhere: identical to carrying the angles verbatim.
  const slide = rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 });
  const ungrounded = retargetHumanoidMotion({
    motion: slide,
    source,
    target,
    contacts: { groundY: -5 },
  });
  const carried = retargetHumanoidMotion({
    motion: slide,
    source,
    target,
    contacts: { enabled: false },
  });
  if (ungrounded.motion === null || carried.motion === null)
    throw new Error("ungrounded retarget failed");
  TestValidator.equals(
    "a clip with no contact is left as the verbatim copy",
    ungrounded.motion,
    carried.motion,
  );
  TestValidator.equals(
    "no contact means nothing to warn about",
    warningCount(ungrounded.validation),
    0,
  );

  // 3. a single-keyframe clip fails validation instead of crashing the pass.
  const lone = retargetHumanoidMotion({
    motion: rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 }, [0]),
    source,
    target,
  });
  TestValidator.equals(
    "a single-keyframe clip returns no motion",
    lone.motion,
    null,
  );
  TestValidator.predicate(
    "the keyframe count is reported as a temporal violation",
    hasViolation(lone.validation, "temporal", "$input.keyframes"),
  );
};
