import { tessellate } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Primitive tessellation is a runtime geometry boundary. Unknown primitive
 * names must fail at the switch instead of returning an undefined tessellation
 * or surfacing later as an unrelated mesh property access.
 *
 * Scenario: a forged primitive shape type throws a clear tessellation error.
 */
export const test_geometry_tessellate_shape_type = (): void => {
  TestValidator.predicate(
    "unknown primitive shape rejects",
    throwsError(
      () => tessellate({ type: "torus" } as never),
      ["unknown primitive shape", "torus"],
    ),
  );
};
