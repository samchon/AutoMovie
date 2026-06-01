import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

const romPaths = (axes: Parameters<typeof joint>[1]): string[] => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftLowerArm", axes),
    constraint: getConstraint("leftLowerArm", null)!,
    path: "$input",
    collector,
  });
  return collector.items.map((v) => v.path);
};

/**
 * An angle past the max or below the min is flagged on the offending axis.
 * Scenario: elbow flexion 175° (> 150 max) and knee-style extension below 0.
 */
export const test_rom_validate_over_range = (): void => {
  const over = romPaths({ flexion: 175 });
  TestValidator.equals("one violation for 175° flexion", over.length, 1);
  TestValidator.predicate(
    "flagged on flexion axis",
    over[0]!.endsWith(".flexion"),
  );

  const under = romPaths({ flexion: -10 });
  TestValidator.equals("one violation for -10° (below min 0)", under.length, 1);
};
