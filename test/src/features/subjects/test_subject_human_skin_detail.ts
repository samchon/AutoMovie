import {
  humanFaceDetailValue,
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Skin condition survives real document editing and portable JSON admission.
 *
 * Scenarios:
 * 1. Legacy omission resolves to taut skin. Basis settings, scalar override,
 *    clearing and whole-profile replacement share the declared precedence.
 * 2. JSON round trips preserve skin and expression independently; side-only
 *    skin, invalid numeric settings and explicit null refuse.
 */
export const test_subject_human_skin_detail = (): void => {
  const face = humanFaceFixture(),
    id = "skin.laxity";
  TestValidator.equals(
    "legacy taut default",
    humanFaceDetailValue(face, id),
    0,
  );
  face.basis.recipe.skin = { laxity: 0.25, cheekSag: 1 };
  const before = structuredClone(face),
    edited = setHumanFaceDetail(face, id, 0.8);
  TestValidator.equals(
    "detail overrides basis",
    humanFaceDetailValue(edited, id),
    0.8,
  );
  TestValidator.equals(
    "clear restores basis",
    humanFaceDetailValue(setHumanFaceDetail(edited, id, undefined), id),
    0.25,
  );
  const replaced = replaceHumanFaceRegion({
    document: edited,
    basisId: face.basis.id,
    region: "skin",
    value: { expressionCreasing: 0.2 },
  });
  const applied = humanFaceRegionValue(replaced, "skin")!;
  TestValidator.equals(
    "region replacement retains inherited members",
    [applied.laxity, applied.cheekSag, applied.expressionCreasing],
    [0.25, 1, 0.2],
  );
  replaced.expression = { blink: { right: 0, left: 1 } };
  TestValidator.equals(
    "portable skin and performance",
    parseHumanFaceDocument(serializeHumanFaceDocument(replaced)),
    replaced,
  );
  TestValidator.equals("caller unchanged", face, before);
  TestValidator.predicate(
    "skin has no independent side override",
    throwsError(() => setHumanFaceDetail(face, id, 0.5, "left")),
  );
  for (const value of [-0.01, 1.01, NaN])
    TestValidator.predicate(
      "invalid skin value refuses",
      throwsError(() => setHumanFaceDetail(face, id, value)),
    );
  const malformed = structuredClone(face);
  malformed.basis.recipe.skin!.laxity = null as unknown as number;
  TestValidator.predicate(
    "null not omission",
    throwsError(() => serializeHumanFaceDocument(malformed)),
  );
};
