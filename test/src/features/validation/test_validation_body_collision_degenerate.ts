import { detectBodyCollision } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { staticActor } from "../internal/collision";

/**
 * When two capsules touch exactly at a shared point the closest pair coincides
 * and a contact normal cannot be derived from it, so the check falls back to a
 * default normal rather than crashing `resolveImpact` on a zero vector. The
 * overlap is still reported and a response is still suggested.
 *
 * Scenario: actor A's capsule starts where actor B's capsule starts, so the
 * closest points coincide; the check still succeeds with a warning and a
 * non-null response built on the fallback normal.
 */
export const test_validation_body_collision_degenerate = (): void => {
  const result = detectBodyCollision({
    a: staticActor({
      node: "A",
      a: { x: 0, y: 0, z: 0 },
      b: { x: 1, y: 0, z: 0 },
      radius: 0.2,
    }),
    b: staticActor({
      node: "B",
      a: { x: 0, y: 0, z: 0 },
      b: { x: 0, y: 0, z: 1 },
      radius: 0.2,
    }),
    sampleRate: 1,
  });
  TestValidator.equals(
    "coincident contact still succeeds",
    result.validation.success,
    true,
  );
  TestValidator.equals(
    "coincident contact warns",
    result.validation.success === true
      ? (result.validation.warnings?.length ?? 0) > 0
      : false,
    true,
  );
  TestValidator.predicate(
    "response built on the fallback normal",
    result.response !== null,
  );
};
