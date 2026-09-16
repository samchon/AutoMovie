import {
  createPortraitEyeComponent,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * Folded and closed tissue populations belong to a replayable eye region, with
 * unilateral replacement and schema admission matching other detailed anatomy.
 *
 * Scenarios:
 * 1. A left folded profile round-trips both arrays while the right and source
 *    remain unchanged. Clearing the override restores inherited anatomy.
 * 2. A missing closed hood refuses at schema admission. A mismatched attachment
 *    remains schema-valid but refuses at the real eye's geometric admission.
 */
export const test_subject_human_upper_lid_fold = (): void => {
  const source = humanFaceFixture(),
    before = resolveHumanFaceDocument(source),
    profile = upperLidFoldFixture(),
    edited = replaceHumanFaceRegion({
      document: source,
      basisId: source.basis.id,
      region: "eye",
      side: "left",
      value: { upperLidProfile: profile },
    }),
    loaded = parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
    resolved = resolveHumanFaceDocument(loaded);
  TestValidator.equals(
    "folded and closed arrays retained",
    resolved.left.eye.upperLidProfile,
    profile,
  );
  TestValidator.equals(
    "opposite eye retained",
    resolved.right.eye,
    before.right.eye,
  );
  TestValidator.equals("source untouched", source.detail, undefined);
  const reset = replaceHumanFaceRegion({
    document: loaded,
    basisId: source.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "reset restores inheritance",
    resolveHumanFaceDocument(reset).left.eye,
    before.left.eye,
  );
  const missing = JSON.parse(serializeHumanFaceDocument(loaded));
  delete missing.asymmetry.left.eye.upperLidProfile.closedSections[0].section
    .hood;
  TestValidator.predicate(
    "missing closed tissue refuses",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(missing))),
  );
  const mismatch = upperLidFoldFixture();
  mismatch.closedSections![0].section.attachment = 6;
  const mismatched = parseHumanFaceDocument(
    serializeHumanFaceDocument(
      replaceHumanFaceRegion({
        document: source,
        basisId: source.basis.id,
        region: "eye",
        side: "left",
        value: { upperLidProfile: mismatch },
      }),
    ),
  );
  TestValidator.predicate(
    "mismatched closed attachment refuses at construction",
    throwsError(
      () =>
        createPortraitEyeComponent(
          source.basis.bindings.eyes.left,
          resolveHumanFaceDocument(mismatched).left.eye,
        ),
      "attachment",
    ),
  );
};
