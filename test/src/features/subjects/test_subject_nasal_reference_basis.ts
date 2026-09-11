import { TestValidator } from "@nestia/e2e";

import { buildPortraitNasalReference } from "../../subjects/generated-korean-girl-01/nasalReference";
import binding from "../../subjects/generated-korean-girl-01/nasalReferenceBinding.json";
import { throwsError } from "../internal/predicates";

/**
 * A nasal boundary binding cannot silently migrate to another source sampling.
 *
 * Scenarios:
 * 1. Building the fitted source at zero rather than one refinement round must
 *    refuse the retained skin identity before any boundary IDs are consumed.
 */
export const test_subject_nasal_reference_basis = (): void => {
  TestValidator.predicate(
    "sampling basis cannot be silently reused",
    throwsError(() =>
      buildPortraitNasalReference({ ...binding, sourceSubdivisionRounds: 0 }),
    ),
  );
};
