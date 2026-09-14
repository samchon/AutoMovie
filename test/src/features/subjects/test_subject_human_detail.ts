import {
  humanFaceDetailChannels,
  humanFaceDetailValue,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Scalar detail writes preserve override intent and use declared anatomical envelopes.
 *
 * Scenarios:
 * 1. Every channel accepts both inclusive endpoints and refuses adjacent/nonfinite values.
 * 2. A left-only edit leaves the common/right profile and unrelated traits unchanged.
 * 3. Removing the leaf restores inheritance; absent optional profiles remain absent.
 * 4. Unknown channels, fractional fibre populations and invalid side owners refuse.
 */
export const test_subject_human_detail = (): void => {
  const document = humanFaceFixture();
  TestValidator.equals(
    "omitted oral depth defaults to zero",
    humanFaceDetailValue(document, "mouth.seamProjection"),
    0,
  );
  const inheritedDepth = humanFaceFixture();
  inheritedDepth.basis.recipe.mouth.seamProjection = -2;
  TestValidator.equals(
    "basis oral depth remains explicit",
    humanFaceDetailValue(inheritedDepth, "mouth.seamProjection"),
    -2,
  );
  for (const definition of humanFaceDetailChannels) {
    for (const value of [definition.minimum, definition.maximum]) {
      const next = setHumanFaceDetail(document, definition.id, value);
      let actual: unknown = next.detail;
      for (const key of [definition.region, ...definition.path])
        actual = (actual as Record<string, unknown>)[key];
      TestValidator.equals("exact override", actual, value);
    }
    for (const value of [
      definition.minimum - 0.01,
      definition.maximum + 0.01,
      NaN,
      Infinity,
    ])
      TestValidator.predicate(
        "outside scalar envelope",
        throwsError(() => setHumanFaceDetail(document, definition.id, value)),
      );
  }
  document.controls = { noseWidth: 0.2 };
  const common = setHumanFaceDetail(document, "eye.foldDepth", 0.3);
  const left = setHumanFaceDetail(common, "eye.foldDepth", 0.7, "left");
  TestValidator.equals(
    "independent left",
    humanFaceDetailValue(left, "eye.foldDepth", "left"),
    0.7,
  );
  TestValidator.equals(
    "inherited right",
    humanFaceDetailValue(left, "eye.foldDepth", "right"),
    0.3,
  );
  TestValidator.equals("traits retained", left.controls, document.controls);
  const reset = setHumanFaceDetail(left, "eye.foldDepth", undefined, "left");
  TestValidator.equals(
    "side restores inheritance",
    humanFaceDetailValue(reset, "eye.foldDepth", "left"),
    0.3,
  );
  const inherited = setHumanFaceDetail(reset, "eye.foldDepth", undefined);
  TestValidator.equals(
    "basis restored",
    humanFaceDetailValue(inherited, "eye.foldDepth"),
    document.basis.recipe.eye.foldDepth,
  );
  TestValidator.equals(
    "absent profile",
    humanFaceDetailValue(document, "cheek.malar.projection"),
    undefined,
  );
  const bare = humanFaceFixture();
  delete bare.basis.recipe.mouth.section;
  TestValidator.equals(
    "absent nested group",
    humanFaceDetailValue(bare, "mouth.section.upperBody"),
    undefined,
  );
  TestValidator.equals("caller untouched", document.detail, undefined);
  TestValidator.predicate(
    "unknown write",
    throwsError(() => setHumanFaceDetail(document, "eye.unknown", 1)),
  );
  TestValidator.predicate(
    "unknown read",
    throwsError(() => humanFaceDetailValue(document, "eye.unknown")),
  );
  TestValidator.predicate(
    "fractional fibres",
    throwsError(() => setHumanFaceDetail(document, "eye.browFibres", 1.5)),
  );
  TestValidator.predicate(
    "unpaired owner",
    throwsError(() =>
      setHumanFaceDetail(document, "nose.widthScale", 1, "left"),
    ),
  );
  TestValidator.predicate(
    "unknown side",
    throwsError(() =>
      setHumanFaceDetail(document, "eye.widthScale", 1, "other" as "left"),
    ),
  );
};
