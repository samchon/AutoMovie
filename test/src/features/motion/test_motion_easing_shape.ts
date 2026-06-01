import { ease } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

/**
 * The curves have the expected shape: linear is the identity, easeInOut is
 * symmetric at 0.5 and monotonic, easeIn lags / easeOut leads early, and step
 * holds at 0 until the very end.
 */
export const test_motion_easing_shape = (): void => {
  TestValidator.predicate(
    "linear is identity",
    nclose(ease("linear", 0.37), 0.37),
  );
  TestValidator.predicate(
    "easeInOut symmetric midpoint",
    nclose(ease("easeInOut", 0.5), 0.5),
  );
  TestValidator.predicate("easeIn lags early", ease("easeIn", 0.25) < 0.25);
  TestValidator.predicate("easeOut leads early", ease("easeOut", 0.25) > 0.25);
  TestValidator.predicate("step before end", nclose(ease("step", 0.99), 0));
  TestValidator.predicate("step at end", nclose(ease("step", 1), 1));

  let prev = -1;
  let monotonic = true;
  for (let i = 0; i <= 10; ++i) {
    const v = ease("easeInOut", i / 10);
    if (v < prev) monotonic = false;
    prev = v;
  }
  TestValidator.predicate("easeInOut is monotonic", monotonic);
};
