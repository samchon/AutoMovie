import { detectSupportToppling } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  hasViolation,
  nclose,
  vclose,
  violationCount,
} from "../internal/predicates";

const v = (x: number, z: number) => ({ x, y: 0, z });
const square = [v(0, 0), v(2, 0), v(2, 2), v(0, 2)];

/**
 * `detectSupportToppling` judges whether an object's center of mass stays over
 * its support footprint. Overhang is advisory (a film may be unphysical, D010):
 * it warns (never errors on the physics), suggests the tip edge and fall
 * direction, and emits a fall event. A `physicsIntent` marker suppresses the
 * warning and suggestion but keeps the event.
 *
 * Scenarios:
 *
 * 1. A centered COM is stable — success, no event, no suggestion.
 * 2. A COM overhanging past x=2 by 1m warns (not errors), with overshoot =
 *    distance − margin, a +x fall direction, a fall event, and the x=2 tip
 *    edge.
 * 3. A `physicsIntent` marker suppresses the warning and suggestion but still
 *    surfaces the event.
 * 4. An omitted node leaves the event actor null.
 * 5. A COM exactly on the hull edge is stable (distance 0 ≤ margin).
 * 6. Empty support is a type error; a negative margin is a range error.
 */
export const test_validation_support_topple = (): void => {
  const stable = detectSupportToppling({
    node: "crate",
    centerOfMass: v(1, 1),
    support: square,
  });
  TestValidator.equals(
    "centered COM is stable",
    stable.validation.success,
    true,
  );
  TestValidator.equals("stable emits no event", stable.events.length, 0);
  TestValidator.equals("stable suggests no topple", stable.toppling, null);

  const topple = detectSupportToppling({
    node: "crate",
    centerOfMass: v(3, 1),
    support: square,
  });
  TestValidator.equals(
    "overhang is a warning, not an error",
    topple.validation.success,
    true,
  );
  TestValidator.predicate(
    "one topple warning surfaced",
    topple.validation.success === true &&
      (topple.validation.warnings?.length ?? 0) === 1,
  );
  TestValidator.predicate(
    "overshoot = distance - margin",
    nclose(topple.toppling!.overshoot, 1 - 0.02),
  );
  TestValidator.predicate(
    "falls toward +x",
    vclose(topple.toppling!.fallDirection, v(1, 0)),
  );
  TestValidator.equals("emits one fall event", topple.events.length, 1);
  TestValidator.equals("event kind is fall", topple.events[0]!.kind, "fall");
  TestValidator.predicate(
    "tip edge lies on x=2",
    nclose(topple.toppling!.tipEdgeStart.x, 2) &&
      nclose(topple.toppling!.tipEdgeEnd.x, 2),
  );

  const intended = detectSupportToppling({
    centerOfMass: v(3, 1),
    support: square,
    physicsIntent: "levitates",
  });
  TestValidator.equals(
    "intent suppresses the warning",
    violationCount(intended.validation),
    0,
  );
  TestValidator.equals(
    "intent still surfaces the event",
    intended.events.length,
    1,
  );
  TestValidator.equals("intent suggests no topple", intended.toppling, null);
  TestValidator.equals(
    "anonymous event actor is null",
    intended.events[0]!.actor,
    null,
  );

  const onEdge = detectSupportToppling({
    centerOfMass: v(2, 1),
    support: square,
  });
  TestValidator.equals(
    "COM on the hull edge is stable",
    onEdge.validation.success,
    true,
  );

  TestValidator.predicate(
    "empty support is a type error",
    hasViolation(
      detectSupportToppling({ centerOfMass: v(0, 0), support: [] }).validation,
      "type",
      ".support",
    ),
  );
  TestValidator.predicate(
    "negative margin is a range error",
    hasViolation(
      detectSupportToppling({
        centerOfMass: v(0, 0),
        support: square,
        margin: -1,
      }).validation,
      "range",
      ".margin",
    ),
  );
};
