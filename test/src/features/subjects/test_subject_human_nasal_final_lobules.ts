import {
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Final anatomical targets are portable region data rather than hidden geometry.
 *
 * Scenarios:
 * 1. Replacing the complete nose region retains copied local sections across
 *    serialization and resolution, without touching the source basis.
 * 2. Empty sections replace the inherited population. Reset removes the detail,
 *    while a nonnumeric radius and a unilateral nose replacement refuse.
 */
export const test_subject_human_nasal_final_lobules = (): void => {
  const original = humanFaceFixture("final-nasal-document"),
    saved = structuredClone(original);
  const lobules = [
    { anchor: 4, offset: [0, 0, 3], radii: [5, 5, 5], core: 0.8 },
  ];
  const body = { shape: { lobules }, joinWidth: 1, depthReach: 20 };
  const selected = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "nose",
    value: { lobules: [], body },
  });
  TestValidator.equals(
    "portable local target",
    parseHumanFaceDocument(serializeHumanFaceDocument(selected)),
    selected,
  );
  TestValidator.equals(
    "resolved local target",
    humanFaceRegionValue(selected, "nose").body,
    body,
  );
  lobules[0].offset[2] = 30;
  const actual = humanFaceRegionValue(selected, "nose").body!.shape;
  if (!("lobules" in actual))
    throw new Error("Expected the selected local target");
  TestValidator.equals(
    "replacement owns profile",
    actual.lobules[0].offset[2],
    3,
  );
  const cleared = replaceHumanFaceRegion({
    document: selected,
    basisId: selected.basis.id,
    region: "nose",
    value: { body: { shape: { lobules: [] }, joinWidth: 1, depthReach: 20 } },
  });
  TestValidator.equals(
    "empty target population",
    humanFaceRegionValue(cleared, "nose").body!.shape,
    { lobules: [] },
  );
  const reset = replaceHumanFaceRegion({
    document: selected,
    basisId: selected.basis.id,
    region: "nose",
    value: undefined,
  });
  TestValidator.equals("inheritance restored", reset.detail?.nose, undefined);
  const malformed = JSON.parse(serializeHumanFaceDocument(selected));
  malformed.detail.nose.body.shape.lobules[0].radii[0] = "five";
  TestValidator.predicate(
    "numeric schema retained",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(malformed))),
  );
  TestValidator.predicate(
    "nose has one region owner",
    throwsError(() =>
      replaceHumanFaceRegion({
        document: selected,
        basisId: selected.basis.id,
        region: "nose",
        side: "left",
        value: { body },
      }),
    ),
  );
  TestValidator.equals("caller basis untouched", original, saved);
};
