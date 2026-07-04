import { DEFAULT_HUMANOID_ROM } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * The default humanoid ROM table is where automovie's core differentiator lives
 * — it encodes the anatomical limits the pose verifier checks every joint
 * against. This pins the key joint archetypes so a regression in the table is
 * caught immediately.
 *
 * Scenarios:
 *
 * 1. The elbow is a hinge: flexion [0, 150]° (no hyperextension below 0), and no
 *    abduction axis at all.
 * 2. The knee is a hinge too: no hyperextension (flexion min 0), and neither an
 *    abduction nor a twist axis.
 * 3. The shoulder is a ball joint: it has an abduction axis (unlike the hinges).
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

  TestValidator.predicate(
    "shoulder is a ball joint",
    DEFAULT_HUMANOID_ROM.leftUpperArm!.abduction !== null,
  );
};
