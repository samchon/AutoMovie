import {
  type IPortraitSkinColourRegion,
  createPortraitSkinColour,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * Pigment inputs refuse malformed bindings and values without clipping.
 *
 * Scenarios:
 * 1. Each malformed name, anchor, tuple, radius, gain and strength has an
 *    adjacent admitted baseline; duplicate names refuse as a population.
 * 2. Nonfinite reference anchors and overflowing derived centres refuse.
 */
export const test_subject_skin_colour_refusals = (): void => {
  const region = skinColourRegion(),
    host = { positions: [[0, 0, 0]], indices: [], viewRay: [0, 0, 1] };
  const changes: Partial<IPortraitSkinColourRegion>[] = [
    { name: " " },
    { anchor: -1 },
    { anchor: 0.5 },
    { anchor: 1 },
    { anchor: NaN },
    { offset: [0, NaN, 0] },
    { radius: [0, 4, 8] },
    { radius: [2, -1, 8] },
    { radius: [2, Infinity, 8] },
    { gain: [-Number.EPSILON, 0.6, 0.4] },
    { gain: [1 + Number.EPSILON, 0.6, 0.4] },
    { strength: -0.01 },
    { strength: 1.01 },
    { strength: NaN },
    { offset: [0, 0] as unknown as [number, number, number] },
  ];
  for (const change of changes) {
    TestValidator.predicate(
      "invalid region refuses",
      throwsError(() =>
        createPortraitSkinColour(host, [{ ...region, ...change }]),
      ),
    );
    TestValidator.predicate(
      "adjacent baseline admitted",
      !throwsError(() => createPortraitSkinColour(host, [region])),
    );
  }
  TestValidator.predicate(
    "duplicate identity",
    throwsError(
      () => createPortraitSkinColour(host, [region, region]),
      "unique",
    ),
  );
  for (const point of [
    [0, 0],
    [0, NaN, 0],
  ])
    TestValidator.predicate(
      "invalid anchor coordinates",
      throwsError(
        () =>
          createPortraitSkinColour({ ...host, positions: [point] }, [region]),
        "finite reference anchor",
      ),
    );
  TestValidator.predicate(
    "derived overflow",
    throwsError(
      () =>
        createPortraitSkinColour(
          { ...host, positions: [[Number.MAX_VALUE, 0, 0]] },
          [{ ...region, offset: [Number.MAX_VALUE, 0, 0] }],
        ),
      "representable",
    ),
  );
};
