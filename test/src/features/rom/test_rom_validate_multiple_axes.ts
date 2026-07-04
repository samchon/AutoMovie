import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

/**
 * Each axis is checked independently, so a single joint with several
 * out-of-range axes produces one violation per axis rather than collapsing into
 * one ??giving the correction loop a precise, per-axis account of what to fix.
 *
 * Scenario: a shoulder driven to 999째 on both flexion and twist yields exactly
 * two violations.
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
    "two bad axes ??two violations",
    collector.items.length,
    2,
  );
};
