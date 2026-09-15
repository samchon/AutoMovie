import { setHumanFaceDetail } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Authored object sharing cannot turn one side edit into a basis or sibling edit.
 * Scenarios:
 * 1. Basis, common and paired eyes share one profile; a left write changes only left.
 * 2. Removing a left scalar retains it in every other owner and preserves the caller.
 * 3. Pruning an empty shared side override leaves the common and opposite side intact.
 */
export const test_subject_human_detail_alias = (): void => {
  const face = humanFaceFixture(),
    profile = face.basis.recipe.eye;
  face.detail = { eye: profile };
  face.asymmetry = { left: { eye: profile }, right: { eye: profile } };
  const before = structuredClone(face);
  for (const value of [2, undefined]) {
    const next = setHumanFaceDetail(face, "eye.foldDepth", value, "left");
    TestValidator.equals(
      "basis scalar retained",
      next.basis.recipe.eye.foldDepth,
      profile.foldDepth,
    );
    TestValidator.equals(
      "common scalar retained",
      next.detail!.eye!.foldDepth,
      profile.foldDepth,
    );
    TestValidator.equals(
      "opposite scalar retained",
      next.asymmetry!.right!.eye!.foldDepth,
      profile.foldDepth,
    );
    const expected = structuredClone(before);
    expected.asymmetry!.left!.eye = structuredClone(profile);
    if (value === undefined) delete expected.asymmetry!.left!.eye!.foldDepth;
    else expected.asymmetry!.left!.eye!.foldDepth = value;
    TestValidator.equals("only left owner changed", next, expected);
    TestValidator.equals("caller retained", face, before);
  }
  const shared = { foldDepth: 0 };
  face.detail = { eye: shared };
  face.asymmetry = { left: { eye: shared }, right: { eye: shared } };
  const next = setHumanFaceDetail(face, "eye.foldDepth", undefined, "left");
  TestValidator.equals(
    "selected empty owner pruned",
    next.asymmetry!.left,
    undefined,
  );
  TestValidator.equals("shared common retained", next.detail, {
    eye: { foldDepth: 0 },
  });
  TestValidator.equals("shared opposite retained", next.asymmetry!.right, {
    eye: { foldDepth: 0 },
  });
};
