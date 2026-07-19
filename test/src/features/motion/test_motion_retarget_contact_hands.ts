import {
  IAutoMovieRetargetHandContact,
  retargetHumanoidMotion,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { vclose, warningCount } from "../internal/predicates";
import {
  keyframeWorld,
  mapped,
  proportionedRig,
  rootShiftClip,
  withoutBones,
} from "../internal/retargetRigs";

const LEFT_ARM: Omit<IAutoMovieRetargetHandContact, "start" | "end"> = {
  hand: "leftHand",
  upper: "leftUpperArm",
  lower: "leftLowerArm",
};

/**
 * A hand contact is preserved only where the caller declares it, because a hand
 * has no ground to be judged against.
 *
 * A foot's contact is inferable — it is the effector sitting on the ground
 * plane. A hand resting on a table, braced on a wall, or gripping a partner is
 * geometrically indistinguishable from a hand in the air, so inferring one
 * would be a guess. The retarget therefore pins a hand only across a declared
 * window, and leaves every other frame's arm exactly as authored.
 *
 * The target rig differs from the source only in arm length (1.3x), so the leg
 * contacts stay proportional and every observed change is the arm's.
 *
 * Scenarios:
 *
 * 1. Without a declaration, the 1.3x arm carries its angles verbatim and the left
 *    hand misses the mapped source contact by the full rest-length difference —
 *    0.2177, the hand-derived distance between (0.923, 1.645, 0) and (0.71,
 *    1.6, 0).
 * 2. Declaring the left-arm chain over the whole clip pins the hand back onto the
 *    mapped source contact within 0.005, on both keyframes, with no
 *    plausibility warning.
 * 3. A window that falls between the authored keyframe times pins nothing, so the
 *    clip is deep-equal to the undeclared retarget — the window bounds are
 *    inclusive tests against real keyframe times, not a hint.
 * 4. A declaration naming bones the target rig does not have is skipped rather
 *    than half-solved, and the retarget still succeeds.
 */
export const test_motion_retarget_contact_hands = (): void => {
  const source = proportionedRig("hand-source");
  const target = proportionedRig("long-arm-target", { arm: 1.3 });
  const motion = rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 });

  // 1. undeclared: the arm keeps its angles and the hand lands elsewhere.
  const undeclared = retargetHumanoidMotion({ motion, source, target });
  if (undeclared.motion === null || undeclared.characterization === null)
    throw new Error("undeclared hand retarget unexpectedly failed");
  TestValidator.equals(
    "an arm-only proportion change leaves the root scale at one",
    undeclared.characterization.rootScale,
    1,
  );
  TestValidator.predicate(
    "the longer forearm puts the hand at its own rest position",
    vclose(keyframeWorld(target, undeclared.motion, 0, "leftHand"), {
      x: 0.923,
      y: 1.645,
      z: 0,
    }),
  );
  TestValidator.predicate(
    "an undeclared hand contact is not preserved",
    vclose(
      keyframeWorld(target, undeclared.motion, 0, "leftHand"),
      keyframeWorld(source, motion, 0, "leftHand"),
      0.2,
    ) === false,
  );

  // 2. declared over the whole clip: the hand holds the mapped contact.
  const declared = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { hands: [{ ...LEFT_ARM, start: 0, end: 1 }] },
  });
  TestValidator.equals("declared hand retarget succeeds", declared.validation, {
    success: true,
  });
  if (declared.motion === null) throw new Error("declared retarget failed");
  for (const index of [0, 1] as const)
    TestValidator.predicate(
      `the declared hand holds its contact on keyframe ${index}`,
      vclose(
        keyframeWorld(target, declared.motion, index, "leftHand"),
        mapped(keyframeWorld(source, motion, index, "leftHand"), 1),
        5e-3,
      ),
    );
  TestValidator.equals(
    "a reachable hand contact reports no warning",
    warningCount(declared.validation),
    0,
  );

  // 3. a window between the keyframes pins nothing.
  const between = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { hands: [{ ...LEFT_ARM, start: 0.4, end: 0.6 }] },
  });
  if (between.motion === null) throw new Error("windowed retarget failed");
  TestValidator.equals(
    "a window covering no keyframe leaves the clip untouched",
    between.motion,
    undeclared.motion,
  );

  // 4. a declaration the target rig cannot resolve is skipped.
  const armless = withoutBones(target, [
    "rightUpperArm",
    "rightLowerArm",
    "rightHand",
  ]);
  const skipped = retargetHumanoidMotion({
    motion,
    source,
    target: armless,
    contacts: {
      hands: [
        {
          hand: "rightHand",
          upper: "rightUpperArm",
          lower: "rightLowerArm",
          start: 0,
          end: 1,
        },
      ],
    },
  });
  TestValidator.equals(
    "a declaration naming absent bones still succeeds",
    skipped.validation,
    { success: true },
  );
  if (skipped.motion === null) throw new Error("skipped retarget failed");
  TestValidator.equals(
    "the unresolvable chain contributes no correction",
    skipped.motion.keyframes.map((kf) => kf.pose.joints.length),
    [0, 0],
  );
};
