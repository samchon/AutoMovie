import { portraitJawSkinWeight } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Facial and cervical tissue use the same observed oral transition.
 *
 * Scenarios:
 * 1. A ten-mm band has independently calculated cubic weights at its endpoints,
 *    quarter and midpoint, with constant weights beyond both ends.
 * 2. A closed or inverted band uses four mm rather than division by zero.
 * 3. Each nonfinite coordinate is refused independently of the other two.
 */
export const test_subject_jaw_skin_weight = (): void => {
  for (const [y, expected] of [
    [2, 0],
    [0, 0],
    [-2.5, 0.15625],
    [-5, 0.5],
    [-10, 1],
    [-12, 1],
  ])
    TestValidator.predicate(
      "oral weight",
      nclose(portraitJawSkinWeight(y, 0, -10), expected),
    );
  for (const lower of [0, 2])
    TestValidator.predicate(
      "closed transition",
      nclose(portraitJawSkinWeight(-2, 0, lower), 0.5),
    );
  for (const input of [
    [NaN, 0, -10],
    [0, Infinity, -10],
    [0, 0, -Infinity],
  ])
    TestValidator.predicate(
      "finite heights",
      throwsError(() => portraitJawSkinWeight(input[0], input[1], input[2])),
    );
  for (const [y, upper, lower] of [
    [-Number.MAX_VALUE, Number.MAX_VALUE, 0],
    [0, Number.MAX_VALUE, -Number.MAX_VALUE],
  ])
    TestValidator.predicate(
      "finite derived differences",
      throwsError(() => portraitJawSkinWeight(y, upper, lower)),
    );
};
