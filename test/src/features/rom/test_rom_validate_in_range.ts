import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

/**
 * Angles inside a joint's range — and the value 0 / null on an immobile axis —
 * produce no ROM violations.
 */
export const test_rom_validate_in_range = (): void => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftLowerArm", { flexion: 90, abduction: 0 }),
    constraint: getConstraint("leftLowerArm", null)!,
    path: "$input",
    collector,
  });
  TestValidator.equals(
    "no violations for a valid elbow",
    collector.items.length,
    0,
  );
};
