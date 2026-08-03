import { detectFreeFall } from "@automovie/engine";
import { IAutoMovieBody } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { validationHasNoWarnings } from "../internal/predicates";

const BODY: IAutoMovieBody = {
  mass: 1,
  centerOfMass: null,
  friction: 0.5,
  restitution: 0.5,
};
const COM = { x: 0, y: 5, z: 0 };

/**
 * The gravity expectation is suppressed by anything that would hold a body up
 * or that the author opts out of: an unheld body is a fall candidate only when
 * none of these apply.
 *
 * Scenarios:
 *
 * 1. A `body: null` object (no declared physics) never falls.
 * 2. An attached / driven body does not fall (something holds it).
 * 3. A body already on a falling trajectory is not re-warned.
 * 4. A `physicsIntent` marker (defies-gravity) suppresses the warning and the
 *    suggested arc, while the fall event still surfaces for downstream.
 */
export const test_validation_free_fall_suppressed = (): void => {
  const noBody = detectFreeFall({
    node: "ghost",
    body: null,
    centerOfMass: COM,
    support: [],
    attached: false,
    falling: false,
  });
  TestValidator.predicate(
    "null body never falls",
    validationHasNoWarnings("bodyless free fall", noBody.validation),
  );
  TestValidator.equals("null body has no event", noBody.events.length, 0);

  const attached = detectFreeFall({
    node: "sword",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: true,
    falling: false,
  });
  TestValidator.predicate(
    "attached body never falls",
    validationHasNoWarnings("attached free fall", attached.validation),
  );
  TestValidator.equals("attached body has no arc", attached.trajectory, null);

  const falling = detectFreeFall({
    node: "crate",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: false,
    falling: true,
  });
  TestValidator.predicate(
    "already-falling not re-warned",
    validationHasNoWarnings("active free fall", falling.validation),
  );

  const levitating = detectFreeFall({
    node: "orb",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: false,
    falling: false,
    physicsIntent: "defies-gravity",
  });
  TestValidator.predicate(
    "intent suppresses the warning",
    validationHasNoWarnings("defies-gravity free fall", levitating.validation),
  );
  TestValidator.equals(
    "intent still surfaces the event",
    levitating.events.length,
    1,
  );
  TestValidator.equals(
    "intent suppresses the arc",
    levitating.trajectory,
    null,
  );
};
