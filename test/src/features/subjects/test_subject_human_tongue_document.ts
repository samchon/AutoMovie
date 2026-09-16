import {
  humanFaceDetailValue,
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { portraitTongueFixture } from "../internal/portraitTongueFixture";
import { throwsError } from "../internal/predicates";

/**
 * A tongue is optional anatomical data, never an inactive performance label.
 *
 * Scenarios:
 * 1. Omission preserves absence and explicit zero expressions need no tongue.
 * 2. A complete detailed tongue and its scalar overrides save/load with an
 *    unchanged basis; region reset restores absence and sides are refused.
 * 3. Nonzero observed/current tongue channels without a body and a selected
 *    tongue without a hinge refuse; incomplete basis profiles fail schema load.
 */
export const test_subject_human_tongue_document = (): void => {
  const face = humanFaceFixture(),
    saved = structuredClone(face);
  TestValidator.equals(
    "no invented anatomy",
    humanFaceRegionValue(face, "tongue"),
    undefined,
  );
  resolveHumanFaceDocument({
    ...face,
    expression: { tongueRaise: 0, tongueAdvance: 0 },
  });
  for (const key of ["tongueRaise", "tongueAdvance"] as const)
    for (const owner of ["basis", "current"] as const) {
      const unsupported = structuredClone(face);
      if (owner === "basis") unsupported.basis.expression[key] = 1;
      else unsupported.expression = { [key]: 1 };
      TestValidator.predicate(
        "no inactive tongue channel",
        throwsError(
          () => resolveHumanFaceDocument(unsupported),
          "tongue profile",
        ),
      );
    }
  const selected = replaceHumanFaceRegion({
    document: face,
    basisId: face.basis.id,
    region: "tongue",
    value: portraitTongueFixture(),
  });
  TestValidator.predicate(
    "explicit hinge required",
    throwsError(() => resolveHumanFaceDocument(selected), "jaw hinge"),
  );
  selected.basis.bindings.jawHinge = { x: 0, y: 0, z: -40 };
  for (const [key, value] of [
    ["halfWidth", 20],
    ["length", 45],
    ["halfThickness", 6],
    ["dorsumRise", 4],
    ["grooveDepth", 1],
    ["grooveWidth", 3],
    ["drop", 3],
    ["recess", 14],
  ] as const) {
    const id = `tongue.${key}`,
      edited = setHumanFaceDetail(selected, id, value);
    TestValidator.equals(
      "applied tongue scalar",
      humanFaceDetailValue(edited, id),
      value,
    );
    TestValidator.equals(
      "portable tongue",
      parseHumanFaceDocument(serializeHumanFaceDocument(edited)),
      edited,
    );
    TestValidator.predicate(
      "not a paired region",
      throwsError(() => setHumanFaceDetail(selected, id, value, "right")),
    );
    TestValidator.predicate(
      "invalid tongue scalar",
      throwsError(() => setHumanFaceDetail(selected, id, -1)),
    );
  }
  const reset = replaceHumanFaceRegion({
    document: selected,
    basisId: selected.basis.id,
    region: "tongue",
    value: undefined,
  });
  TestValidator.equals(
    "region reset",
    humanFaceRegionValue(reset, "tongue"),
    undefined,
  );
  const incomplete = structuredClone(face);
  incomplete.basis.recipe.tongue = { halfWidth: 18 } as ReturnType<
    typeof portraitTongueFixture
  >;
  TestValidator.predicate(
    "incomplete basis refused",
    throwsError(() => serializeHumanFaceDocument(incomplete)),
  );
  TestValidator.equals("basis ownership", face, saved);
};
