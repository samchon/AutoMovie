import { DEFAULT_HUMANOID_ROM, swingConeAngle } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The default humanoid ROM table is where automovie's core differentiator lives:
 * it encodes the anatomical limits the pose verifier checks every joint
 * against. This pins the key joint archetypes so a regression in the table is
 * caught immediately.
 *
 * Scenarios:
 *
 * 1. The elbow is a hinge: flexion [0, 150]° (no hyperextension below 0), and no
 *    abduction axis at all.
 * 2. The knee is a hinge too: no hyperextension (flexion min 0), and neither an
 *    abduction nor a twist axis.
 * 3. The shoulder is a ball joint: it has an abduction axis (unlike the hinges)
 *    and a sourced 180째 swing cone.
 * 4. The hip is a smaller ball joint: pure 120째 flexion remains legal, while the
 *    max-flexion + max-abduction corner is now outside its 120째 cone.
 */
export const test_rom_table_values = (): void => {
  const elbow = DEFAULT_HUMANOID_ROM.leftLowerArm!;
  TestValidator.equals("elbow flexion min", elbow.flexion!.min, 0);
  TestValidator.equals("elbow flexion max", elbow.flexion!.max, 150);
  TestValidator.equals("elbow does not abduct", elbow.abduction, null);

  const knee = DEFAULT_HUMANOID_ROM.leftLowerLeg!;
  TestValidator.equals("knee no hyperextension", knee.flexion!.min, 0);
  TestValidator.equals("knee no abduction", knee.abduction, null);
  TestValidator.equals("knee no twist", knee.twist, null);

  const shoulder = DEFAULT_HUMANOID_ROM.leftUpperArm!;
  TestValidator.predicate(
    "shoulder is a ball joint",
    shoulder.abduction !== null,
  );
  TestValidator.equals("left shoulder swing cone", shoulder.swingDeg, 180);
  TestValidator.equals(
    "right shoulder swing cone",
    DEFAULT_HUMANOID_ROM.rightUpperArm!.swingDeg,
    180,
  );
  // the shoulder cone is deliberate HEADROOM (#1058, decision 310): the swing
  // metric caps at 180°, so even the per-axis-maximal corner never exceeds
  // it: a live cap would reject the canonical pure-plane overhead pose,
  // whose swing is already exactly 180
  TestValidator.predicate(
    "the shoulder cone is headroom: the maximal corner never trips it",
    swingConeAngle(shoulder.flexion!.max, shoulder.abduction!.max) <=
      shoulder.swingDeg! &&
      nclose(swingConeAngle(shoulder.flexion!.max, 0), 180),
  );

  const hip = DEFAULT_HUMANOID_ROM.leftUpperLeg!;
  TestValidator.equals("left hip swing cone", hip.swingDeg, 120);
  TestValidator.equals(
    "right hip swing cone",
    DEFAULT_HUMANOID_ROM.rightUpperLeg!.swingDeg,
    120,
  );
  TestValidator.predicate(
    "pure hip flexion reaches the cone",
    nclose(swingConeAngle(hip.flexion!.max, 0), hip.swingDeg!),
  );
  TestValidator.predicate(
    "hip max flexion+abduction corner is outside the cone",
    swingConeAngle(hip.flexion!.max, hip.abduction!.max) > hip.swingDeg!,
  );
};
