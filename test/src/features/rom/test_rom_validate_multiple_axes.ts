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
 * one, giving the correction loop a precise, per-axis account of what to fix.
 *
 * Scenario: a shoulder driven to 999° on both flexion and twist files one
 * violation per offending axis. The combined swing cone also fires here, and
 * legitimately so: 999° of flexion composes to 279° of swing, past the
 * shoulder's 180° cone, and a resting abduction axis does not exempt it (#1245:
 * the cone reads a resting axis as the 0 it actually renders). The assertion is
 * on per-axis presence rather than a raw count, so it pins the independence it
 * is about without silently re-encoding the cone's verdict.
 */
export const test_rom_validate_multiple_axes = (): void => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftUpperArm", { flexion: 999, twist: 999 }),
    constraint: getConstraint("leftUpperArm", null)!,
    path: "$input",
    collector,
  });
  const paths = collector.items.map((v) => v.path);
  TestValidator.equals(
    "each bad axis files its own violation, and the swing cone files its own",
    [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    ["$input.flexion", "$input.swing", "$input.twist"],
  );
};
