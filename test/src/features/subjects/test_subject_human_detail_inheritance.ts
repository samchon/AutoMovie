import {
  humanFaceDetailValue,
  resolveHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Removing a scalar must not manufacture an optional component or empty profile.
 *
 * Scenarios:
 * 1. Clearing absent common, side and nested settings preserves the document
 *    and its resolvable absence, including paths below existing owners.
 * 2. Removing a final nested override restores omission without dropping a
 *    sibling field, another region or the opposite side's explicit zero.
 * 3. Clearing the final common and side overrides removes their empty owners;
 *    the original document and all inherited basis settings remain unchanged.
 */
export const test_subject_human_detail_inheritance = (): void => {
  const face = humanFaceFixture();
  delete face.basis.recipe.mouth.section;
  for (const [id, side] of [
    ["hair.widthScale", undefined],
    ["cheek.malar.projection", undefined],
    ["cheek.malar.projection", "left"],
    ["mouth.section.upperBody", undefined],
  ] as const) {
    const next = setHumanFaceDetail(face, id, undefined, side);
    TestValidator.equals("absent removal is identity", next, face);
    TestValidator.equals(
      "absence remains resolvable",
      resolveHumanFaceDocument(next),
      resolveHumanFaceDocument(face),
    );
  }
  face.detail = { mouth: { seamProjection: 0 }, eye: { foldDepth: 1 } };
  face.asymmetry = { right: { eye: { foldDepth: 0 } } };
  const original = structuredClone(face);
  for (const [id, side] of [
    ["hair.widthScale", undefined],
    ["mouth.section.upperBody", undefined],
    ["cheek.malar.projection", "left"],
    ["cheek.malar.projection", "right"],
  ] as const)
    TestValidator.equals(
      "existing owners do not create absent descendants",
      setHumanFaceDetail(face, id, undefined, side),
      face,
    );
  const detailed = setHumanFaceDetail(face, "mouth.section.upperBody", 1);
  TestValidator.equals(
    "last nested override restores exactly its basis",
    setHumanFaceDetail(detailed, "mouth.section.upperBody", undefined),
    face,
  );
  const sibling = setHumanFaceDetail(detailed, "mouth.section.lowerBody", 2);
  const expected = structuredClone(face);
  expected.detail!.mouth!.section = { lowerBody: 2 };
  TestValidator.equals(
    "absent leaf preserves populated profile",
    setHumanFaceDetail(expected, "mouth.section.upperBody", undefined),
    expected,
  );
  TestValidator.equals(
    "nested sibling survives",
    setHumanFaceDetail(sibling, "mouth.section.upperBody", undefined),
    expected,
  );
  const sided = setHumanFaceDetail(face, "eye.foldDepth", 1, "left");
  TestValidator.equals(
    "empty left owner removed but right zero retained",
    setHumanFaceDetail(sided, "eye.foldDepth", undefined, "left"),
    face,
  );
  const bare = humanFaceFixture();
  for (const side of [undefined, "right"] as const)
    TestValidator.equals(
      "last root override restores omission",
      setHumanFaceDetail(
        setHumanFaceDetail(bare, "eye.foldDepth", 0, side),
        "eye.foldDepth",
        undefined,
        side,
      ),
      bare,
    );
  TestValidator.equals("source remains caller-owned", face, original);
  TestValidator.equals(
    "opposite zero remains applied",
    humanFaceDetailValue(sided, "eye.foldDepth", "right"),
    0,
  );
};
