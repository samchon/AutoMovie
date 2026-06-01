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
 * Any non-zero angle on an axis the joint physically lacks (an elbow has no
 * abduction) is a ROM violation, while 0 on that axis is fine.
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
