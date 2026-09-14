import {
  createPortraitMouthPerformance,
  posePortraitJawPoint,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError, vclose } from "../internal/predicates";

/**
 * Oral expression composes observed-relative lip separation, independent corners, protrusion and jaw rotation.
 *
 * Scenarios:
 * 1. The lower lip follows the jaw while the upper lip remains maxillary; inverse observation restores a shared neutral seam.
 * 2. Source performance replays exactly, independent smile corners lift separately, and protrusion narrows the oral span.
 * 3. Invalid jaw, smile and pucker values refuse; returned curves and caller objects cannot mutate the retained evaluator.
 */
export const test_subject_oral_expression = (): void => {
  const seam = [
    { x: -10, y: 0, z: 20 },
    { x: 0, y: 0, z: 22 },
    { x: 10, y: 0, z: 20 },
  ];
  const hinge = { x: 0, y: 0, z: 0 };
  const jaw = { hinge, observed: 0, current: 20 };
  const opened = createPortraitMouthPerformance(seam, seam, {
    lipPart: 0,
    observedLipPart: 0,
    jaw,
  });
  TestValidator.equals("stationary upper lip", opened.upper, seam);
  TestValidator.predicate(
    "mandibular lower lip",
    vclose(opened.lower[1], posePortraitJawPoint(seam[1], hinge, 20, 1)),
  );
  const neutral = createPortraitMouthPerformance(opened.upper, opened.lower, {
    lipPart: 0,
    observedLipPart: 0,
    jaw: { hinge, observed: 20, current: 0 },
  });
  TestValidator.equals("recovered paired seam", neutral.upper, neutral.lower);
  TestValidator.predicate(
    "neutral recovery",
    vclose(neutral.upper[1], seam[1]),
  );
  const replay = createPortraitMouthPerformance(opened.upper, opened.lower, {
    lipPart: 0,
    observedLipPart: 0,
    jaw: { hinge, observed: 20, current: 20 },
  });
  TestValidator.equals("exact source expression", replay.lower, opened.lower);
  const pose = createPortraitMouthPerformance(seam, seam, {
    lipPart: 0,
    observedLipPart: 0,
    smile: { right: -2, left: 3 },
    pucker: { observed: 0, current: 2 },
  });
  TestValidator.equals(
    "independent corner elevation",
    [pose.upper[0].y, pose.upper[2].y],
    [-2, 3],
  );
  TestValidator.predicate(
    "coupled narrowing",
    nclose(pose.upper[0].x, -8.8) && nclose(pose.upper[2].x, 8.8),
  );
  TestValidator.equals("central protrusion", pose.upper[1].z, 24);
  const body = { x: 0, y: -3, z: 22 };
  TestValidator.predicate(
    "jaw rotates lower lip body",
    vclose(
      opened.move(body, "lower"),
      posePortraitJawPoint(body, hinge, 20, 1),
    ),
  );
  jaw.current = 0;
  hinge.z = -99;
  opened.lower[1].y = 99;
  TestValidator.predicate(
    "retained motion ownership",
    vclose(
      opened.move(body, "lower"),
      posePortraitJawPoint(body, { x: 0, y: 0, z: 0 }, 20, 1),
    ),
  );
  for (const extra of [
    { jaw: { hinge, current: -1, observed: 0 } },
    { jaw: { hinge, current: 0, observed: -1 } },
    { jaw: { hinge, current: 26, observed: 0 } },
    { smile: { right: 13.1, left: 0 } },
    { smile: { right: 0, left: -13.1 } },
    { smile: { right: NaN, left: 0 } },
    { pucker: { current: -1, observed: 0 } },
    { pucker: { current: 5, observed: 0 } },
    { pucker: { current: 0, observed: -1 } },
    { pucker: { current: 0, observed: 5 } },
  ])
    TestValidator.predicate(
      "oral performance guard",
      throwsError(() =>
        createPortraitMouthPerformance(seam, seam, {
          lipPart: 0,
          observedLipPart: 0,
          ...extra,
        }),
      ),
    );
  const expanded = createPortraitMouthPerformance(seam, seam, {
    lipPart: 0,
    observedLipPart: 0,
    pucker: { current: 0, observed: 4 },
  });
  TestValidator.predicate(
    "perioral overflow guard",
    throwsError(() =>
      expanded.move({ x: Number.MAX_VALUE, y: 0, z: 0 }, "upper"),
    ),
  );
};
