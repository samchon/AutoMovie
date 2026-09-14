import {
  humanFaceDetailValue,
  parseHumanFaceDocument,
  resolveHumanFaceDocument,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * Optical depth is a side-owned identity detail that survives a standalone
 * numerical document. Omission keeps the versioned zero, not an absent slider.
 *
 * Scenarios:
 * 1. Missing basis depth resolves to zero; an explicit signed basis is retained.
 * 2. Common and left-only changes serialize and reopen with right inheritance.
 * 3. Clearing each override restores its predecessor without mutating input.
 * 4. An untyped null is retained for admission rather than defaulted to zero;
 *    document serialization refuses it beside an omitted valid value.
 */
export const test_subject_human_globe_depth = (): void => {
  const input = humanFaceFixture();
  TestValidator.equals(
    "versioned depth default",
    humanFaceDetailValue(input, "eye.globeLift"),
    0,
  );
  input.basis.recipe.eye.globeLift = -1;
  const common = setHumanFaceDetail(input, "eye.globeLift", 2);
  const left = setHumanFaceDetail(common, "eye.globeLift", 3, "left");
  const reopened = parseHumanFaceDocument(serializeHumanFaceDocument(left));
  TestValidator.equals("complete depth document reopens", reopened, left);
  const resolved = resolveHumanFaceDocument(reopened);
  TestValidator.equals("common depth", resolved.recipe.eye.globeLift, 2);
  TestValidator.equals(
    "independent left depth",
    resolved.left.eye.globeLift,
    3,
  );
  TestValidator.equals(
    "right inherits common depth",
    resolved.right.eye.globeLift,
    2,
  );
  const sideCleared = setHumanFaceDetail(
    left,
    "eye.globeLift",
    undefined,
    "left",
  );
  TestValidator.equals(
    "left restores common depth",
    humanFaceDetailValue(sideCleared, "eye.globeLift", "left"),
    2,
  );
  const cleared = setHumanFaceDetail(sideCleared, "eye.globeLift", undefined);
  TestValidator.equals(
    "common restores signed basis",
    humanFaceDetailValue(cleared, "eye.globeLift", "right"),
    -1,
  );
  TestValidator.equals(
    "caller retains authored basis",
    input.basis.recipe.eye.globeLift,
    -1,
  );
  TestValidator.equals("caller has no detail edits", input.detail, undefined);
  const malformed = structuredClone(input);
  malformed.basis.recipe.eye.globeLift = null as unknown as number;
  TestValidator.equals(
    "an explicit malformed basis is not repaired into zero",
    resolveHumanFaceDocument(malformed).recipe.eye.globeLift,
    null,
  );
  TestValidator.predicate(
    "null depth refuses the document boundary",
    throwsError(() => serializeHumanFaceDocument(malformed)),
  );
};
