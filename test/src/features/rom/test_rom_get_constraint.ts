import { DEFAULT_HUMANOID_ROM, getConstraint } from "@motica/engine";
import { IMoticaJointConstraint } from "@motica/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * `getConstraint` resolves the effective ROM as: per-bone skeleton override if
 * present, else the default table, else null for a bone with no known limits.
 */
export const test_rom_get_constraint = (): void => {
  const override: IMoticaJointConstraint = {
    flexion: { min: -200, max: 200 },
    abduction: null,
    twist: null,
  };
  TestValidator.equals(
    "override wins",
    getConstraint("leftLowerArm", override),
    override,
  );
  TestValidator.predicate(
    "table fallback",
    getConstraint("leftLowerArm", null) === DEFAULT_HUMANOID_ROM.leftLowerArm,
  );
  TestValidator.equals(
    "unconstrained bone → null",
    getConstraint("hips", null),
    null,
  );
};
