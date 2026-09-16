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
 * The submental scalar has one explicit owner in a portable face document.
 *
 * Scenarios:
 * 1. Select the absent value, preserve it through JSON and reset to omission
 *    without modifying the source, its basis or the other cervical fields.
 * 2. Inclusive endpoints are editable; out-of-range, nonfinite and paired
 *    writes refuse without treating a missing field as an invented measurement.
 */
export const test_subject_human_submental = (): void => {
  const source = humanFaceFixture("submental-document"),
    before = structuredClone(source),
    id = "neck.submentalProjection";
  TestValidator.equals(
    "absent override",
    humanFaceDetailValue(source, id),
    undefined,
  );
  const selected = setHumanFaceDetail(source, id, 16);
  TestValidator.equals(
    "selected value",
    humanFaceDetailValue(selected, id),
    16,
  );
  TestValidator.equals(
    "portable scalar",
    parseHumanFaceDocument(serializeHumanFaceDocument(selected)),
    selected,
  );
  TestValidator.equals("only projection authored", selected.detail, {
    neck: { submentalProjection: 16 },
  });
  TestValidator.equals(
    "reset to omission",
    humanFaceDetailValue(setHumanFaceDetail(selected, id, undefined), id),
    undefined,
  );
  for (const value of [0, 40])
    TestValidator.equals(
      "inclusive endpoint",
      humanFaceDetailValue(setHumanFaceDetail(source, id, value), id),
      value,
    );
  for (const value of [-0.001, 40.001, NaN, Infinity])
    TestValidator.predicate(
      "invalid scalar",
      throwsError(() => setHumanFaceDetail(source, id, value)),
    );
  TestValidator.predicate(
    "unpaired neck",
    throwsError(() => setHumanFaceDetail(source, id, 1, "left")),
  );
  TestValidator.equals("source retained", source, before);
};
