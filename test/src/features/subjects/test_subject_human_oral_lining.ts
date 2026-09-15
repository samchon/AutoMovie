import {
  humanFaceDetailValue,
  parseHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * The detailed mouth channel preserves optional and explicit enclosure data.
 *
 * Scenarios:
 * 1. An absent wall can be selected at zero, changed to the inclusive maximum
 *    and reset without changing the basis; JSON preserves the explicit choice.
 * 2. Nonfinite, out-of-envelope and paired edits refuse.
 */
export const test_subject_human_oral_lining = (): void => {
  const source = humanFaceFixture("oral-lining-document"),
    saved = structuredClone(source);
  const id = "mouth.cavityWall";
  TestValidator.equals(
    "absence is not zero",
    humanFaceDetailValue(source, id),
    undefined,
  );
  const selected = setHumanFaceDetail(source, id, 0);
  TestValidator.equals("explicit zero", humanFaceDetailValue(selected, id), 0);
  TestValidator.equals(
    "portable enclosure",
    parseHumanFaceDocument(serializeHumanFaceDocument(selected)),
    selected,
  );
  TestValidator.equals(
    "upper endpoint",
    humanFaceDetailValue(setHumanFaceDetail(selected, id, 0.95), id),
    0.95,
  );
  TestValidator.equals(
    "reset omission",
    humanFaceDetailValue(setHumanFaceDetail(selected, id, undefined), id),
    undefined,
  );
  for (const value of [-0.001, 0.951, NaN, Infinity])
    TestValidator.predicate(
      "invalid wall detail",
      throwsError(() => setHumanFaceDetail(source, id, value)),
    );
  TestValidator.predicate(
    "unpaired cavity",
    throwsError(() => setHumanFaceDetail(source, id, 0.5, "right")),
  );
  TestValidator.equals("immutable basis", source, saved);
};
