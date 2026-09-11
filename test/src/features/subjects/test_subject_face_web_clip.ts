import { TestValidator } from "@nestia/e2e";

import { portraitWebClip } from "../../../scripts/face-review/web/logic.mjs";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Metric clip planes protect the complete model while preserving depth precision.
 * Scenarios:
 * 1. A two-metre cube viewed from +Z has depths 4..6; the planes add a 5%
 *    diagonal margin. Profile and scaled camera directions yield the same range.
 * 2. Scaling the whole experiment scales both clips, and a translated box keeps
 *    them unchanged. Inside, behind-camera and point boxes retain a valid range.
 * 3. Nonfinite, malformed, inverted bounds and a zero direction refuse.
 */
export const test_subject_face_web_clip = (): void => {
  const min = [-1, -1, -1],
    max = [1, 1, 1];
  const margin = Math.sqrt(12) * 0.05;
  const expected = { near: 4 - margin, far: 6 + margin };
  for (const [eye, direction] of [
    [
      [0, 0, 5],
      [0, 0, -1],
    ],
    [
      [5, 0, 0],
      [-2, 0, 0],
    ],
  ]) {
    const clip = portraitWebClip(min, max, eye, direction);
    TestValidator.predicate(
      "enclosing range",
      nclose(clip.near, expected.near) && nclose(clip.far, expected.far),
    );
  }
  const scaled = portraitWebClip(
    min.map((n) => n / 100),
    max.map((n) => n / 100),
    [0, 0, 0.05],
    [0, 0, -1],
  );
  TestValidator.predicate(
    "small subject precision",
    nclose(scaled.near, expected.near / 100) &&
      nclose(scaled.far, expected.far / 100),
  );
  const shifted = portraitWebClip(
    [9, 19, 29],
    [11, 21, 31],
    [10, 20, 35],
    [0, 0, -1],
  );
  TestValidator.predicate(
    "translation invariant",
    nclose(shifted.near, expected.near) && nclose(shifted.far, expected.far),
  );
  for (const eye of [
    [0, 0, 0],
    [0, 0, -5],
  ]) {
    const clip = portraitWebClip(min, max, eye, [0, 0, -1]);
    TestValidator.predicate(
      "inside/away camera remains valid",
      clip.near > 0 && clip.far > clip.near,
    );
    TestValidator.predicate(
      "scale-relative floor",
      nclose(clip.near, Math.sqrt(12) / 100000),
    );
  }
  const point = portraitWebClip([0, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, -1]);
  TestValidator.predicate(
    "degenerate box encloses point",
    point.near < 1 && point.far > 1,
  );
  for (const bad of [
    [0, 0],
    [0, NaN, 0],
    [0, Infinity, 0],
  ])
    TestValidator.predicate(
      "invalid coordinates refuse",
      throwsError(
        () => portraitWebClip(bad, max, [0, 0, 5], [0, 0, -1]),
        "finite ordered",
      ),
    );
  TestValidator.predicate(
    "inverted bounds refuse",
    throwsError(
      () => portraitWebClip(max, min, [0, 0, 5], [0, 0, -1]),
      "finite ordered",
    ),
  );
  TestValidator.predicate(
    "zero heading refuses",
    throwsError(
      () => portraitWebClip(min, max, [0, 0, 5], [0, 0, 0]),
      "nonzero",
    ),
  );
  TestValidator.predicate(
    "overflowing heading refuses",
    throwsError(
      () =>
        portraitWebClip(
          min,
          max,
          [0, 0, 5],
          [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE],
        ),
      "finite and nonzero",
    ),
  );
  TestValidator.predicate(
    "unrepresentable extent refuses",
    throwsError(
      () =>
        portraitWebClip(
          [-Number.MAX_VALUE, 0, 0],
          [Number.MAX_VALUE, 0, 0],
          [0, 0, 1],
          [0, 0, -1],
        ),
      "representable",
    ),
  );
  TestValidator.predicate(
    "unrepresentable point interval refuses",
    throwsError(
      () =>
        portraitWebClip(
          [0, 0, 0],
          [0, 0, 0],
          [0, 0, Number.MAX_VALUE],
          [0, 0, -1],
        ),
      "representable",
    ),
  );
  TestValidator.predicate(
    "unrepresentable far plane refuses",
    throwsError(
      () =>
        portraitWebClip(
          [0, 0, 0],
          [0, 0, Number.MAX_VALUE],
          [0, 0, 0],
          [0, 0, 1],
        ),
      "representable",
    ),
  );
};
