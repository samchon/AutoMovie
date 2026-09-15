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
 * Complete nasal envelopes are portable editor data with array replacement.
 *
 * Scenarios:
 * 1. Independent opening sections survive replace, serialize and resolve, own
 *    their caller values, and clear with an empty population or region reset.
 * 2. A string width is refused at document admission without changing the input.
 */
export const test_subject_human_nasal_envelopes = (): void => {
  const original = humanFaceFixture("nasal-envelope-document"),
    saved = structuredClone(original);
  const profile = {
    segments: 4,
    sections: [{ at: 0, width: 1, crest: 0.3, crestPosition: 0.5, roll: 90 }],
  };
  const envelopes = original.basis.bindings.nose.nostrils.map(() =>
    structuredClone(profile),
  );
  const selected = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "nose",
    value: { envelopes },
  });
  TestValidator.equals(
    "portable envelope",
    parseHumanFaceDocument(serializeHumanFaceDocument(selected)),
    selected,
  );
  TestValidator.equals(
    "resolved envelopes",
    humanFaceRegionValue(selected, "nose").envelopes,
    envelopes,
  );
  envelopes[0].sections[0].width = 10;
  TestValidator.equals(
    "owned widths",
    humanFaceRegionValue(selected, "nose").envelopes![0].sections[0].width,
    1,
  );
  const cleared = replaceHumanFaceRegion({
    document: selected,
    basisId: selected.basis.id,
    region: "nose",
    value: { envelopes: [] },
  });
  TestValidator.equals(
    "empty replaces inherited population",
    humanFaceRegionValue(cleared, "nose").envelopes,
    [],
  );
  const reset = replaceHumanFaceRegion({
    document: selected,
    basisId: selected.basis.id,
    region: "nose",
    value: undefined,
  });
  TestValidator.equals("reset detail", reset.detail?.nose, undefined);
  const invalid = JSON.parse(serializeHumanFaceDocument(selected));
  invalid.detail.nose.envelopes[0].sections[0].width = "one";
  TestValidator.predicate(
    "numeric envelope schema",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(invalid))),
  );
  TestValidator.equals("original untouched", original, saved);
};
