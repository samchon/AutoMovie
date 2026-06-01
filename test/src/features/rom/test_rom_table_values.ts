import { DEFAULT_HUMANOID_ROM } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * The default humanoid ROM table encodes the key anatomical facts: a hinge
 * elbow (flexion only, no hyperextension), a hinge knee (no abduction/twist),
 * and a ball shoulder (all three axes). Pins the values the ROM verifier
 * enforces.
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
