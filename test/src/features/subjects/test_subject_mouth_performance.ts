import { createPortraitMouthPerformance } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Oral closure retains lip thickness and a shared seam rather than flattening the mouth.
 *
 * Scenarios:
 * 1. Identity replays exactly; closure pairs XYZ despite unequal anterior rim depth.
 * 2. Adjacent band points receive the same displacement, preserving their body thickness.
 * 3. A truly closed observation opens in millimetres; caller/result mutation cannot change a retained evaluator.
 * 4. Invalid ranges, curves, corner attachment and unrepresentable ratios refuse.
 */
export const test_subject_mouth_performance = (): void => {
  const upper = [
    { x: -2, y: 0, z: 0 },
    { x: 0, y: 2, z: 1 },
    { x: 2, y: 0, z: 0 },
  ];
  const lower = [
    { x: -2, y: 0, z: 0 },
    { x: 0, y: -2, z: -1 },
    { x: 2, y: 0, z: 0 },
  ];
  const identity = createPortraitMouthPerformance(upper, lower, {
    lipPart: 4,
    observedLipPart: 4,
  });
  TestValidator.equals("observed replay", identity.upper, upper);
  TestValidator.equals(
    "observed evaluator",
    identity.move(upper[1], "upper"),
    upper[1],
  );
  const closed = createPortraitMouthPerformance(upper, lower, {
    lipPart: 0,
    observedLipPart: 4,
  });
  TestValidator.equals("common seam", closed.upper, closed.lower);
  TestValidator.equals("seam midpoint", closed.upper[1], { x: 0, y: 0, z: 0 });
  TestValidator.equals(
    "upper body thickness retained",
    closed.move({ x: 0, y: 5, z: 2 }, "upper"),
    { x: 0, y: 3, z: 1 },
  );
  TestValidator.equals(
    "lower body thickness retained",
    closed.move({ x: 0, y: -5, z: -2 }, "lower"),
    { x: 0, y: -3, z: -1 },
  );
  TestValidator.equals(
    "outside corner left",
    closed.move({ x: -4, y: 0, z: 0 }, "upper"),
    { x: -4, y: 0, z: 0 },
  );
  TestValidator.equals(
    "outside corner right",
    closed.move({ x: 4, y: 0, z: 0 }, "lower"),
    { x: 4, y: 0, z: 0 },
  );
  const opened = createPortraitMouthPerformance(closed.upper, closed.lower, {
    lipPart: 6,
    observedLipPart: 0,
  });
  TestValidator.equals(
    "open a neutral seam",
    [opened.upper[1].y, opened.lower[1].y],
    [3, -3],
  );
  closed.upper[1].y = 99;
  upper[1].y = 99;
  TestValidator.equals(
    "owned curve evaluator",
    closed.move({ x: 0, y: 5, z: 2 }, "upper"),
    { x: 0, y: 3, z: 1 },
  );
  upper[1].y = 2;
  createPortraitMouthPerformance(upper, lower, {
    lipPart: 30,
    observedLipPart: 30,
  });
  for (const performance of [
    { lipPart: -1, observedLipPart: 4 },
    { lipPart: 31, observedLipPart: 4 },
    { lipPart: NaN, observedLipPart: 4 },
    { lipPart: 4, observedLipPart: -1 },
    { lipPart: 4, observedLipPart: 31 },
    { lipPart: 4, observedLipPart: Infinity },
  ])
    TestValidator.predicate(
      "separation guard",
      throwsError(() =>
        createPortraitMouthPerformance(upper, lower, performance),
      ),
    );
  for (const band of [
    [],
    upper.slice(1),
    upper.map((point, i) => (i === 1 ? { ...point, x: -3 } : point)),
    upper.map((point, i) => (i === 1 ? { ...point, z: NaN } : point)),
    upper.map((point, i) => (i === 0 ? { ...point, y: 1 } : point)),
  ])
    TestValidator.predicate(
      "margin guard",
      throwsError(() =>
        createPortraitMouthPerformance(band, lower, {
          lipPart: 0,
          observedLipPart: 4,
        }),
      ),
    );
  TestValidator.predicate(
    "different last corner",
    throwsError(() =>
      createPortraitMouthPerformance(
        upper,
        lower.map((point, i) => (i === 2 ? { ...point, z: 1 } : point)),
        { lipPart: 0, observedLipPart: 4 },
      ),
    ),
  );
  TestValidator.predicate(
    "false closed observation",
    throwsError(() =>
      createPortraitMouthPerformance(upper, lower, {
        lipPart: 0,
        observedLipPart: 0,
      }),
    ),
  );
  TestValidator.predicate(
    "ratio overflow",
    throwsError(() =>
      createPortraitMouthPerformance(upper, lower, {
        lipPart: 30,
        observedLipPart: Number.MIN_VALUE,
      }),
    ),
  );
  TestValidator.predicate(
    "sample guard",
    throwsError(() => closed.move({ x: NaN, y: 0, z: 0 }, "upper")),
  );
};
