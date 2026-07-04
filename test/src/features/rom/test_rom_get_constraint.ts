import { DEFAULT_HUMANOID_ROM, getConstraint } from "@automovie/engine";
import { IautomovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * `getConstraint` resolves the _effective_ range of motion for a bone by
 * layering three sources in priority order. This is what lets a stylized or
 * non-human rig loosen the anatomical defaults per bone while still falling
 * back to them everywhere else.
 *
 * Scenarios:
 *
 * 1. A per-bone skeleton override wins outright over the default table.
 * 2. With no override, the default humanoid table entry is returned (the elbow's
 *    own entry, checked by identity).
 * 3. A bone with neither an override nor a table entry (the hips) resolves to null
 *    ??unconstrained.
 */
export const test_rom_get_constraint = (): void => {
  const override: IautomovieJointConstraint = {
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
    "unconstrained bone ??null",
    getConstraint("hips", null),
    null,
  );
};
