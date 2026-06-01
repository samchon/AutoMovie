import { ViolationCollector } from "@motica/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `ViolationCollector` is the shared violation sink: `range` pushes only when a
 * value is outside the bound, and `toValidation` reports success iff nothing
 * was collected.
 */
export const test_validation_collector = (): void => {
  const empty = new ViolationCollector();
  empty.range("$input.a", 0.5, 0, 1);
  TestValidator.equals("in-range pushes nothing", empty.items.length, 0);
  TestValidator.equals(
    "empty collector → success",
    empty.toValidation().success,
    true,
  );

  const failing = new ViolationCollector();
  failing.range("$input.b", 2, 0, 1);
  TestValidator.equals("out-of-range pushes one", failing.items.length, 1);
  const validation = failing.toValidation();
  TestValidator.equals(
    "non-empty collector → failure",
    validation.success,
    false,
  );
};
