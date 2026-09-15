import {
  assertPortraitOralLining,
  buildPortraitOralLining,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { portraitOralLiningFixture } from "../internal/portraitOralLiningFixture";
import { throwsError } from "../internal/predicates";

/**
 * Chamber dimensions cannot introduce invalid coordinates or a flat projected
 * opening. These are authoring constraints, not physiological normal ranges.
 *
 * Scenarios:
 * 1. Each nonfinite field, negative expansion and nonpositive transition fails
 *    beside its valid zero-expansion or positive-transition neighbour.
 * 2. A valid vertical-plane rim remains legal without expansion, but selecting
 *    expansion refuses its zero projected X extent instead of dividing by zero.
 * 3. Finite input whose expanded coordinates overflow refuses at the existing
 *    final-coordinate guard rather than publishing an infinite chamber.
 */
export const test_subject_oral_chamber_admission = (): void => {
  const chamber = {
    horizontalExpansion: 5,
    verticalExpansion: 10,
    transitionDepth: 9,
  };
  assertPortraitOralLining(10, 0.75, chamber);
  for (const key of [
    "horizontalExpansion",
    "verticalExpansion",
    "transitionDepth",
  ] as const) {
    for (const value of [NaN, Infinity, -Infinity, -1])
      TestValidator.predicate(
        "invalid chamber field",
        throwsError(
          () =>
            assertPortraitOralLining(10, 0.75, { ...chamber, [key]: value }),
          "Oral chamber",
        ),
      );
    if (key === "transitionDepth")
      TestValidator.predicate(
        "zero transition refuses",
        throwsError(
          () => assertPortraitOralLining(10, 0.75, { ...chamber, [key]: 0 }),
          "Oral chamber",
        ),
      );
    else assertPortraitOralLining(10, 0.75, { ...chamber, [key]: 0 });
  }
  assertPortraitOralLining(10, 0.75, {
    ...chamber,
    transitionDepth: Number.MIN_VALUE,
  });
  const vertical = portraitOralLiningFixture();
  vertical.positions = vertical.positions.map(([x, y]) => [0, y, x]);
  buildPortraitOralLining(vertical, 0, 10, 0.75);
  TestValidator.predicate(
    "projected extent required only for expansion",
    throwsError(
      () => buildPortraitOralLining(vertical, 0, 10, 0.75, chamber),
      "projected rim extents",
    ),
  );
  const unrepresentableExtent = portraitOralLiningFixture();
  unrepresentableExtent.positions = unrepresentableExtent.positions.map(
    ([_x, y, z], i) => [i === 0 ? -1.7e308 : 1.7e308, y, z + i],
  );
  TestValidator.predicate(
    "extreme rim still has distinct adjacent points",
    unrepresentableExtent.positions
      .slice(0, 4)
      .every((p, i, rim) =>
        p.some((value, axis) => value !== rim[(i + 1) % rim.length][axis]),
      ),
  );
  TestValidator.predicate(
    "nonfinite projected extent refuses",
    throwsError(
      () =>
        buildPortraitOralLining(unrepresentableExtent, 0, 10, 0.75, chamber),
      "projected rim extents",
    ),
  );
  const huge = portraitOralLiningFixture();
  huge.positions = huge.positions.map(([x, y, z]) => [
    x < 0 ? 1e308 : 1.1e308,
    y,
    z,
  ]);
  TestValidator.predicate(
    "overflow refused",
    throwsError(
      () =>
        buildPortraitOralLining(huge, 0, 10, 0.75, {
          ...chamber,
          horizontalExpansion: 1e308,
        }),
      "representable coordinates",
    ),
  );
};
