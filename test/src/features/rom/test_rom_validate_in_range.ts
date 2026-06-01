import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

/**
 * A joint articulated within its anatomical range produces no violations. This
 * is the "valid pose passes cleanly" baseline for the ROM verifier — as
 * important as the failure cases, since a verifier that flagged everything
 * would be useless.
 *
 * Scenario: an elbow at 90° flexion (inside [0, 150]) with 0 on its immobile
 * abduction axis yields an empty violation list.
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
