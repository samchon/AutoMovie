import {
  ViolationCollector,
  clampJointRom,
  validateJointRom,
} from "@autofilm/engine";
import { IAutoFilmJointConstraint } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { joint } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** A ball-joint constraint: axes wide open, only the combined swing capped. */
const CONE: IAutoFilmJointConstraint = {
  flexion: { min: -180, max: 180 },
  abduction: { min: -180, max: 180 },
  twist: null,
  swingDeg: 100,
};

const passesCone = (j: ReturnType<typeof joint>): boolean => {
  const collector = new ViolationCollector();
  validateJointRom({ joint: j, constraint: CONE, path: "$input", collector });
  return collector.items.length === 0;
};

/**
 * The clamp face of the swing cone: a corner pose past the cone is pulled
 * straight back onto it (preserving the flexion:abduction ratio), so the result
 * passes {@link validateJointRom} — clamp and validate stay one calculation.
 *
 * Scenarios:
 *
 * 1. 90° + 90° (120° of swing, past the 100° cone) is scaled down equally, the
 *    ratio kept, and the clamped pose now validates clean.
 * 2. A pose already inside the cone is untouched.
 * 3. With one axis at rest (`null`) the cone is skipped — the other axis passes
 *    through its per-axis clamp unchanged.
 */
export const test_rom_clamp_swing_cone = (): void => {
  // 1. past the cone → scaled back onto it, ratio preserved, now valid
  const before = joint("leftUpperArm", { flexion: 90, abduction: 90 });
  TestValidator.predicate(
    "corner pose is over the cone first",
    !passesCone(before),
  );
  const clamped = clampJointRom(before, CONE);
  TestValidator.predicate(
    "flexion was pulled in (below 90)",
    clamped.flexion! < 90,
  );
  TestValidator.predicate(
    "the 1:1 swing direction is preserved",
    nclose(clamped.flexion!, clamped.abduction!),
  );
  TestValidator.predicate(
    "clamped corner pose now validates",
    passesCone(clamped),
  );

  // 2. already inside → untouched
  const inside = joint("leftUpperArm", { flexion: 30, abduction: 30 });
  const keptSame = clampJointRom(inside, CONE);
  TestValidator.predicate(
    "inside-cone flexion is unchanged",
    nclose(keptSame.flexion!, 30),
  );
  TestValidator.predicate(
    "inside-cone abduction is unchanged",
    nclose(keptSame.abduction!, 30),
  );

  // 3. one axis at rest → cone skipped, other axis passes through
  const oneAxis = clampJointRom(joint("leftUpperArm", { abduction: 50 }), CONE);
  TestValidator.equals("rest flexion stays null", oneAxis.flexion, null);
  TestValidator.predicate(
    "lone abduction passes through",
    nclose(oneAxis.abduction!, 50),
  );
  const oneAxisF = clampJointRom(joint("leftUpperArm", { flexion: 50 }), CONE);
  TestValidator.equals("rest abduction stays null", oneAxisF.abduction, null);
  TestValidator.predicate(
    "lone flexion passes through",
    nclose(oneAxisF.flexion!, 50),
  );
};
