import { validateModel } from "@automovie/engine";
import { AutoMoviePrimitiveShape } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Primitive shape discriminants are runtime data once a model crosses a JSON
 * boundary, so model validation must reject unknown variants before checking
 * extents. A forged shape with cylinder-like dimensions is still a `type`
 * violation, not an accepted radius/height primitive.
 *
 * Scenario: a primitive part carries an unknown `torus` shape with positive
 * radius and height. Validation fails with a `type` violation on the shape
 * discriminant.
 */
export const test_validation_model_primitive_shape_type = (): void => {
  const unknownShape = {
    type: "torus",
    radius: 1,
    height: 1,
  } as unknown as AutoMoviePrimitiveShape;
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((part) => ({
      ...part,
      geometry: {
        type: "primitive" as const,
        shape: unknownShape,
      },
    })),
  };

  const result = validateModel({ model });
  TestValidator.equals("unknown primitive shape fails", result.success, false);
  TestValidator.predicate(
    "shape type violation",
    hasViolation(result, "type", ".geometry.shape.type"),
  );
};
