import { validateMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * A motion clip id is the stable key scenes and exporters cite. Blank ids are
 * syntactically strings, but they are not usable stable references.
 *
 * Scenario: an otherwise valid clip with a whitespace-only id fails at
 * `$input.id`.
 */
export const test_validation_motion_nonempty_id = (): void => {
  const result = validateMotion({
    motion: { ...createValidMotion(), id: " " },
    skeleton: createSkeleton(),
  });

  TestValidator.equals("blank motion id fails", result.success, false);
  TestValidator.predicate(
    "type violation on motion id",
    hasViolation(result, "type", "$input.id"),
  );
};
