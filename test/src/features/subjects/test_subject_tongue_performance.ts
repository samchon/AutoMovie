import {
  createPortraitTongueComponent,
  resolveHumanFaceExpression,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitTongueFixture } from "../internal/portraitTongueFixture";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The component consumes tongue performance relative to the observed posture.
 *
 * Scenarios:
 * 1. Observed rise/advance 2/1 and current 6/7 produce four millimetres of
 *    mid-body elevation and three of advance; the tip advances six and the
 *    posterior pole stays fixed in the observed oral frame.
 * 2. Both signed eight-mm channel endpoints admit, while adjacent values and
 *    a paired-object spelling refuse rather than silently changing semantics.
 */
export const test_subject_tongue_performance = (): void => {
  const socket = { rightCorner: 0, leftCorner: 1, lowerLipMiddle: 2 };
  const shape = portraitTongueFixture(),
    hinge = { x: 0, y: 0, z: -40 };
  const host = {
    positions: [
      [-20, 0, 0],
      [20, 0, 0],
      [0, -10, 5],
    ],
    indices: [],
    viewRay: [0, 0, 1],
  };
  const refined = { positions: host.positions, indices: [], groups: [] };
  const observed = { tongueRaise: 2, tongueAdvance: 1 };
  const make = (current: typeof observed) => {
    const geometry = createPortraitTongueComponent(
      socket,
      shape,
      hinge,
      observed,
      current,
    )
      .fit(host)
      .attach(refined, host.positions, () => 0)
      .finish(refined)[0].geometry;
    if (geometry.type !== "mesh") throw new Error("Expected lingual mesh.");
    return geometry.mesh;
  };
  const basis = make(observed),
    performed = make({ tongueRaise: 6, tongueAdvance: 7 });
  const middle = (1 + 15 * 48 + 12) * 3;
  TestValidator.predicate(
    "observed relative dorsal elevation",
    nclose(
      performed.positions[middle + 1] - basis.positions[middle + 1],
      0.004,
    ),
  );
  TestValidator.predicate(
    "observed relative mid-body advance",
    nclose(
      performed.positions[middle + 2] - basis.positions[middle + 2],
      0.003,
    ),
  );
  TestValidator.predicate(
    "observed relative tip advance",
    nclose(performed.positions[2] - basis.positions[2], 0.006),
  );
  TestValidator.equals(
    "fixed posterior endpoint",
    performed.positions.slice(-3),
    basis.positions.slice(-3),
  );
  for (const key of ["tongueRaise", "tongueAdvance"] as const) {
    for (const value of [-8, 8])
      TestValidator.equals(
        "declared signed endpoint",
        resolveHumanFaceExpression({ [key]: value })[key],
        value,
      );
    for (const value of [-8.001, 8.001])
      TestValidator.predicate(
        "adjacent channel refusal",
        throwsError(() => resolveHumanFaceExpression({ [key]: value }), key),
      );
    TestValidator.predicate(
      "scalar channel shape",
      throwsError(
        () => resolveHumanFaceExpression({ [key]: { left: 1 } }),
        "scalar",
      ),
    );
  }
};
