import {
  ViolationCollector,
  clampJointRom,
  validateJointRom,
} from "@automovie/engine";
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

const passesCone = (j: ReturnType<typeof joint>): boolean => {
  const collector = new ViolationCollector();
  validateJointRom({ joint: j, constraint: CONE, path: "$input", collector });
  return collector.items.length === 0;
};

/**
 * The clamp face of the swing cone: a corner pose past the cone is pulled
 * straight back onto it (preserving the flexion:abduction ratio), so the result
 * passes {@link validateJointRom}: clamp and validate stay one calculation.
 *
 * Scenarios:
 *
 * 1. 90° + 90° (120° of swing, past the 100° cone) is scaled down equally, the
 *    ratio kept, and the clamped pose now validates clean.
 * 2. A pose already inside the cone is untouched.
 * 3. A resting (`null`) axis contributes the 0 it renders, so it neither exempts
 *    the cone nor becomes non-null: a lone axis inside the cone passes through,
 *    and a lone axis PAST the cone is pulled back exactly like its explicit-`0`
 *    twin (#1245: the old skip left it at its illegal angle).
 * 4. For a box that EXCLUDES neutral, the cone pull targets the box point nearest
 *    neutral rather than neutral itself, so the clamped pose stays inside the
 *    box and validates. Pulling toward the origin dropped it below its own
 *    `min` (#1245). Both directions: `min > 0` and `max < 0`.
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

  // 3. a resting axis stays null and contributes 0: inside the cone it passes
  // through; past the cone it is pulled back like its explicit-0 twin.
  const oneAxis = clampJointRom(joint("leftUpperArm", { abduction: 50 }), CONE);
  TestValidator.equals("rest flexion stays null", oneAxis.flexion, null);
  TestValidator.predicate(
    "lone abduction inside the cone passes through",
    nclose(oneAxis.abduction!, 50),
  );
  const oneAxisF = clampJointRom(joint("leftUpperArm", { flexion: 50 }), CONE);
  TestValidator.equals("rest abduction stays null", oneAxisF.abduction, null);
  TestValidator.predicate(
    "lone flexion inside the cone passes through",
    nclose(oneAxisF.flexion!, 50),
  );
  // 150° of lone flexion is 150° of swing, past the 100° cone.
  const restingPast = clampJointRom(
    joint("leftUpperArm", { flexion: 150 }),
    CONE,
  );
  const zeroPast = clampJointRom(
    joint("leftUpperArm", { flexion: 150, abduction: 0 }),
    CONE,
  );
  TestValidator.predicate(
    "a resting axis does not exempt the clamp: flexion is pulled onto the cone",
    nclose(restingPast.flexion!, 100) && passesCone(restingPast),
  );
  TestValidator.equals(
    "the resting axis stays resting rather than becoming 0",
    restingPast.abduction,
    null,
  );
  TestValidator.predicate(
    "a resting axis clamps identically to its explicit-0 twin",
    nclose(restingPast.flexion!, zeroPast.flexion!),
  );

  // 4. a box that excludes neutral: the pull targets the box point nearest
  // neutral (flexion 10), so the result stays in [10, 90] instead of being
  // dragged to ~2° by a pull toward the origin.
  const OFFSET_CONE: IAutoMovieJointConstraint = {
    flexion: { min: 10, max: 90 },
    abduction: { min: -90, max: 90 },
    twist: null,
    swingDeg: 20,
  };
  const offset = clampJointRom(
    joint("leftUpperArm", { flexion: 10, abduction: 90 }),
    OFFSET_CONE,
  );
  TestValidator.predicate(
    "a neutral-excluding box keeps its own min after the cone pull",
    offset.flexion! >= 10 - 1e-9,
  );
  const offsetItems = new ViolationCollector();
  validateJointRom({
    joint: offset,
    constraint: OFFSET_CONE,
    path: "$input",
    collector: offsetItems,
  });
  TestValidator.equals(
    "the clamped pose validates against its own constraint",
    offsetItems.items.length,
    0,
  );

  // an immobile swung axis (its RANGE is null) anchors at the neutral it is
  // forced to: the cone still applies to what actually renders.
  const HINGE_CONE: IAutoMovieJointConstraint = {
    flexion: { min: -180, max: 180 },
    abduction: null,
    twist: null,
    swingDeg: 100,
  };
  const hinge = clampJointRom(
    joint("leftUpperArm", { flexion: 150, abduction: 30 }),
    HINGE_CONE,
  );
  TestValidator.predicate(
    "an immobile abduction axis is forced to neutral",
    nclose(hinge.abduction!, 0),
  );
  TestValidator.predicate(
    "and the lone flexion is still pulled onto the cone",
    nclose(hinge.flexion!, 100),
  );

  // the max < 0 direction behaves symmetrically
  const NEGATIVE_CONE: IAutoMovieJointConstraint = {
    flexion: { min: -90, max: 90 },
    abduction: { min: -90, max: -10 },
    twist: null,
    swingDeg: 20,
  };
  const negative = clampJointRom(
    joint("leftUpperArm", { flexion: 90, abduction: -10 }),
    NEGATIVE_CONE,
  );
  TestValidator.predicate(
    "a max<0 box keeps its own max after the cone pull",
    negative.abduction! <= -10 + 1e-9,
  );
  const negativeItems = new ViolationCollector();
  validateJointRom({
    joint: negative,
    constraint: NEGATIVE_CONE,
    path: "$input",
    collector: negativeItems,
  });
  TestValidator.equals(
    "the max<0 clamped pose validates too",
    negativeItems.items.length,
    0,
  );
};
