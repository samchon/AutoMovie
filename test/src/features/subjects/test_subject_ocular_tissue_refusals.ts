import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitOcularTissueBoundary,
  createPortraitOcularTissues,
} from "../../subjects/generated-korean-girl-01/ocularTissues";
import { portraitPoint } from "../../subjects/geometry";
import { throwsError } from "../internal/predicates";

/**
 * Invalid tissue dimensions and nonresident curve samples must refuse before
 * entering a render. Adjacent valid zero and exact-half-width cases are admitted.
 * Scenarios:
 * 1. Each negative/nonfinite dimension refuses, while all-zero is valid.
 * 2. Reversed, zero and nonfinite spans or oversized medial regions refuse.
 * 3. Crossed/nonfinite lids and a nonfinite globe refuse during sampling.
 */
export const test_subject_ocular_tissue_refusals = (): void => {
  const shape = {
    cornerLength: 1,
    caruncleProjection: 0,
    plicaProjection: 0,
    lowerMarginWidth: 0.2,
    lowerMarginLift: 0,
  };
  const frame: IPortraitOcularTissueBoundary = {
    side: "left",
    minimumX: -1,
    maximumX: 1,
    lower: (x) => portraitPoint(x, x * x - 1, 0),
    upper: (x) => portraitPoint(x, 1 - x * x, 0),
    globe: () => 0,
  };
  const build = createPortraitOcularTissues(shape);
  build(frame);
  TestValidator.equals(
    "zero dimensions disable both",
    createPortraitOcularTissues({
      ...shape,
      cornerLength: 0,
      lowerMarginWidth: 0,
    })(frame),
    { corner: null, lowerMargin: null },
  );
  for (const field of Object.keys(shape))
    for (const value of [-0.01, NaN, Infinity])
      TestValidator.predicate(
        "invalid dimension refuses",
        throwsError(
          () => createPortraitOcularTissues({ ...shape, [field]: value }),
          "finite",
        ),
      );
  for (const override of [
    { minimumX: 1 },
    { minimumX: 2 },
    { maximumX: NaN },
    { minimumX: -Number.MAX_VALUE, maximumX: Number.MAX_VALUE },
    { maximumX: 0.9 },
  ])
    TestValidator.predicate(
      "invalid span refuses",
      throwsError(() => build({ ...frame, ...override }), "aperture"),
    );
  for (const override of [
    { lower: (x: number) => portraitPoint(x, 5, 0) },
    { upper: (x: number) => portraitPoint(x, 2, NaN) },
    { lower: () => portraitPoint(NaN, -2, 0) },
  ])
    TestValidator.predicate(
      "invalid lids refuse",
      throwsError(() => build({ ...frame, ...override }), "lid samples"),
    );
  TestValidator.predicate(
    "nonresident globe refuses",
    throwsError(() => build({ ...frame, globe: () => NaN }), "globe"),
  );
};
