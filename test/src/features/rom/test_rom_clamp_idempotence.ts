import { clampPose } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieJointPose,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  createValidPose,
  joint,
  makePose,
} from "../internal/fixtures";
import { makeRng, uniform } from "../internal/random";

const skeleton = createSkeleton();
const ARTICULATED: AutoMovieHumanoidBone[] = [
  "spine",
  "chest",
  "neck",
  "head",
  "leftUpperArm",
  "leftLowerArm",
  "leftUpperLeg",
  "leftLowerLeg",
];

/** A pose whose every articulated joint carries a wildly out-of-ROM angle. */
const wildPose = (rng: () => number): IAutoMovieJointPose[] =>
  ARTICULATED.map((bone) =>
    joint(bone, {
      flexion: uniform(rng, -200, 200),
      abduction: uniform(rng, -200, 200),
      twist: uniform(rng, -200, 200),
    }),
  );

/**
 * ROM clamping must be **idempotent**: clamping an already-clamped pose changes
 * nothing. If it were not, a second validation/clamp pass could drift a pose
 * that the first pass called settled — the fixed point the "clamp then
 * validate" contract assumes. A property sweep over wild random poses (every
 * axis far past its limit) exercises the clamp on every branch, which a few
 * hand poses cannot.
 *
 * Scenarios:
 *
 * 1. Over 200 seeded wild poses, `clampPose(clampPose(p)) === clampPose(p)`
 *    exactly — one clamp reaches the fixed point.
 * 2. Non-vacuity: a wild pose is actually changed by the first clamp, so the
 *    idempotence check is exercising the clamp path, not comparing two no-ops.
 * 3. A pose already inside ROM passes through clamping unchanged.
 */
export const test_rom_clamp_idempotence = (): void => {
  const rng = makeRng(0x7c3f0055);
  for (let i = 0; i < 200; ++i) {
    const pose = makePose(wildPose(rng));
    const once = clampPose(pose, skeleton);
    const twice = clampPose(once, skeleton);
    TestValidator.equals(`clamp is idempotent #${i}`, twice, once);
    TestValidator.notEquals(
      `wild pose is actually clamped #${i}`,
      once.joints,
      pose.joints,
    );
  }

  const valid = createValidPose();
  TestValidator.equals(
    "an in-ROM pose clamps to itself",
    clampPose(valid, skeleton),
    valid,
  );
};
