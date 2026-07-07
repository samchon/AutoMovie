import { detectBodyCollision } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { staticActor } from "../internal/collision";
import { vclose } from "../internal/predicates";

const warningCount = (r: ReturnType<typeof detectBodyCollision>): number =>
  r.validation.success === true ? (r.validation.warnings?.length ?? 0) : -1;

/**
 * Inter-body collision is advisory (D010): overlapping capsules produce
 * warning-severity feedback that still succeeds, plus contact events and a
 * suggested response — never a hard rejection. Bodies that stay apart produce
 * nothing.
 *
 * Scenarios:
 *
 * 1. Two actors whose capsules overlap by 0.3m produce a warning per sampled
 *    frame, one contact event per frame, and a non-null suggested response; the
 *    envelope still succeeds (a warning does not fail).
 * 2. Contact events name the two actors and are `contact`/`sampledProximity`.
 * 3. A static collision transfers no momentum, so the suggested impulse is zero.
 * 4. Bodies held far apart produce no warnings, events, or response.
 */
export const test_validation_body_collision = (): void => {
  const hit = detectBodyCollision({
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
    gainDegPerImpulse: 5,
  });
  TestValidator.equals("overlap still succeeds", hit.validation.success, true);
  TestValidator.equals("one warning per sampled frame", warningCount(hit), 2);
  TestValidator.equals("one contact event per frame", hit.events.length, 2);
  TestValidator.equals("event is a contact", hit.events[0]?.kind, "contact");
  TestValidator.equals("event names actor A", hit.events[0]?.actor, "A");
  TestValidator.equals("event names target B", hit.events[0]?.target, "B");
  TestValidator.predicate("response suggested", hit.response !== null);
  TestValidator.predicate(
    "static collision transfers no impulse",
    hit.response !== null &&
      vclose(hit.response.impact.impulse, { x: 0, y: 0, z: 0 }),
  );

  const apart = detectBodyCollision({
    a: staticActor({
      node: "A",
      a: { x: 0, y: 0, z: 0 },
      b: { x: 1, y: 0, z: 0 },
      radius: 0.2,
    }),
    b: staticActor({
      node: "B",
      a: { x: 0.5, y: 5, z: 0 },
      b: { x: 0.5, y: 5.5, z: 0 },
      radius: 0.2,
    }),
  });
  TestValidator.equals("apart succeeds", apart.validation.success, true);
  TestValidator.equals("apart has no warnings", warningCount(apart), 0);
  TestValidator.equals("apart has no events", apart.events.length, 0);
  TestValidator.equals("apart has no response", apart.response, null);
};
