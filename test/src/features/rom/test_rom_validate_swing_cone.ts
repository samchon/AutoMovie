import { ViolationCollector, validateJointRom } from "@automovie/engine";
import { IAutoMovieJointConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** A ball-joint constraint: axes wide open, only the combined swing capped. */
const CONE: IAutoMovieJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: { min: -180, max: 180 },
  twist: null,
  swingDeg: 100,
};

const coneItems = (axes: Parameters<typeof joint>[1]) => {
  const collector = new ViolationCollector();
  validateJointRom({
    joint: joint("leftUpperArm", axes),
    constraint: CONE,
    path: "$input",
    collector,
  });
  return collector.items;
};

/**
 * The **swing cone** catches the corner a per-axis `[min,max]` box
 * over-permits: a ball joint may flex 90° _or_ abduct 90°, but not both at
 * once. With the per-axis ranges wide open, only the combined swing is judged.
 *
 * Scenarios:
 *
 * 1. 90° flexion + 90° abduction → 120° of combined swing, past the 100° cone: one
 *    violation on the `.swing` path, overshoot 20°.
 * 2. 30° + 30° → ~42° swing, well inside the cone: no violation.
 * 3. The cone is skipped when either axis is at rest (`null`) — a single-axis
 *    motion is already bounded by its own per-axis range.
 */
export const test_rom_validate_swing_cone = (): void => {
  // 1. past the cone
  const over = coneItems({ flexion: 90, abduction: 90 });
  TestValidator.equals("corner pose flagged once", over.length, 1);
  TestValidator.predicate(
    "flagged on the swing path",
    over[0]!.path.endsWith(".swing"),
  );
  TestValidator.predicate(
    "overshoot is degrees past the cone (120 − 100)",
    nclose(over[0]!.overshoot!, 20),
  );

  // 2. inside the cone
  TestValidator.equals(
    "modest combined swing is fine",
    coneItems({ flexion: 30, abduction: 30 }).length,
    0,
  );

  // 3. single-axis (the other at rest) → cone skipped
  TestValidator.equals(
    "null flexion skips the cone",
    coneItems({ abduction: 50 }).length,
    0,
  );
  TestValidator.equals(
    "null abduction skips the cone",
    coneItems({ flexion: 50 }).length,
    0,
  );
};
