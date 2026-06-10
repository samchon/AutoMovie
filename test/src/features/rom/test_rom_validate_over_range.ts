import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";

const romItems = (axes: Parameters<typeof joint>[1]) => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftLowerArm", axes),
    constraint: getConstraint("leftLowerArm", null)!,
    path: "$input",
    collector,
  });
  return collector.items;
};

/**
 * An angle outside a joint's `[min, max]` is flagged on exactly the offending
 * axis — the verifier catching the "physically impossible" poses raw LLM
 * emission produces, which is the heart of autofilm's differentiator.
 *
 * Scenarios:
 *
 * 1. An elbow at 175° flexion exceeds the 150° maximum: one violation, reported on
 *    the flexion axis.
 * 2. An elbow at −10° flexion falls below the 0° minimum (a hyperextension the
 *    joint cannot do): one violation.
 */
export const test_rom_validate_over_range = (): void => {
  const over = romItems({ flexion: 175 });
  TestValidator.equals("one violation for 175° flexion", over.length, 1);
  TestValidator.predicate(
    "flagged on flexion axis",
    over[0]!.path.endsWith(".flexion"),
  );
  TestValidator.equals(
    "overshoot is degrees past the max (175 − 150)",
    over[0]!.overshoot,
    25,
  );

  const under = romItems({ flexion: -10 });
  TestValidator.equals("one violation for -10° (below min 0)", under.length, 1);
  TestValidator.equals(
    "overshoot is degrees below the min (0 − (−10))",
    under[0]!.overshoot,
    10,
  );
};
