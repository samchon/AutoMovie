import { bodyCenterOfMass } from "@automovie/engine";
import { IAutoMovieBody } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeProp, primitivePart } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const box = primitivePart("b", { type: "box", width: 1, height: 1, depth: 1 });
const body = (
  centerOfMass: IAutoMovieBody["centerOfMass"],
): IAutoMovieBody => ({
  mass: 1,
  centerOfMass,
  friction: 0.5,
  restitution: 0.5,
});

/**
 * `bodyCenterOfMass` is the single COM entry point support/balance uses: an
 * explicit body center of mass wins over geometry (a weighted base), otherwise
 * it derives one from the primitives, and it is null when neither exists.
 *
 * Scenarios:
 *
 * 1. An explicit body.centerOfMass is returned as-is (overrides geometry).
 * 2. A body with a null centerOfMass derives from geometry (a unit box at the
 *    origin → the origin).
 * 3. No body at all also derives from geometry.
 * 4. No body and no primitive volume (a plane) → null.
 */
export const test_physics_body_center_of_mass = (): void => {
  TestValidator.predicate(
    "explicit body COM wins",
    vclose(bodyCenterOfMass(makeProp([box], body({ x: 0.5, y: 0, z: 0 })))!, {
      x: 0.5,
      y: 0,
      z: 0,
    }),
  );
  TestValidator.predicate(
    "null body COM derives from geometry",
    vclose(bodyCenterOfMass(makeProp([box], body(null)))!, {
      x: 0,
      y: 0,
      z: 0,
    }),
  );
  TestValidator.predicate(
    "no body derives from geometry",
    vclose(bodyCenterOfMass(makeProp([box]))!, { x: 0, y: 0, z: 0 }),
  );
  TestValidator.equals(
    "no body and no volume is null",
    bodyCenterOfMass(
      makeProp([primitivePart("p", { type: "plane", width: 1, depth: 1 })]),
    ),
    null,
  );
};
