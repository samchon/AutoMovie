import { retargetHumanoidMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { hasWarning, vclose, warningCount } from "../internal/predicates";
import {
  keyframeWorld,
  mapped,
  proportionedRig,
  rootShiftClip,
} from "../internal/retargetRigs";

/** Distance between a resolved effector and the contact it should hold. */
const missBy = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * A contact the target rig cannot physically hold is reported as a warning, not
 * a failure: residual foot slide is implausible, not impossible.
 *
 * The rig pair is the same legs-1.5x / torso-0.9x target as the tracking case,
 * but now under the **default** humanoid ROM, whose hip gamut stops at 120
 * degrees of flexion and -30 of extension. Folding a leg that long under the
 * mapped contact needs more than the gamut allows, so the clamped chain stops
 * short. The retarget still returns a clip: the correction that the ROM did
 * permit is kept, the residual is measured, and the shortfall surfaces as
 * advice the harness can accept or act on.
 *
 * Scenarios:
 *
 * 1. The retarget succeeds (`validation.success` is true and `motion` is
 *    non-null) while carrying one `physics` warning per foot, located on the
 *    keyframe and effector that missed by the most.
 * 2. The residual it warns about is real: the pinned foot still misses its mapped
 *    contact by more than the 0.02 * rootScale contact budget.
 * 3. The clamped correction is still an improvement, not damage: the pinned foot
 *    ends closer to the mapped contact than the verbatim angle copy does.
 * 4. Widening `contacts.tolerance` widens the same budget, so the identical
 *    residual stops being worth reporting and the run comes back clean.
 */
export const test_motion_retarget_contact_unreachable = (): void => {
  const source = proportionedRig("unreachable-source");
  const target = proportionedRig("unreachable-target", {
    leg: 1.5,
    torso: 0.9,
  });
  const motion = rootShiftClip(source.id, { x: 0, y: 0, z: 0.25 });

  // 1. a warning per foot, not a failure.
  const pinned = retargetHumanoidMotion({ motion, source, target });
  if (pinned.motion === null || pinned.characterization === null)
    throw new Error("an unreachable contact must not fail the retarget");
  TestValidator.equals(
    "an unreachable contact still succeeds",
    pinned.validation.success,
    true,
  );
  TestValidator.equals(
    "one plausibility warning per pinned foot",
    warningCount(pinned.validation),
    2,
  );
  for (const slot of ["leftFoot", "rightFoot"] as const)
    TestValidator.predicate(
      `${slot} reports its residual on the keyframe that missed most`,
      hasWarning(
        pinned.validation,
        "physics",
        `$input.motion.keyframes[0].pose.joints["${slot}"]`,
      ),
    );

  // 2. the residual is beyond the contact budget it names.
  const scale = pinned.characterization.rootScale;
  const contact = mapped(keyframeWorld(source, motion, 0, "leftFoot"), scale);
  const residual = missBy(
    keyframeWorld(target, pinned.motion, 0, "leftFoot"),
    contact,
  );
  TestValidator.predicate(
    "the reported residual exceeds the contact budget",
    residual > 0.02 * scale,
  );

  // 3. the clamped correction still beats carrying the angles verbatim.
  const carried = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { enabled: false },
  });
  if (carried.motion === null) throw new Error("carried retarget failed");
  TestValidator.predicate(
    "a ROM-bound correction still closes part of the gap",
    residual <
      missBy(keyframeWorld(target, carried.motion, 0, "leftFoot"), contact),
  );
  TestValidator.predicate(
    "the verbatim copy is the one that misses by more than half a unit",
    vclose(
      keyframeWorld(target, carried.motion, 0, "leftFoot"),
      contact,
      0.5,
    ) === false,
  );

  // 4. a wider contact tolerance widens the budget the residual is judged by.
  const tolerant = retargetHumanoidMotion({
    motion,
    source,
    target,
    contacts: { tolerance: 0.5 },
  });
  if (tolerant.motion === null) throw new Error("tolerant retarget failed");
  TestValidator.equals(
    "a wider contact budget stops reporting the same residual",
    warningCount(tolerant.validation),
    0,
  );
};
