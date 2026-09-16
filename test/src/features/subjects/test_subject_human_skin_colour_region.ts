import {
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * Regional pigmentation is a portable, replaceable document owner.
 *
 * Scenarios:
 * 1. A missing population stays absent; replacement is owned and saves/loads.
 * 2. Empty selection clears inheritance; removing the override restores it.
 * 3. An unsupported side and malformed RGB schema refuse, preserving inputs.
 */
export const test_subject_human_skin_colour_region = (): void => {
  const original = humanFaceFixture();
  TestValidator.equals(
    "no invented pigment",
    humanFaceRegionValue(original, "skinColour"),
    undefined,
  );
  original.basis.recipe.skinColour = [skinColourRegion()];
  const input = [{ ...skinColourRegion(), strength: 0.75 }];
  const changed = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "skinColour",
    value: input,
  });
  TestValidator.equals(
    "portable region",
    parseHumanFaceDocument(serializeHumanFaceDocument(changed)),
    changed,
  );
  input[0].gain[0] = 0;
  TestValidator.equals(
    "owned region gain",
    humanFaceRegionValue(changed, "skinColour")![0].gain[0],
    0.8,
  );
  const cleared = replaceHumanFaceRegion({
    document: changed,
    basisId: original.basis.id,
    region: "skinColour",
    value: [],
  });
  TestValidator.equals(
    "empty overrides inherited array",
    humanFaceRegionValue(cleared, "skinColour"),
    [],
  );
  const inherited = replaceHumanFaceRegion({
    document: cleared,
    basisId: original.basis.id,
    region: "skinColour",
    value: undefined,
  });
  TestValidator.equals(
    "restore inherited region",
    humanFaceRegionValue(inherited, "skinColour"),
    original.basis.recipe.skinColour,
  );
  TestValidator.equals("basis unchanged", original.detail, undefined);
  TestValidator.predicate(
    "no side override",
    throwsError(
      () => humanFaceRegionValue(original, "skinColour", "left"),
      "independent side-profile",
    ),
  );
  const bad = structuredClone(changed) as unknown as {
    detail: { skinColour: { gain: number[] }[] };
  };
  bad.detail.skinColour[0].gain = [1, 1];
  TestValidator.predicate(
    "RGB schema",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(bad))),
  );
};
