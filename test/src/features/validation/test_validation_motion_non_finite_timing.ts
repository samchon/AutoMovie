import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const pose = (flexion: number) =>
  makePose([joint("leftLowerArm", { flexion })]);

const validate = (duration: number, times: number[]) =>
  validateMotion({
    motion: makeMotion(
      times.map((time, i) => keyframe(time, pose(i * 10))),
      duration,
    ),
    skeleton: createSkeleton(),
  });

/**
 * Pins finite temporal gates in motion validation before ordering and angular
 * speed math consume the values.
 *
 * Scenarios:
 *
 * 1. `duration: Infinity` yields a temporal violation on `$input.duration`.
 * 2. `duration: 0` yields a temporal violation on `$input.duration`.
 * 3. `keyframes[i].time: NaN` yields a temporal violation on that keyframe time.
 */
export const test_validation_motion_non_finite_timing = (): void => {
  const infiniteDuration = validate(Number.POSITIVE_INFINITY, [0, 1]);
  TestValidator.equals(
    "infinite motion duration fails",
    infiniteDuration.success,
    false,
  );
  TestValidator.predicate(
    "infinite duration rejected",
    infiniteDuration.success === false &&
      hasViolation(infiniteDuration, "temporal", "$input.duration"),
  );

  const zeroDuration = validate(0, [0, 1]);
  TestValidator.equals(
    "zero motion duration fails",
    zeroDuration.success,
    false,
  );
  TestValidator.predicate(
    "zero duration rejected at duration",
    zeroDuration.success === false &&
      hasViolation(zeroDuration, "temporal", "$input.duration"),
  );

  const nanTime = validate(1, [0, Number.NaN]);
  TestValidator.equals(
    "non-finite keyframe time fails",
    nanTime.success,
    false,
  );
  TestValidator.predicate(
    "non-finite keyframe time rejected",
    nanTime.success === false &&
      hasViolation(nanTime, "temporal", "$input.keyframes[1].time"),
  );
};
