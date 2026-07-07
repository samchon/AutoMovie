import { detectFreeFall } from "@automovie/engine";
import { IAutoMovieBody } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const BODY: IAutoMovieBody = {
  mass: 1,
  centerOfMass: null,
  friction: 0.5,
  restitution: 0.5,
};
const FOOTPRINT = [
  { x: -1, y: 0, z: -1 },
  { x: 1, y: 0, z: -1 },
  { x: 1, y: 0, z: 1 },
  { x: -1, y: 0, z: 1 },
];

const warnings = (r: ReturnType<typeof detectFreeFall>) =>
  r.validation.success === true ? (r.validation.warnings ?? []) : [];

/**
 * The default physical expectation is that an unheld body falls. A bodied
 * object that is unsupported, unattached, and not already falling earns a
 * warning-level gravity feedback plus a suggested fall arc; a supported one
 * earns nothing.
 *
 * Scenarios:
 *
 * 1. No support contacts at all → warning + a fall event + a suggested arc.
 * 2. Support contacts present but the COM projects outside their hull → still
 *    unsupported → warning, exercising the no-node message and default arc
 *    node.
 * 3. The COM projects inside the support footprint → supported → no warning, no
 *    arc.
 * 4. Arc oracle: the suggested trajectory's height after t seconds is origin.y +
 *    ½·g·t² (free fall from rest).
 */
export const test_validation_free_fall = (): void => {
  const unheld = detectFreeFall({
    node: "crate",
    body: BODY,
    centerOfMass: { x: 0, y: 5, z: 0 },
    support: [],
    attached: false,
    falling: false,
  });
  TestValidator.equals(
    "unsupported succeeds warning-only",
    unheld.validation.success,
    true,
  );
  TestValidator.equals("one fall event", unheld.events.length, 1);
  TestValidator.equals("fall event kind", unheld.events[0]!.kind, "fall");
  TestValidator.predicate("suggested arc present", unheld.trajectory !== null);
  TestValidator.predicate(
    "gravity warning on the right path",
    warnings(unheld).some(
      (w) => w.kind === "physics" && w.path.includes(".gravity"),
    ),
  );

  const outside = detectFreeFall({
    body: BODY,
    centerOfMass: { x: 5, y: 5, z: 5 },
    support: FOOTPRINT,
    attached: false,
    falling: false,
  });
  TestValidator.equals(
    "COM outside footprint warns",
    warnings(outside).length,
    1,
  );
  TestValidator.predicate(
    "no-node arc uses the default node",
    outside.trajectory !== null && outside.trajectory.id.includes("object"),
  );

  const supported = detectFreeFall({
    node: "crate",
    body: BODY,
    centerOfMass: { x: 0, y: 5, z: 0 },
    support: FOOTPRINT,
    attached: false,
    falling: false,
  });
  TestValidator.equals(
    "supported succeeds cleanly",
    supported.validation.success,
    true,
  );
  TestValidator.equals(
    "supported has no warning",
    warnings(supported).length,
    0,
  );
  TestValidator.equals("supported has no event", supported.events.length, 0);
  TestValidator.equals("supported has no arc", supported.trajectory, null);

  const track = unheld.trajectory!.tracks.find(
    (t) => t.channel.kind === "node" && t.channel.path === "translation",
  )!;
  const lastY = track.values[track.values.length - 2]!;
  TestValidator.predicate(
    "free-fall height = origin.y + ½·g·t²",
    nclose(lastY, 5 + 0.5 * -9.81 * 1 * 1),
  );
};
