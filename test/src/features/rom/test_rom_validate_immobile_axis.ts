import {
  ViolationCollector,
  getConstraint,
  validateJointRom,
} from "@motica/engine";
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
 * A joint may simply lack an axis — an elbow does not abduct. Any non-zero
 * angle on such an axis is a ROM violation (the joint physically cannot move
 * that way), while zero on it is fine. Pins the "immobile axis" rejection a
 * plain min/max range check would miss.
 *
 * Scenarios:
 *
 * 1. An elbow given 20° abduction — an axis it does not have — is flagged, on the
 *    abduction axis.
 * 2. The same elbow with 0° abduction produces no violation (zero is the neutral
 *    value, indistinguishable from "not articulated").
 */
export const test_rom_validate_immobile_axis = (): void => {
  const items = romItems({ abduction: 20 });
  TestValidator.equals("immobile-axis motion flagged", items.length, 1);
  TestValidator.predicate(
    "flagged on abduction axis",
    items[0]!.path.endsWith(".abduction"),
  );

  TestValidator.equals(
    "zero on immobile axis is fine",
    romItems({ abduction: 0 }).length,
    0,
  );
};
