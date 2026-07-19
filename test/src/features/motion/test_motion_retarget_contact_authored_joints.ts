import { retargetHumanoidMotion } from "@automovie/engine";
import { AutoMovieHumanoidBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";
import {
  keyframeWorld,
  mapped,
  posedRootShiftClip,
  proportionedRig,
} from "../internal/retargetRigs";

/** Bones the corrected pose carries, in the order the pass leaves them. */
const bonesOf = (
  joints: readonly { bone: AutoMovieHumanoidBone }[],
): string[] =>
  joints.map((j) => j.bone).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/**
 * The contact correction rewrites only the pinned limb's own two joints,
 * replacing what the clip authored on them and leaving every other authored
 * joint exactly as written.
 *
 * A pose is **sparse** — only bones that leave rest appear — so a correction
 * cannot simply append its result: appending would leave two entries for the
 * same bone, and whichever the FK walk read last would silently win. The pass
 * therefore drops the chain's own entries before adding the solved ones, which
 * is also why an authored knee angle is not blended with the solved one: the
 * contact is the constraint, and the limb that reaches it is derived.
 *
 * The clip here authors a spine bend plus a bent left leg, and a generous
 * contact tolerance keeps the articulated feet inside the contact band so the
 * correction actually runs.
 *
 * Scenarios:
 *
 * 1. The corrected pose names each bone exactly once — the two authored leg joints
 *    are replaced, not duplicated, and both right-leg joints are added.
 * 2. The authored spine joint is carried through untouched, angles and all.
 * 3. The authored left-leg angles are gone: the solved knee differs from the 12
 *    degrees the clip wrote.
 * 4. The point of the rewrite holds — the left foot ends on the mapped source
 *    contact within 0.005, which the authored angles alone missed.
 */
export const test_motion_retarget_contact_authored_joints = (): void => {
  const source = proportionedRig("authored-source");
  const target = proportionedRig("authored-target", {
    leg: 1.05,
    torso: 0.98,
  });
  const motion = posedRootShiftClip(source.id, { x: 0, y: 0, z: 0.2 }, [
    joint("spine", { flexion: 5 }),
    joint("leftUpperLeg", { flexion: 8 }),
    joint("leftLowerLeg", { flexion: 12 }),
  ]);

  const pinned = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { tolerance: 0.5 },
  });
  TestValidator.equals("authored-joint retarget succeeds", pinned.validation, {
    success: true,
  });
  if (pinned.motion === null || pinned.characterization === null)
    throw new Error("authored-joint retarget unexpectedly failed");

  const joints = pinned.motion.keyframes[0]!.pose.joints;

  // 1. every bone appears exactly once.
  TestValidator.equals(
    "the correction replaces the authored leg joints instead of duplicating them",
    bonesOf(joints),
    ["leftLowerLeg", "leftUpperLeg", "rightLowerLeg", "rightUpperLeg", "spine"],
  );

  // 2. an unrelated authored joint survives verbatim.
  TestValidator.equals(
    "the authored spine bend is carried through",
    joints.find((j) => j.bone === "spine"),
    joint("spine", { flexion: 5 }),
  );

  // 3. the pinned limb's authored angles are superseded.
  const knee = joints.find((j) => j.bone === "leftLowerLeg")!;
  TestValidator.predicate(
    "the solved knee is not the authored 12 degrees",
    knee.flexion !== null && nclose(knee.flexion, 12, 1e-3) === false,
  );

  // 4. and the foot lands on the mapped source contact.
  TestValidator.predicate(
    "the rewritten leg holds the mapped contact",
    vclose(
      keyframeWorld(target, pinned.motion, 0, "leftFoot"),
      mapped(
        keyframeWorld(source, motion, 0, "leftFoot"),
        pinned.characterization.rootScale,
      ),
      5e-3,
    ),
  );
};
