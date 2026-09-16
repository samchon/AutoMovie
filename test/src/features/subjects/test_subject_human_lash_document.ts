import {
  createPortraitEyeComponent,
  humanFaceDetailChannels,
  humanFaceDetailValue,
  parseHumanFaceDocument,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitEyelashFixture } from "../internal/portraitEyelashFixture";
import { throwsError } from "../internal/predicates";

/**
 * A complete lash profile is a portable eye detail, with independent side
 * overrides and no new implicit profile in older documents.
 *
 * Scenarios:
 * 1. Omitted profiles stay absent. A complete common profile round-trips JSON.
 * 2. All seven channels expose their actual inherited value. A side curl edit
 *    retains the other eye and removal restores common inheritance.
 * 3. Partial JSON is admitted as an override, but construction rejects a
 *    still-incomplete resolved profile. A complete basis supplies that missing
 *    value, and an out-of-range numeric edit refuses independently.
 */
export const test_subject_human_lash_document = (): void => {
  const source = humanFaceFixture();
  TestValidator.equals(
    "legacy remains absent",
    humanFaceDetailValue(source, "eye.upperLashProfile.length"),
    undefined,
  );
  source.detail = { eye: { upperLashProfile: portraitEyelashFixture() } };
  const loaded = parseHumanFaceDocument(serializeHumanFaceDocument(source));
  TestValidator.equals(
    "portable profile",
    resolveHumanFaceDocument(loaded).recipe.eye.upperLashProfile,
    portraitEyelashFixture(),
  );
  const fields = humanFaceDetailChannels.filter((c) =>
    c.id.startsWith("eye.upperLashProfile."),
  );
  TestValidator.equals(
    "all shape controls",
    fields.map((c) => c.path[1]).sort((a, b) => a.localeCompare(b)),
    ["curl", "elevation", "fan", "length", "radius", "taper", "variation"],
  );
  for (const field of fields)
    TestValidator.equals(
      "actual profile value",
      humanFaceDetailValue(loaded, field.id),
      portraitEyelashFixture()[
        field.path[1] as keyof ReturnType<typeof portraitEyelashFixture>
      ],
    );
  const side = setHumanFaceDetail(
    loaded,
    "eye.upperLashProfile.curl",
    60,
    "left",
  );
  TestValidator.equals(
    "left curl",
    humanFaceDetailValue(side, "eye.upperLashProfile.curl", "left"),
    60,
  );
  TestValidator.equals(
    "right curl unchanged",
    humanFaceDetailValue(side, "eye.upperLashProfile.curl", "right"),
    0,
  );
  const reset = setHumanFaceDetail(
    side,
    "eye.upperLashProfile.curl",
    undefined,
    "left",
  );
  TestValidator.equals("clear restores common", reset, loaded);
  const bad = JSON.parse(serializeHumanFaceDocument(source));
  delete bad.detail.eye.upperLashProfile.length;
  const partial = parseHumanFaceDocument(JSON.stringify(bad));
  const resolved = resolveHumanFaceDocument(partial);
  TestValidator.predicate(
    "incomplete resolved profile refuses construction",
    throwsError(
      () =>
        createPortraitEyeComponent(
          resolved.bindings.eyes.right,
          resolved.right.eye,
        ),
      "length",
    ),
  );
  partial.basis.recipe.eye.upperLashProfile = {
    ...portraitEyelashFixture(),
    length: 6,
  };
  TestValidator.equals(
    "partial inherits basis length",
    resolveHumanFaceDocument(partial).right.eye.upperLashProfile?.length,
    6,
  );
  TestValidator.predicate(
    "bad scalar refuses",
    throwsError(() =>
      setHumanFaceDetail(loaded, "eye.upperLashProfile.radius", 0.3),
    ),
  );
};
