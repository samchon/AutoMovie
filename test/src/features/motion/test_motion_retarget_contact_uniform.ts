import { retargetHumanoidMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose, warningCount } from "../internal/predicates";
import {
  keyframeWorld,
  mapped,
  proportionedRig,
  rootShiftClip,
} from "../internal/retargetRigs";

/**
 * A uniformly scaled target makes the contact-preserving pass a mathematical
 * no-op, which is what lets it default to on without touching any clip that was
 * already exact.
 *
 * Every forward-kinematics position on a rig whose rest offsets are all
 * multiplied by `s` is exactly `s` times its source counterpart, and the root
 * path is scaled by the same `s`, so the mapped contact and the resolved
 * effector coincide to the last bit. The pass measures that drift before
 * solving anything and skips the frame, so the corrected clip is not merely
 * close to the uncorrected one: it is equal.
 *
 * Scenarios:
 *
 * 1. Both feet are in contact on every keyframe of the clip (the whole-clip
 *    contact boundary), so the pass has a pin on each frame and still changes
 *    nothing.
 * 2. The retarget with the pass on returns a clip deep-equal to the same retarget
 *    with `contacts.enabled === false`, and no joint is added to the poses the
 *    source left empty.
 * 3. The run succeeds with zero plausibility warnings, and the target feet sit
 *    exactly on `rootScale` times the source contacts.
 */
export const test_motion_retarget_contact_uniform = (): void => {
  const source = proportionedRig("uniform-source");
  const target = proportionedRig("uniform-target", {
    leg: 2,
    torso: 2,
    arm: 2,
  });
  const motion = rootShiftClip(source.id, { x: 0.4, y: 0, z: 0.25 });

  const pinned = retargetHumanoidMotion({ motion, source, target });
  const carried = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { enabled: false },
  });
  TestValidator.equals("uniform contact retarget succeeds", pinned.validation, {
    success: true,
  });
  if (pinned.motion === null || pinned.characterization === null)
    throw new Error("uniform contact retarget unexpectedly failed");
  if (carried.motion === null) throw new Error("carried retarget failed");

  // 1. every keyframe carries a contact on both feet.
  for (const index of [0, 1] as const)
    for (const slot of ["leftFoot", "rightFoot"] as const)
      TestValidator.predicate(
        `source ${slot} rests on the floor at keyframe ${index}`,
        nclose(keyframeWorld(source, motion, index, slot).y, 0.1),
      );

  // 2. the pass leaves the clip byte-identical to the verbatim copy.
  TestValidator.equals(
    "a uniform scale makes the contact pass a no-op",
    pinned.motion,
    carried.motion,
  );
  TestValidator.equals(
    "no joint is invented on a pose the source left empty",
    pinned.motion.keyframes.map((kf) => kf.pose.joints.length),
    [0, 0],
  );

  // 3. no warning, and the feet sit exactly on the mapped contacts.
  TestValidator.equals(
    "an exact retarget reports no plausibility warning",
    warningCount(pinned.validation),
    0,
  );
  TestValidator.equals(
    "root scale is exactly two",
    pinned.characterization.rootScale,
    2,
  );
  for (const index of [0, 1] as const)
    TestValidator.predicate(
      `left foot sits on the mapped contact at keyframe ${index}`,
      vclose(
        keyframeWorld(target, pinned.motion, index, "leftFoot"),
        mapped(keyframeWorld(source, motion, index, "leftFoot"), 2),
      ),
    );
};
