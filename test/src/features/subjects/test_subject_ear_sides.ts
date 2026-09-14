import { buildPortraitEars, portraitEarShape } from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Independent pinna profiles select one anatomical side without constructing its opposite.
 *
 * Scenarios:
 * 1. Both side selectors return only their own anterior and posterior surfaces.
 * 2. A left-only scale change cannot move any right-side geometry.
 * 3. An unknown owner refuses before sampling the temporal surface.
 */
export const test_subject_ear_sides = (): void => {
  const skin: IAutoMovieMesh = {
    positions: [-0.07, 0.08].flatMap((x) => [
      x,
      -0.2,
      -0.2,
      x,
      0.2,
      -0.2,
      x,
      0.2,
      0.2,
      x,
      -0.2,
      0.2,
    ]),
    indices: [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
    normals: null,
    uvs: null,
    skin: null,
  };
  const right = buildPortraitEars(skin, portraitEarShape, "right");
  const left = buildPortraitEars(
    skin,
    { ...portraitEarShape, heightScale: 1.3 },
    "left",
  );
  TestValidator.equals("one right shell", right.length, 2);
  TestValidator.equals("one left shell", left.length, 2);
  TestValidator.predicate(
    "right anatomical owner",
    right.every((part) => part.id.startsWith("right-")),
  );
  TestValidator.predicate(
    "left anatomical owner",
    left.every((part) => part.id.startsWith("left-")),
  );
  TestValidator.equals(
    "opposite profile does not affect right",
    buildPortraitEars(skin, portraitEarShape, "right"),
    right,
  );
  TestValidator.predicate(
    "unknown pinna owner",
    throwsError(() =>
      buildPortraitEars(skin, portraitEarShape, "middle" as "left"),
    ),
  );
};
