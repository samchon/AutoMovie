import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";

/**
 * A model body is opt-in physics metadata. A well-formed body (positive mass,
 * coefficients in [0,1], a finite explicit center of mass) validates, and a
 * null body (the default, meaning no declared physics) validates too.
 *
 * Scenarios:
 *
 * 1. The default model (body: null) succeeds.
 * 2. A fully-specified valid body with an explicit center of mass succeeds.
 * 3. A valid body may leave centerOfMass null (derive-from-geometry) and the
 *    coefficient bounds are inclusive at 0 and 1.
 */
export const test_validation_model_body_valid = (): void => {
  TestValidator.equals(
    "null body succeeds",
    validateModel({ model: createModel() }).success,
    true,
  );
  TestValidator.equals(
    "valid body with explicit COM succeeds",
    validateModel({
      model: {
        ...createModel(),
        body: {
          mass: 2.5,
          centerOfMass: { x: 0, y: 0.3, z: 0 },
          friction: 0.6,
          restitution: 0.2,
        },
      },
    }).success,
    true,
  );
  TestValidator.equals(
    "valid body with null COM and boundary coefficients succeeds",
    validateModel({
      model: {
        ...createModel(),
        body: { mass: 1, centerOfMass: null, friction: 0, restitution: 1 },
      },
    }).success,
    true,
  );
};
