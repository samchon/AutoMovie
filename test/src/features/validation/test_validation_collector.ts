import { ViolationCollector } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * `ViolationCollector` is the shared sink every validator pushes into, and the
 * bridge to the harness: its `range` helper records a violation only when a
 * value is actually outside its bound, and `toValidation` reports success
 * exactly when nothing was collected. Pins both halves of that contract.
 *
 * Scenarios:
 *
 * 1. An in-range value (0.5 in [0,1]) pushes nothing, and an empty collector
 *    yields a successful validation.
 * 2. An out-of-range value (2 in [0,1]) pushes one violation, and a non-empty
 *    collector yields a failed validation.
 * 3. A non-finite value (`NaN`) pushes one violation; bounded ranges are finite
 *    numeric domains.
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

  const nonFinite = new ViolationCollector();
  nonFinite.range("$input.c", Number.NaN, 0, 1);
  TestValidator.equals("non-finite pushes one", nonFinite.items.length, 1);
  TestValidator.predicate(
    "non-finite range mentions finite",
    nonFinite.items.some(
      (v) => v.path === "$input.c" && v.expected.includes("finite"),
    ),
  );
};
