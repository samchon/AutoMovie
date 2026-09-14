import { humanFaceRegionValue, replaceHumanFaceRegion } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Region replacement has one current-basis owner and preserves unrelated edits.
 *
 * Scenarios:
 * 1. A common eye replacement and an independent left override retain nose traits and right identity.
 * 2. Removing either override restores the inherited profile without modifying caller data.
 * 3. Stale bases, unknown regions and unsupported side owners refuse.
 */
export const test_subject_human_region = (): void => {
  const original = humanFaceFixture();
  original.controls = { noseWidth: 0.1 };
  const shape = { ...original.basis.recipe.eye, foldDepth: 0.45 };
  const common = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "eye",
    value: shape,
  });
  const paired = replaceHumanFaceRegion({
    document: common,
    basisId: original.basis.id,
    region: "eye",
    side: "left",
    value: { foldDepth: 0.8 },
  });
  TestValidator.equals("unrelated trait", paired.controls, original.controls);
  TestValidator.equals(
    "right inherits common",
    humanFaceRegionValue(paired, "eye", "right")?.foldDepth,
    0.45,
  );
  TestValidator.equals(
    "left owns its override",
    humanFaceRegionValue(paired, "eye", "left")?.foldDepth,
    0.8,
  );
  shape.foldDepth = 1;
  TestValidator.equals(
    "owned common replacement",
    humanFaceRegionValue(common, "eye")?.foldDepth,
    0.45,
  );
  const inherited = replaceHumanFaceRegion({
    document: paired,
    basisId: original.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "side reset",
    humanFaceRegionValue(inherited, "eye", "left")?.foldDepth,
    0.45,
  );
  const reset = replaceHumanFaceRegion({
    document: inherited,
    basisId: original.basis.id,
    region: "eye",
    value: undefined,
  });
  TestValidator.equals(
    "common reset",
    humanFaceRegionValue(reset, "eye")?.foldDepth,
    original.basis.recipe.eye.foldDepth,
  );
  TestValidator.equals("caller untouched", original.detail, undefined);
  TestValidator.equals(
    "optional remains absent",
    humanFaceRegionValue(original, "cheek", "right"),
    undefined,
  );
  TestValidator.predicate(
    "stale basis",
    throwsError(() =>
      replaceHumanFaceRegion({
        document: original,
        basisId: "old",
        region: "eye",
        value: shape,
      }),
    ),
  );
  TestValidator.predicate(
    "unknown region",
    throwsError(() => humanFaceRegionValue(original, "unknown" as "eye")),
  );
  TestValidator.predicate(
    "unpaired region",
    throwsError(() => humanFaceRegionValue(original, "nose", "left")),
  );
  TestValidator.predicate(
    "invalid side",
    throwsError(() => humanFaceRegionValue(original, "eye", "other" as "left")),
  );
};
