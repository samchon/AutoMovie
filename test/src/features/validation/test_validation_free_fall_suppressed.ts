import { detectFreeFall } from "@automovie/engine";
import { IAutoMovieBody } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const BODY: IAutoMovieBody = {
  mass: 1,
  centerOfMass: null,
  friction: 0.5,
  restitution: 0.5,
};
const COM = { x: 0, y: 5, z: 0 };

const warnCount = (r: ReturnType<typeof detectFreeFall>) =>
  r.validation.success === true ? (r.validation.warnings ?? []).length : -1;

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
  TestValidator.equals("null body never falls", warnCount(noBody), 0);
  TestValidator.equals("null body has no event", noBody.events.length, 0);

  const attached = detectFreeFall({
    node: "sword",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: true,
    falling: false,
  });
  TestValidator.equals("attached body never falls", warnCount(attached), 0);
  TestValidator.equals("attached body has no arc", attached.trajectory, null);

  const falling = detectFreeFall({
    node: "crate",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: false,
    falling: true,
  });
  TestValidator.equals("already-falling not re-warned", warnCount(falling), 0);

  const levitating = detectFreeFall({
    node: "orb",
    body: BODY,
    centerOfMass: COM,
    support: [],
    attached: false,
    falling: false,
    physicsIntent: "defies-gravity",
  });
  TestValidator.equals(
    "intent suppresses the warning",
    warnCount(levitating),
    0,
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
