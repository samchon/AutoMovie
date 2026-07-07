import { detectBodyCollision } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { staticActor } from "../internal/collision";

/**
 * A `physicsIntent` marker (a choreographed fight, a stylized clash)
 * acknowledges the overlap: the warnings and the suggested response are
 * suppressed so the correction loop does not nag, while the contact events
 * still surface for downstream and render ("one calculation, two consumers").
 *
 * Scenarios:
 *
 * 1. The same overlap that warns without a marker produces no warnings and no
 *    suggested response once `physicsIntent` is set.
 * 2. The contact events are still emitted (they are observational).
 */
export const test_validation_body_collision_intent = (): void => {
  const result = detectBodyCollision({
    a: staticActor({
      node: "A",
      a: { x: 0, y: 0, z: 0 },
      b: { x: 1, y: 0, z: 0 },
      radius: 0.2,
      body: { mass: 2, centerOfMass: null, friction: 0.5, restitution: 0 },
    }),
    b: staticActor({
      node: "B",
      a: { x: 0.5, y: 0.1, z: 0 },
      b: { x: 0.5, y: 0.5, z: 0 },
      radius: 0.2,
    }),
    sampleRate: 1,
    physicsIntent: "choreographed",
  });
  TestValidator.equals(
    "intent still succeeds",
    result.validation.success,
    true,
  );
  TestValidator.equals(
    "intent suppresses warnings",
    result.validation.success === true
      ? (result.validation.warnings?.length ?? 0)
      : -1,
    0,
  );
  TestValidator.equals(
    "intent suppresses the suggestion",
    result.response,
    null,
  );
  TestValidator.equals("events still emitted", result.events.length, 2);
};
