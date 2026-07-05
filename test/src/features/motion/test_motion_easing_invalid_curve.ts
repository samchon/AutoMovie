import { ease } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * Runtime callers can bypass the TypeScript `AutoMovieEasing` union, so the
 * engine boundary must reject unknown curve names instead of leaking an
 * undefined eased progress into interpolation.
 *
 * Scenario: a forged easing name throws before returning an eased value.
 */
export const test_motion_easing_invalid_curve = (): void => {
  TestValidator.predicate(
    "unknown easing curve rejects",
    throws(() => {
      ease("elastic" as never, 0.5);
    }),
  );
};
