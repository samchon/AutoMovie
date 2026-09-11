import { TestValidator } from "@nestia/e2e";

import { assertPortraitFitBasis } from "../../subjects/portraitFitBasis";
import { throwsError } from "../internal/predicates";

/**
 * A residual's two recorded input identities must both match before use.
 * Known SHA-256 vectors provide an oracle independent of a generated portrait.
 *
 * Scenarios:
 * 1. The standard abc and empty-input digests admit their corresponding bytes.
 * 2. Changing only the source or only the target refuses the corresponding basis,
 *    so a matching first identity cannot conceal a changed second dependency.
 */
export const test_subject_fit_basis = (): void => {
  const source = new TextEncoder().encode("abc"),
    target = new Uint8Array();
  const basis = {
    sourceModelSha256:
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    targetControlNetSha256:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  };
  assertPortraitFitBasis(basis, source, target);
  TestValidator.predicate(
    "different source refuses",
    throwsError(
      () => assertPortraitFitBasis(basis, new Uint8Array([0]), target),
      "source model basis",
    ),
  );
  TestValidator.predicate(
    "different target refuses",
    throwsError(
      () => assertPortraitFitBasis(basis, source, new Uint8Array([0])),
      "target control basis",
    ),
  );
};
