import { validateModel } from "@automovie/engine";
import { IAutoMovieGeometry } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Model part geometry discriminants are runtime data once a model crosses a
 * JSON boundary, so validation must reject unknown variants instead of skipping
 * both the primitive and mesh paths.
 *
 * Scenario: a primitive part is forged into an unknown `spline` geometry.
 * Validation fails with a `type` violation on the geometry discriminator.
 */
export const test_validation_model_geometry_type = (): void => {
  const unknownGeometry = {
    type: "spline",
  } as unknown as IAutoMovieGeometry;
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((part) => ({
      ...part,
      geometry: unknownGeometry,
    })),
  };

  const result = validateModel({ model });
  TestValidator.equals("unknown geometry fails", result.success, false);
  TestValidator.predicate(
    "geometry type violation",
    hasViolation(result, "type", ".geometry.type"),
  );
};
