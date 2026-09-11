import { TestValidator } from "@nestia/e2e";

import { buildPortraitNasalReference } from "../../subjects/generated-korean-girl-01/nasalReference";
import binding from "../../subjects/generated-korean-girl-01/nasalReferenceBinding.json";

/**
 * The nasal reference remains bound to its admitted fitted skin and target.
 *
 * Scenarios:
 * 1. The actual provider admits the unchanged reference and copies its supplied
 *    boundary. Later caller mutation cannot redirect the returned patch; every
 *    returned boundary identity names finite resident construction coordinates.
 */
export const test_subject_nasal_reference = (): void => {
  const input = { ...binding, sourceBoundary: [...binding.sourceBoundary] };
  const expected = [...input.sourceBoundary];
  const source = buildPortraitNasalReference(input);
  input.sourceBoundary.reverse();
  TestValidator.equals("provider owns boundary", source.boundary, expected);
  TestValidator.predicate(
    "resident finite boundary",
    source.boundary.every(
      (id) =>
        source.mesh.positions[id]?.length === 3 &&
        source.mesh.positions[id].every(Number.isFinite),
    ),
  );
};
