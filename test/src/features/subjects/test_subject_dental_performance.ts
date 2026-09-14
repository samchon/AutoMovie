import { createPortraitDentalComponent } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Upper dentition remains attached to the maxilla while the oral opening performs.
 *
 * Scenarios:
 * 1. Translation and distortion of the refined oral anchors do not change a fixed upper row.
 * 2. Mutating the observed host after fitting cannot change its captured attachment.
 * 3. Unknown attachment policies refuse before dental allocation.
 */
export const test_subject_dental_performance = (): void => {
  const socket = { rightCorner: 0, leftCorner: 1, upperLipMiddle: 2 };
  const row = {
    halfWidth: 24,
    depth: 18,
    gap: 0.1,
    crowns: [
      { width: 8, height: 10, depth: 1.5, cervicalWidth: 0.8, edgeRise: 0.3 },
    ],
  };
  const placement = { lift: 1, recess: 4 };
  const host = {
    positions: [
      [-20, 0, 0],
      [20, 0, 0],
      [0, 0, 5],
    ],
    indices: [],
    viewRay: [0, 0, 1],
  };
  const neutral = {
    positions: structuredClone(host.positions),
    indices: [],
    groups: [],
  };
  const component = createPortraitDentalComponent(
    socket,
    row,
    placement,
    "observed-maxilla",
  );
  const attached = component.fit(host).attach(neutral, host.positions, () => 0);
  const before = attached.finish(neutral);
  host.positions[2][1] = 99;
  const moving = {
    ...neutral,
    positions: [
      [-25, -3, 1],
      [22, 6, 2],
      [1, -9, 10],
    ],
  };
  TestValidator.equals(
    "upper arch remains fixed",
    attached.finish(moving),
    before,
  );
  TestValidator.predicate(
    "unsupported dental policy",
    throwsError(() =>
      createPortraitDentalComponent(
        socket,
        row,
        placement,
        "moving-jaw" as "observed-maxilla",
      ),
    ),
  );
};
