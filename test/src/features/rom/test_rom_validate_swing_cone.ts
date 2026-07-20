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
 * 3. A resting (`null`) axis does NOT exempt the cone (#1245): the cone is a
 *    COUPLING between the two axes, so a resting axis contributes its actual
 *    rotation, 0 (exactly as `jointToQuaternion` reads it). A single-axis pose
 *    inside the cone passes, and one past the cone is flagged identically to
 *    its `0` twin, which renders the same quaternion. The old skip let
 *    `{flexion:150, abduction:null}` through while `{flexion:150, abduction:0}`
 *    was flagged.
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

  // 3. a resting axis contributes 0 to the cone, it does not exempt it.
  // Inside the cone: swingConeAngle(0, 50) = 50 <= 100 → clean.
  TestValidator.equals(
    "a single-axis pose inside the cone passes with the other axis at rest",
    coneItems({ abduction: 50 }).length,
    0,
  );
  TestValidator.equals(
    "and symmetrically with flexion alone",
    coneItems({ flexion: 50 }).length,
    0,
  );
  // Past the cone: swingConeAngle(150, 0) = 150 > 100 → flagged, and a resting
  // axis must read identically to an explicit 0 (the same rendered rotation).
  const restingPastCone = coneItems({ flexion: 150 });
  const zeroPastCone = coneItems({ flexion: 150, abduction: 0 });
  TestValidator.equals(
    "a resting axis does not exempt a pose past the cone",
    restingPastCone.length,
    1,
  );
  TestValidator.equals(
    "a resting axis and an explicit 0 give the identical cone verdict",
    restingPastCone.map((v) => [v.path, v.overshoot]),
    zeroPastCone.map((v) => [v.path, v.overshoot]),
  );
};
