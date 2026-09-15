import { assertPortraitTongueShape } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitTongueFixture } from "../internal/portraitTongueFixture";
import { throwsError } from "../internal/predicates";

/**
 * Lingual dimensions use explicit authoring bounds and a coupled median groove.
 *
 * Scenarios:
 * 1. All independently specified scalar endpoints admit without mutating input.
 * 2. Adjacent outliers and nonfinite values refuse for every numerical field.
 * 3. A groove just below half-thickness admits, equality and a blank finish refuse.
 */
export const test_subject_tongue_shape = (): void => {
  const shape = portraitTongueFixture(),
    saved = structuredClone(shape);
  const bounds = [
    ["halfWidth", 5, 35],
    ["length", 20, 70],
    ["halfThickness", 2, 15],
    ["dorsumRise", 0, 15],
    ["grooveDepth", 0, 3],
    ["grooveWidth", 0.2, 8],
    ["drop", 0, 15],
    ["recess", 0, 30],
  ] as const;
  for (const [key, low, high] of bounds) {
    for (const value of [low, high])
      assertPortraitTongueShape({ ...shape, [key]: value });
    for (const value of [low - 0.001, high + 0.001, NaN, Infinity])
      TestValidator.predicate(
        "invalid named dimension",
        throwsError(
          () => assertPortraitTongueShape({ ...shape, [key]: value }),
          key,
        ),
      );
  }
  assertPortraitTongueShape({ ...shape, halfThickness: 2, grooveDepth: 1.999 });
  TestValidator.predicate(
    "groove cannot consume upper body",
    throwsError(
      () =>
        assertPortraitTongueShape({
          ...shape,
          halfThickness: 2,
          grooveDepth: 2,
        }),
      "groove depth",
    ),
  );
  TestValidator.predicate(
    "finish identity",
    throwsError(
      () => assertPortraitTongueShape({ ...shape, material: "  " }),
      "material",
    ),
  );
  TestValidator.equals("owned dimensions", shape, saved);
};
