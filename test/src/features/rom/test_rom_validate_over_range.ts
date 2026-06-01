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
 * An angle outside a joint's `[min, max]` is flagged on exactly the offending
 * axis — the verifier catching the "physically impossible" poses raw LLM
 * emission produces, which is the heart of motica's differentiator.
 *
 * Scenarios:
 *
 * 1. An elbow at 175° flexion exceeds the 150° maximum: one violation, reported on
 *    the flexion axis.
 * 2. An elbow at −10° flexion falls below the 0° minimum (a hyperextension the
 *    joint cannot do): one violation.
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
