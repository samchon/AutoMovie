import { TestValidator } from "@nestia/e2e";

import { portraitCutBoundary } from "../../subjects/generated-korean-girl-01/nose";
import { throwsError } from "../internal/predicates";

/**
 * A nasal opening supplies one closed oriented cycle, even when triangles are
 * listed in another order. Disconnected or pinched boundaries cannot be fitted.
 *
 * Scenarios:
 * 1. Reordered square triangles return four successive perimeter edges.
 * 2. A closed tetrahedron, pinched vertex, broken duplicate-face boundary,
 *    disconnected triangles and a tail entering another cycle all refuse.
 */
export const test_subject_nostril_boundary = (): void => {
  TestValidator.equals(
    "ordered square perimeter",
    portraitCutBoundary([
      [2, 3, 0],
      [2, 0, 1],
    ]),
    [
      { a: 2, b: 3 },
      { a: 3, b: 0 },
      { a: 0, b: 1 },
      { a: 1, b: 2 },
    ],
  );
  for (const faces of [
    [
      [0, 2, 1],
      [0, 1, 3],
      [1, 2, 3],
      [2, 0, 3],
    ],
    [
      [0, 1, 2],
      [0, 3, 4],
    ],
    [
      [0, 1, 2],
      [0, 1, 2],
      [0, 2, 3],
    ],
    [
      [0, 1, 2],
      [3, 4, 5],
    ],
    [
      [4, 2, 1],
      [1, 0, 3],
      [2, 0, 1],
      [2, 1, 3],
    ],
  ])
    TestValidator.predicate(
      "non-simple opening refused",
      throwsError(() => portraitCutBoundary(faces)),
    );
};
