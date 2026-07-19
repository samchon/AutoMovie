import { retargetHumanoidMotion } from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, vclose } from "../internal/predicates";
import {
  keyframeWorld,
  mapped,
  proportionedRig,
  rootShiftClip,
  withJointConstraint,
} from "../internal/retargetRigs";

/** A hip gamut wide enough to fold a 1.5x leg under the mapped contact. */
const WIDE_HIP: IAutoMovieJointConstraint = {
  flexion: { min: -150, max: 150 },
  abduction: { min: -90, max: 90 },
  twist: { min: -90, max: 90 },
  swingDeg: 180,
};

/**
 * The contact-preserving retarget holds a planted foot on the source contact
 * mapped through `rootScale`, even when the target rig's limb proportions
 * differ from the source's.
 *
 * This is the property v1 could not deliver: copying clinical angles verbatim
 * is exact only for a proportional rig, so a target with relatively longer legs
 * planted its feet somewhere else entirely and the performance skated. The rig
 * pair here is the brief's own case — legs 1.5x, torso 0.9x — with the target
 * declaring its own hip gamut, which is exactly the
 * `target-override-then-default-humanoid` ROM precedence the retarget names.
 *
 * Scenarios:
 *
 * 1. The source rest pose is the hand-checkable oracle every other number is
 *    derived from: the left ankle sits at (0.1, 0.1, 0.1), and the root shift
 *    carries it to (0.1, 0.1, 0.35) on the second keyframe.
 * 2. Retargeted onto a legs-1.5x / torso-0.9x rig with the pass on, both feet land
 *    within 0.005 of `rootScale` times those source contacts on both keyframes,
 *    and the run reports no plausibility warning.
 * 3. The negative twin: the same retarget with `contacts.enabled === false`
 *    reproduces the v1 slide — the left foot misses its mapped contact by more
 *    than 0.5, the hand-derived distance between the target's own rest ankle
 *    and the mapped contact.
 * 4. The characterization names which policy ran, and the corrected clip keeps the
 *    authored keyframe count and times rather than re-keying onto a clock.
 */
export const test_motion_retarget_contact_proportions = (): void => {
  const source = proportionedRig("contact-source");
  const target = withJointConstraint(
    proportionedRig("leggy-target", { leg: 1.5, torso: 0.9 }),
    ["leftUpperLeg", "rightUpperLeg"],
    WIDE_HIP,
  );
  const motion = rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 });

  // 1. the source contacts, straight off the rest offsets.
  TestValidator.predicate(
    "source left ankle rests on the rig floor",
    vclose(keyframeWorld(source, motion, 0, "leftFoot"), {
      x: 0.1,
      y: 0.1,
      z: 0.1,
    }),
  );
  TestValidator.predicate(
    "source left ankle travels with the root",
    vclose(keyframeWorld(source, motion, 1, "leftFoot"), {
      x: 0.1,
      y: 0.1,
      z: 0.35,
    }),
  );

  // 2. the pass holds both feet on the mapped contacts.
  const pinned = retargetHumanoidMotion({ motion, source, target });
  TestValidator.equals("contact retarget succeeds", pinned.validation, {
    success: true,
  });
  if (pinned.motion === null || pinned.characterization === null)
    throw new Error("contact retarget unexpectedly failed");

  const scale = pinned.characterization.rootScale;
  TestValidator.predicate(
    "root scale is target height 2.025 over source height 1.65",
    nclose(scale, 2.025 / 1.65, 1e-12),
  );
  for (const slot of ["leftFoot", "rightFoot"] as const)
    for (const index of [0, 1] as const)
      TestValidator.predicate(
        `${slot} holds the mapped contact on keyframe ${index}`,
        vclose(
          keyframeWorld(target, pinned.motion, index, slot),
          mapped(keyframeWorld(source, motion, index, slot), scale),
          5e-3,
        ),
      );

  // 3. the negative twin: the pass off reproduces the v1 slide.
  const carried = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { enabled: false },
  });
  if (carried.motion === null || carried.characterization === null)
    throw new Error("carried retarget unexpectedly failed");
  for (const index of [0, 1] as const)
    TestValidator.predicate(
      `carrying angles verbatim slides the left foot on keyframe ${index}`,
      vclose(
        keyframeWorld(target, carried.motion, index, "leftFoot"),
        mapped(keyframeWorld(source, motion, index, "leftFoot"), scale),
        0.5,
      ) === false,
    );

  // 4. the policy is recorded and the keyframes are untouched.
  TestValidator.equals(
    "pinning is the default contact policy",
    pinned.characterization.contactPolicy,
    "pin-source-contacts",
  );
  TestValidator.equals(
    "disabling the pass records the v1 policy",
    carried.characterization.contactPolicy,
    "carry-joint-angles",
  );
  TestValidator.equals(
    "the corrected clip keeps the authored keyframe times",
    pinned.motion.keyframes.map((kf) => kf.time),
    [0, 1],
  );
};
