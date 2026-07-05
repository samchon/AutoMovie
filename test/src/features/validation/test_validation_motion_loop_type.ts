import { validateMotion } from "@automovie/engine";
import { IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * `loop` controls sampler time wrapping, so runtime JSON must keep it boolean.
 * A forged string like `"false"` is truthy in JavaScript and would change
 * playback semantics if validation accepted it.
 */
export const test_validation_motion_loop_type = (): void => {
  const invalid: IAutoMovieMotion = {
    ...createValidMotion(),
    loop: "false" as unknown as boolean,
  };
  const rejected = validateMotion({
    motion: invalid,
    skeleton: createSkeleton(),
  });
  TestValidator.equals("non-boolean loop fails", rejected.success, false);
  TestValidator.predicate(
    "loop type violation",
    hasViolation(rejected, "type", ".loop"),
  );

  const looping = validateMotion({
    motion: { ...createValidMotion(), loop: true },
    skeleton: createSkeleton(),
  });
  TestValidator.equals("boolean true loop passes", looping.success, true);
};
