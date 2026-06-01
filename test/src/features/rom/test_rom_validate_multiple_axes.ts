import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

/**
 * Each offending axis is reported independently — a joint with two out-of-range
 * axes yields two violations.
 */
export const test_rom_validate_multiple_axes = (): void => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftUpperArm", { flexion: 999, twist: 999 }),
    constraint: getConstraint("leftUpperArm", null)!,
    path: "$input",
    collector,
  });
  TestValidator.equals(
    "two bad axes → two violations",
    collector.items.length,
    2,
  );
};
