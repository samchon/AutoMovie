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
 * A chamber is a complete optional profile that survives document serialization
 * and exposes three independently editable scalar fields.
 *
 * Scenarios:
 * 1. Omission is not zero; selected expansions and transition values round-trip
 *    without modifying the basis. Each scalar accepts both envelope endpoints.
 * 2. Each scalar refuses adjacent out-of-envelope and nonfinite values, and
 *    the unpaired mouth profile refuses a unilateral edit.
 */
export const test_subject_human_oral_chamber = (): void => {
  const source = humanFaceFixture("oral-chamber-document"),
    saved = structuredClone(source);
  const selected = structuredClone(source);
  selected.detail = {
    mouth: {
      cavityWall: 0.75,
      cavityChamber: {
        horizontalExpansion: 5,
        verticalExpansion: 10,
        transitionDepth: 5,
      },
    },
  };
  TestValidator.equals(
    "portable chamber",
    parseHumanFaceDocument(serializeHumanFaceDocument(selected)),
    selected,
  );
  for (const [key, min, max] of [
    ["horizontalExpansion", 0, 30],
    ["verticalExpansion", 0, 30],
    ["transitionDepth", 0.1, 60],
  ] as const) {
    const id = `mouth.cavityChamber.${key}`;
    TestValidator.equals(
      "omission is not zero",
      humanFaceDetailValue(source, id),
      undefined,
    );
    for (const value of [min, max])
      TestValidator.equals(
        "inclusive endpoint",
        humanFaceDetailValue(setHumanFaceDetail(selected, id, value), id),
        value,
      );
    for (const value of [min - 0.001, max + 0.001, NaN, Infinity])
      TestValidator.predicate(
        "invalid detail refuses",
        throwsError(() => setHumanFaceDetail(selected, id, value)),
      );
    TestValidator.predicate(
      "unpaired chamber",
      throwsError(() => setHumanFaceDetail(selected, id, min, "right")),
    );
  }
  TestValidator.equals("original ownership", source, saved);
};
